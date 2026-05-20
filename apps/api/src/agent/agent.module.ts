import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesModule } from '../modules/categories/categories.module';
import { Category } from '../modules/categories/entities/category.entity';
import { DebtsModule } from '../modules/debts/debts.module';
import { Debt } from '../modules/debts/entities/debt.entity';
import { Family } from '../modules/families/entities/family.entity';
import { Fund } from '../modules/funds/entities/fund.entity';
import { FundsModule } from '../modules/funds/funds.module';
import { GoalsModule } from '../modules/goals/goals.module';
import { ImportantDate } from '../modules/important-dates/entities/important-date.entity';
import { ImportantDatesModule } from '../modules/important-dates/important-dates.module';
import { ReportsModule } from '../modules/reports/reports.module';
import { TasksModule } from '../modules/tasks/tasks.module';
import { TransactionsModule } from '../modules/transactions/transactions.module';
import { AnthropicService } from './core/anthropic.service';
import { AnswererSubagent } from './subagents/answerer/answerer.subagent';
import { ParserSubagent } from './subagents/parser/parser.subagent';
import { RouterSubagent } from './subagents/router/router.subagent';

@Module({
  imports: [
    TypeOrmModule.forFeature([Fund, Category, ImportantDate, Debt, Family]),
    TransactionsModule,
    CategoriesModule,
    DebtsModule,
    FundsModule,
    GoalsModule,
    ImportantDatesModule,
    ReportsModule,
    forwardRef(() => TasksModule),
  ],
  providers: [AnthropicService, ParserSubagent, RouterSubagent, AnswererSubagent],
  exports: [
    AnthropicService,
    ParserSubagent,
    RouterSubagent,
    AnswererSubagent,
  ],
})
export class AgentModule {}
