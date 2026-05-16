import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../shared/auth/decorators/current-user.decorator';
import { FamilyRequiredGuard } from '../../shared/auth/guards/family-required.guard';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';
import { User } from '../users/entities/user.entity';
import { DebtPaymentsService } from './debt-payments.service';
import { DebtsMatchService } from './debts-match.service';
import { DebtsService } from './debts.service';
import { CreateDebtDto } from './dto/create-debt.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ListDebtsQueryDto } from './dto/list-debts-query.dto';
import { MatchDebtDto } from './dto/match-debt.dto';
import { UpdateDebtDto } from './dto/update-debt.dto';

@UseGuards(JwtAuthGuard, FamilyRequiredGuard)
@Controller('api/debts')
export class DebtsController {
  constructor(
    private readonly debtsService: DebtsService,
    private readonly paymentsService: DebtPaymentsService,
    private readonly matchService: DebtsMatchService,
  ) {}

  @Get()
  list(@CurrentUser() user: User, @Query() query: ListDebtsQueryDto) {
    return this.debtsService.listForUser(user, query);
  }

  @Get(':id')
  detail(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.debtsService.getById(user, id);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateDebtDto) {
    return this.debtsService.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDebtDto,
  ) {
    return this.debtsService.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    await this.debtsService.delete(user, id);
  }

  @Post(':id/close')
  close(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.debtsService.close(user, id);
  }

  @Post(':id/reopen')
  reopen(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.debtsService.reopen(user, id);
  }

  @Post(':id/payments')
  createPayment(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.paymentsService.create(user, id, dto);
  }

  @Delete(':id/payments/:paymentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePayment(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ) {
    await this.paymentsService.delete(user, id, paymentId);
  }

  @Post('match')
  match(@CurrentUser() user: User, @Body() dto: MatchDebtDto) {
    return this.matchService.matchCounterparty(user, dto.counterparty, dto.direction);
  }
}
