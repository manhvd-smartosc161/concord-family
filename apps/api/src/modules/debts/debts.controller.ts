import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../shared/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';
import { User } from '../users/entities/user.entity';
import { DebtsService } from './debts.service';
import { CreateDebtDto } from './dto/create-debt.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';

@UseGuards(JwtAuthGuard)
@Controller('api/debts')
export class DebtsController {
  constructor(private readonly debtsService: DebtsService) {}

  @Get()
  list(
    @CurrentUser() user: User,
    @Query('status') status?: 'open' | 'settled' | 'all',
    @Query('direction') direction?: 'lent' | 'borrowed' | 'all',
  ) {
    return this.debtsService.listForUser(user, { status, direction });
  }

  @Get('summary')
  summary(@CurrentUser() user: User) {
    return this.debtsService.summaryForUser(user);
  }

  @Get(':id')
  detail(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.debtsService.findByIdForUser(user, id);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() body: CreateDebtDto) {
    return this.debtsService.createDebt(user, body, 'form');
  }

  @Post(':id/payments')
  recordPayment(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RecordPaymentDto,
  ) {
    return this.debtsService.recordPayment(user, id, body, 'form');
  }

  @Delete(':id/payments/:paymentId')
  deletePayment(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ) {
    return this.debtsService.deletePayment(user, id, paymentId);
  }

  @Delete(':id')
  async deleteDebt(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    await this.debtsService.deleteDebt(user, id);
    return { ok: true };
  }
}
