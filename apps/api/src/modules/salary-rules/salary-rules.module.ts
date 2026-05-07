import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalaryRule } from './entities/salary-rule.entity';
import { SalaryRulesController } from './salary-rules.controller';
import { SalaryRulesService } from './salary-rules.service';

@Module({
  imports: [TypeOrmModule.forFeature([SalaryRule])],
  controllers: [SalaryRulesController],
  providers: [SalaryRulesService],
  exports: [SalaryRulesService],
})
export class SalaryRulesModule {}
