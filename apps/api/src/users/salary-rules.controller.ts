import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateSalaryRuleDto } from './dto/update-salary-rule.dto';
import { User } from './entities/user.entity';
import {
  SalaryRulesService,
  type SalaryRuleView,
} from './salary-rules.service';

@UseGuards(JwtAuthGuard)
@Controller('api/salary-rules')
export class SalaryRulesController {
  constructor(private readonly service: SalaryRulesService) {}

  /** GET /api/salary-rules — current user's salary split rule. */
  @Get()
  get(@CurrentUser() user: User): Promise<SalaryRuleView> {
    return this.service.findForUser(user);
  }

  /** PUT /api/salary-rules — update split percentages + optional fixed amount. */
  @Put()
  update(
    @CurrentUser() user: User,
    @Body() dto: UpdateSalaryRuleDto,
  ): Promise<SalaryRuleView> {
    return this.service.updateForUser(user, {
      pctToPersonal: dto.pctToPersonal,
      pctToJoint: dto.pctToJoint,
      fixedAmountToJoint: dto.fixedAmountToJoint ?? null,
    });
  }
}
