import { BadRequestException, Injectable } from '@nestjs/common';
import { ParserSubagent } from '../../agent/subagents/parser.subagent';
import { User } from '../users/entities/user.entity';
import { ChatSessionsService } from './chat-sessions.service';
import type { ChatRequestDto, ChatResponseDto } from './chat.dto';

@Injectable()
export class ChatService {
  constructor(
    private readonly parser: ParserSubagent,
    private readonly sessions: ChatSessionsService,
  ) {}

  async handle(dto: ChatRequestDto, user: User): Promise<ChatResponseDto> {
    if (!dto.sessionId) {
      throw new BadRequestException(
        'sessionId is required — chat must be in a fund-scoped session',
      );
    }

    // Verify access + load fund context
    const session = await this.sessions.findAccessible(user, dto.sessionId);
    const sessionId = session.id;
    const defaultFundName = session.fund.name;

    // Lấy history TRƯỚC khi append message hiện tại — parser sẽ tự append
    // current message vào cuối khi build payload.
    const history = await this.sessions.recentMessages(sessionId, 20);

    // Persist user message (with author = current user)
    const userMsg = await this.sessions.appendMessage(
      sessionId,
      user.id,
      'user',
      dto.message,
    );
    await this.sessions.maybeSetTitle(sessionId, dto.message);

    // Run the parser with the session's fund as default + conversation history
    const result = await this.parser.parse(dto.message, user, {
      defaultFundName,
      history,
    });

    // Persist agent reply
    const agentMsg = await this.sessions.appendMessage(
      sessionId,
      user.id,
      'agent',
      result.reply,
      result.actions,
      result.usage,
    );

    return {
      reply: result.reply,
      actions: result.actions,
      stopReason: result.stopReason,
      usage: result.usage,
      sessionId,
      userMessageId: userMsg.id,
      agentMessageId: agentMsg.id,
    };
  }
}
