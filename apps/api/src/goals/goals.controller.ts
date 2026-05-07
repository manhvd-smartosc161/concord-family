import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../users/entities/user.entity';
import { UpdateYearlySavingsDto } from './dto/update-yearly-savings.dto';
import { GoalsService, type GoalView } from './goals.service';

@UseGuards(JwtAuthGuard)
@Controller('api/goals')
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  /** GET /api/goals — couple goals + this user's personal goals, with progress. */
  @Get()
  list(@CurrentUser() user: User): Promise<GoalView[]> {
    return this.goalsService.listForUser(user);
  }

  /** PUT /api/goals/yearly-savings — upsert mục tiêu tiết kiệm năm hiện tại của cặp đôi. */
  @Put('yearly-savings')
  upsertYearlySavings(@Body() dto: UpdateYearlySavingsDto): Promise<GoalView> {
    return this.goalsService.upsertYearlySavings(dto.targetAmount);
  }
}
