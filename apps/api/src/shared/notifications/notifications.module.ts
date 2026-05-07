import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../modules/users/entities/user.entity';
import { DeviceToken } from './entities/device-token.entity';
import { EmailService } from './email.service';
import { FcmService } from './fcm.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [TypeOrmModule.forFeature([DeviceToken, User])],
  controllers: [NotificationsController],
  providers: [EmailService, FcmService, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
