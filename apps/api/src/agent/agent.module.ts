import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesModule } from '../modules/categories/categories.module';
import { Category } from '../modules/categories/entities/category.entity';
import { DebtsModule } from '../modules/debts/debts.module';
import { Fund } from '../modules/funds/entities/fund.entity';
import { ImportantDate } from '../modules/important-dates/entities/important-date.entity';
import { TransactionsModule } from '../modules/transactions/transactions.module';
import { AnthropicService } from './core/anthropic.service';
import { ParserSubagent } from './subagents/parser/parser.subagent';

@Module({
  imports: [
    TypeOrmModule.forFeature([Fund, Category, ImportantDate]),
    TransactionsModule,
    CategoriesModule,
    DebtsModule,
  ],
  providers: [AnthropicService, ParserSubagent],
  exports: [AnthropicService, ParserSubagent],
})
export class AgentModule {}
