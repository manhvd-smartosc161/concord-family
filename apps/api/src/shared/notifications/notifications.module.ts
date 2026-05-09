import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentModule } from '../../agent/agent.module';
import { User } from '../../modules/users/entities/user.entity';
import { EmailService } from './email.service';
import { LivelyMessageService } from './lively-message.service';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [TypeOrmModule.forFeature([User]), AgentModule],
  providers: [EmailService, LivelyMessageService, NotificationsService],
  exports: [NotificationsService, EmailService],
})
export class NotificationsModule {}
