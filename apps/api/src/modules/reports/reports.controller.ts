import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../shared/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';
import { User } from '../users/entities/user.entity';
import {
  ReportsService,
  type MonthlyReport,
  type ReportScope,
} from './reports.service';

@UseGuards(JwtAuthGuard)
@Controller('api/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /** GET /api/reports/monthly?year=2026&month=5 */
  @Get('monthly')
  monthly(
    @CurrentUser() user: User,
    @Query('year', new DefaultValuePipe(new Date().getFullYear()), ParseIntPipe)
    year: number,
    @Query(
      'month',
      new DefaultValuePipe(new Date().getMonth() + 1),
      ParseIntPipe,
    )
    month: number,
    @Query('scope') scope?: string,
  ): Promise<MonthlyReport> {
    const normalizedScope: ReportScope = scope === 'joint' ? 'joint' : 'all';
    return this.reportsService.monthly(user, year, month, normalizedScope);
  }
}
