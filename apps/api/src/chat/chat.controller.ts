import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../shared/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../shared/auth/guards/jwt-auth.guard';
import { User } from '../users/entities/user.entity';
import {
  ChatSessionsService,
  type ChatMessageView,
  type ChatSessionView,
} from './chat-sessions.service';
import {
  ChatRequestDto,
  CreateSessionDto,
  type ChatResponseDto,
} from './chat.dto';
import { ChatService } from './chat.service';

@UseGuards(JwtAuthGuard)
@Controller('api/chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly sessions: ChatSessionsService,
  ) {}

  /** POST /api/chat — body { message, sessionId? }. Auto-creates session if missing. */
  @Post()
  send(
    @Body() dto: ChatRequestDto,
    @CurrentUser() user: User,
  ): Promise<ChatResponseDto> {
    return this.chatService.handle(dto, user);
  }

  /** GET /api/chat/sessions — list all sessions for user, sorted most-recent. */
  @Get('sessions')
  listSessions(@CurrentUser() user: User): Promise<ChatSessionView[]> {
    return this.sessions.listForUser(user);
  }

  /** POST /api/chat/sessions — body { fundId, title? }. */
  @Post('sessions')
  createSession(
    @CurrentUser() user: User,
    @Body() dto: CreateSessionDto,
  ): Promise<ChatSessionView> {
    return this.sessions.create(user, dto.fundId, dto.title);
  }

  /** GET /api/chat/sessions/:id/messages — full history. */
  @Get('sessions/:id/messages')
  listMessages(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ChatMessageView[]> {
    return this.sessions.listMessages(user, id);
  }

  /** DELETE /api/chat/sessions/:id — cascade-delete its messages. */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('sessions/:id')
  async deleteSession(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.sessions.delete(user, id);
  }
}
