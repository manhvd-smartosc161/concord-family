import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AvatarService } from './avatar.service';

@Module({
  imports: [ConfigModule],
  providers: [AvatarService],
  exports: [AvatarService],
})
export class AvatarModule {}
