import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Family } from '../families/entities/family.entity';
import { Fund } from '../funds/entities/fund.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { TransactionsModule } from '../transactions/transactions.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, Fund, Family]),
    TransactionsModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
