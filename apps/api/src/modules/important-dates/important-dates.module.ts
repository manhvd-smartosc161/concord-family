import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentModule } from '../../agent/agent.module';
import { NotificationsModule } from '../../shared/notifications/notifications.module';
import { ImportantDate } from './entities/important-date.entity';
import { MonthlyAiCache } from './entities/monthly-ai-cache.entity';
import { ImportantDatesController } from './important-dates.controller';
import { ImportantDatesCron } from './important-dates.cron';
import { ImportantDatesService } from './important-dates.service';
import { MonthlyAiService } from './monthly-ai.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ImportantDate, MonthlyAiCache]),
    NotificationsModule,
    AgentModule,
  ],
  controllers: [ImportantDatesController],
  providers: [ImportantDatesService, ImportantDatesCron, MonthlyAiService],
  exports: [ImportantDatesService, TypeOrmModule],
})
export class ImportantDatesModule {}
