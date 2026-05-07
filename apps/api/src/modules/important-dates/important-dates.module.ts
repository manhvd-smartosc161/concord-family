import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from '../../shared/notifications/notifications.module';
import { ImportantDate } from './entities/important-date.entity';
import { ImportantDatesController } from './important-dates.controller';
import { ImportantDatesCron } from './important-dates.cron';
import { ImportantDatesService } from './important-dates.service';

@Module({
  imports: [TypeOrmModule.forFeature([ImportantDate]), NotificationsModule],
  controllers: [ImportantDatesController],
  providers: [ImportantDatesService, ImportantDatesCron],
  exports: [ImportantDatesService, TypeOrmModule],
})
export class ImportantDatesModule {}
