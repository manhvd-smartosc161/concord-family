import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from '../modules/categories/entities/category.entity';
import { Fund } from '../modules/funds/entities/fund.entity';
import { TransactionsModule } from '../modules/transactions/transactions.module';
import { AnthropicService } from './anthropic.service';
import { ParserSubagent } from './subagents/parser.subagent';

@Module({
  imports: [TypeOrmModule.forFeature([Fund, Category]), TransactionsModule],
  providers: [AnthropicService, ParserSubagent],
  exports: [AnthropicService, ParserSubagent],
})
export class AgentModule {}
