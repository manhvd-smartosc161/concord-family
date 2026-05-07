import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Fund } from './entities/fund.entity';
import { FundsController } from './funds.controller';
import { FundsService } from './funds.service';

@Module({
  imports: [TypeOrmModule.forFeature([Fund, Transaction])],
  controllers: [FundsController],
  providers: [FundsService],
  exports: [FundsService],
})
export class FundsModule {}
