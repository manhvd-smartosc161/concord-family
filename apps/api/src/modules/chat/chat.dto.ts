import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import type { ParseAction } from '../../agent/subagents/parser/parser.subagent';

export class ChatImageDto {
  @IsIn(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
  mediaType!: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

  @IsString()
  @MaxLength(7_500_000)
  data!: string;
}

export class ChatRequestDto {
  @IsString()
  @MaxLength(2000)
  message!: string;

  @IsUUID()
  sessionId!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => ChatImageDto)
  images?: ChatImageDto[];
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
