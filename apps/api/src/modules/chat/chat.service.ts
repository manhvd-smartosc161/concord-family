import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnswererSubagent } from '../../agent/subagents/answerer/answerer.subagent';
import { ParserSubagent } from '../../agent/subagents/parser/parser.subagent';
import { RouterSubagent } from '../../agent/subagents/router/router.subagent';
import { Fund } from '../funds/entities/fund.entity';
import { User } from '../users/entities/user.entity';
import { ChatSessionsService } from './chat-sessions.service';
import type { ChatRequestDto, ChatResponseDto } from './chat.dto';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly router: RouterSubagent,
    private readonly parser: ParserSubagent,
    private readonly answerer: AnswererSubagent,
    private readonly sessions: ChatSessionsService,
    @InjectRepository(Fund)
    private readonly fundRepo: Repository<Fund>,
  ) {}

  private async resolveDefaultFundName(
    visibility: 'private' | 'public',
    user: User,
  ): Promise<string | undefined> {
    if (visibility === 'private') {
      const fund = await this.fundRepo.findOne({
        where: {
          familyId: user.familyId!,
          type: 'personal',
          ownerId: user.id,
          purpose: 'spending',
        },
      });
      return fund?.name;
    }
    const fund = await this.fundRepo.findOne({
      where: { familyId: user.familyId!, type: 'joint', purpose: 'spending' },
    });
    return fund?.name;
  }

  async handle(dto: ChatRequestDto, user: User): Promise<ChatResponseDto> {
    if (!dto.sessionId) {
      throw new BadRequestException('sessionId is required');
    }

    const session = await this.sessions.findAccessible(user, dto.sessionId);
    const sessionId = session.id;
    const defaultFundName = await this.resolveDefaultFundName(
      session.visibility,
      user,
    );
    const history = await this.sessions.recentMessages(sessionId, 20);

    const userMsg = await this.sessions.appendMessage(
      sessionId,
      user.id,
      'user',
      dto.message,
    );
    await this.sessions.maybeSetTitle(sessionId, dto.message);

    const route = await this.router.classify(dto.message, history);
    this.logger.debug(
      `router → ${route.intent} (${route.reason ?? 'no reason'}) [session ${sessionId}]`,
    );

    let reply: string;
    let actions: ChatResponseDto['actions'] = [];
    let stopReason: string | null = null;
    let usage = { inputTokens: 0, outputTokens: 0 };

    if (route.intent === 'action') {
      const result = await this.parser.parse(dto.message, user, {
        defaultFundName,
        history,
      });
      reply = result.reply;
      actions = result.actions;
      stopReason = result.stopReason;
      usage = result.usage;
    } else {
      const scope = session.visibility === 'private' ? 'personal' : 'joint';
      const result = await this.answerer.answer(
        dto.message,
        user,
        scope,
        history,
      );
      reply = result.reply;
      stopReason = result.stopReason;
      usage = result.usage;
    }

    const totalUsage = {
      inputTokens: usage.inputTokens + route.usage.inputTokens,
      outputTokens: usage.outputTokens + route.usage.outputTokens,
    };

    const agentMsg = await this.sessions.appendMessage(
      sessionId,
      user.id,
      'agent',
      reply,
      actions,
      totalUsage,
    );

    return {
      reply,
      actions,
      stopReason,
      usage: totalUsage,
      sessionId,
      userMessageId: userMsg.id,
      agentMessageId: agentMsg.id,
    };
  }
}
