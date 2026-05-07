import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import type { ParseAction } from '../../agent/subagents/parser/parser.subagent';

export class ChatRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message!: string;

  /** Required — chat must be in a fund-scoped session. */
  @IsUUID()
  sessionId!: string;
}

export interface ChatResponseDto {
  reply: string;
  actions: ParseAction[];
  stopReason: string | null;
  usage: { inputTokens: number; outputTokens: number };
  sessionId: string;
  userMessageId: string;
  agentMessageId: string;
}

export class CreateSessionDto {
  /** Required — every session is bound to a fund. */
  @IsUUID()
  fundId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
}
