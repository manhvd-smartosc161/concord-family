import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentModule } from '../../agent/agent.module';
import { FamilyEventsModule } from '../../shared/notifications/family-events.module';
import { Task } from './entities/task.entity';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [TypeOrmModule.forFeature([Task]), AgentModule, FamilyEventsModule],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
