import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FamilyEventsModule } from '../../shared/notifications/family-events.module';
import { Category } from '../categories/entities/category.entity';
import { Fund } from '../funds/entities/fund.entity';
import { TransactionsModule } from '../transactions/transactions.module';
import { DebtsController } from './debts.controller';
import { DebtsService } from './debts.service';
import { DebtPayment } from './entities/debt-payment.entity';
import { Debt } from './entities/debt.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Debt, DebtPayment, Fund, Category]),
    TransactionsModule,
    FamilyEventsModule,
  ],
  controllers: [DebtsController],
  providers: [DebtsService],
  exports: [DebtsService],
})
export class DebtsModule {}
