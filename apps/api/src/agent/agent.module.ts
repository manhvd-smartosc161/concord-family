import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesModule } from '../modules/categories/categories.module';
import { Category } from '../modules/categories/entities/category.entity';
import { Fund } from '../modules/funds/entities/fund.entity';
import { ImportantDatesModule } from '../modules/important-dates/important-dates.module';
import { TransactionsModule } from '../modules/transactions/transactions.module';
import { AnthropicService } from './core/anthropic.service';
import { ParserSubagent } from './subagents/parser/parser.subagent';

@Module({
  imports: [
    TypeOrmModule.forFeature([Fund, Category]),
    TransactionsModule,
    CategoriesModule,
    ImportantDatesModule,
  ],
  providers: [AnthropicService, ParserSubagent],
  exports: [AnthropicService, ParserSubagent],
})
export class AgentModule {}
