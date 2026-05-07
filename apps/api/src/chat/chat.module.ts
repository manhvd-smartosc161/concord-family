import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentModule } from '../agent/agent.module';
import { Fund } from '../funds/entities/fund.entity';
import { ChatSessionsService } from './chat-sessions.service';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatSession } from './entities/chat-session.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatSession, ChatMessage, Fund]),
    AgentModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatSessionsService],
})
export class ChatModule {}
