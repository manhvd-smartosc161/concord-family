import * as path from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AgentModule } from './agent/agent.module';
import { AuthModule } from './shared/auth/auth.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ChatModule } from './modules/chat/chat.module';
import { DatabaseModule } from './infra/database/database.module';
import { FundsModule } from './modules/funds/funds.module';
import { GoalsModule } from './modules/goals/goals.module';
import { FamiliesModule } from './modules/families/families.module';
import { ImportantDatesModule } from './modules/important-dates/important-dates.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { NotificationsModule } from './shared/notifications/notifications.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SalaryRulesModule } from './modules/salary-rules/salary-rules.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        path.resolve(__dirname, '../../../.env'),
        path.resolve(process.cwd(), '.env'),
      ],
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    UsersModule,
    AuthModule,
    SalaryRulesModule,
    FundsModule,
    CategoriesModule,
    TransactionsModule,
    ReportsModule,
    GoalsModule,
    AgentModule,
    ChatModule,
    NotificationsModule,
    FamiliesModule,
    ImportantDatesModule,
    TasksModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
