import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentModule } from '../../agent/agent.module';
import { NotificationsModule } from '../../shared/notifications/notifications.module';
import { ImportantDate } from './entities/important-date.entity';
import { YearlyAiCache } from './entities/yearly-ai-cache.entity';
import { ImportantDatesController } from './important-dates.controller';
import { ImportantDatesCron } from './important-dates.cron';
import { ImportantDatesService } from './important-dates.service';
import { YearlyAiService } from './yearly-ai.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ImportantDate, YearlyAiCache]),
    NotificationsModule,
    AgentModule,
  ],
  controllers: [ImportantDatesController],
  providers: [ImportantDatesService, ImportantDatesCron, YearlyAiService],
  exports: [ImportantDatesService, TypeOrmModule],
})
export class ImportantDatesModule {}
