import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DebtPaymentsService } from './debt-payments.service';
import { DebtsController } from './debts.controller';
import { DebtsMatchService } from './debts-match.service';
import { DebtsService } from './debts.service';
import { Debt } from './entities/debt.entity';
import { DebtPayment } from './entities/debt-payment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Debt, DebtPayment])],
  controllers: [DebtsController],
  providers: [DebtsService, DebtPaymentsService, DebtsMatchService],
  exports: [DebtsService, DebtPaymentsService, DebtsMatchService],
})
export class DebtsModule {}
