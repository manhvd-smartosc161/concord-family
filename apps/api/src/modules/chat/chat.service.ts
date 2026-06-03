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

    const hasImages = (dto.images?.length ?? 0) > 0;
    if (!hasImages && !dto.message?.trim()) {
      throw new BadRequestException('message hoặc ảnh phải có ít nhất 1');
    }

    const session = await this.sessions.findAccessible(user, dto.sessionId);
    const sessionId = session.id;
    const defaultFundName = await this.resolveDefaultFundName(
      session.visibility,
      user,
    );
    const history = await this.sessions.recentMessages(sessionId, 20);

    const userMsgText = hasImages
      ? dto.message?.trim() || `📸 (đã gửi ${dto.images!.length} ảnh)`
      : dto.message;
    const userMsg = await this.sessions.appendMessage(
      sessionId,
      user.id,
      'user',
      userMsgText,
    );
    await this.sessions.maybeSetTitle(sessionId, userMsgText);

    let intent: 'action' | 'question';
    let routeUsage = { inputTokens: 0, outputTokens: 0 };
    let routeReason: string | null = null;
    if (hasImages) {
      intent = 'action';
      routeReason = 'has images → parser';
    } else {
      const route = await this.router.classify(dto.message, history);
      intent = route.intent;
      routeUsage = route.usage;
      routeReason = route.reason ?? null;
    }
    this.logger.debug(
      `router → ${intent} (${routeReason ?? 'no reason'}) [session ${sessionId}]`,
    );

    let reply: string;
    let actions: ChatResponseDto['actions'] = [];
    let stopReason: string | null = null;
    let usage = { inputTokens: 0, outputTokens: 0 };

    if (intent === 'action') {
      const result = await this.parser.parse(dto.message, user, {
        defaultFundName,
        history,
        images: hasImages
          ? dto.images!.map((img) => ({
              mediaType: img.mediaType,
              data: img.data,
            }))
          : undefined,
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
      inputTokens: usage.inputTokens + routeUsage.inputTokens,
      outputTokens: usage.outputTokens + routeUsage.outputTokens,
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
