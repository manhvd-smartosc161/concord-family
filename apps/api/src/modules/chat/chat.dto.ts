import {
  IsIn,
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
  @IsIn(['private', 'public'])
  visibility!: 'private' | 'public';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
}
