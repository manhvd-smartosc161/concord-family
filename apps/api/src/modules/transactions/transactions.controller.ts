import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../shared/auth/decorators/current-user.decorator';
import { FamilyRequiredGuard } from '../../shared/auth/guards/family-required.guard';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';
import { User } from '../users/entities/user.entity';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import {
  TransactionsService,
  type TransactionView,
} from './transactions.service';

@UseGuards(JwtAuthGuard, FamilyRequiredGuard)
@Controller('api/transactions')
export class TransactionsController {
  constructor(private readonly txnService: TransactionsService) {}

  /** GET /api/transactions/recent?limit=20 */
  @Get('recent')
  recent(
    @CurrentUser() user: User,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<TransactionView[]> {
    return this.txnService.recentForUser(user, limit);
  }

  /**
   * GET /api/transactions
   *   ?fundId=…&from=ISO&to=ISO&q=text&offset=0&limit=50
   * Filtered, paginated. `fund_id` not in user's visible set returns empty.
   */
  @Get()
  list(
    @CurrentUser() user: User,
    @Query('fundId') fundId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset = 0,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
    @Query('scope') scope?: string,
  ): Promise<{ items: TransactionView[]; total: number }> {
    return this.txnService.listForUser(user, {
      fundId,
      categoryId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      q,
      offset,
      limit,
      scope: scope === 'joint' ? 'joint' : 'all',
    });
  }

  /** PATCH /api/transactions/:id — edit fund/amount/category/note, atomic balance recompute. */
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTransactionDto,
    @CurrentUser() user: User,
  ): Promise<TransactionView> {
    return this.txnService.updateForUser(id, user, dto);
  }

  /** DELETE /api/transactions/:id — reverses balance + deletes row. */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    await this.txnService.deleteForUser(id, user);
  }
}
