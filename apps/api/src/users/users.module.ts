import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalaryRule } from './entities/salary-rule.entity';
import { User } from './entities/user.entity';
import { SalaryRulesController } from './salary-rules.controller';
import { SalaryRulesService } from './salary-rules.service';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, SalaryRule])],
  controllers: [SalaryRulesController],
  providers: [UsersService, SalaryRulesService],
  exports: [UsersService, SalaryRulesService],
})
export class UsersModule {}
