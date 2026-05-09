import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../shared/auth/decorators/current-user.decorator';
import { FamilyRequiredGuard } from '../../shared/auth/guards/family-required.guard';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';
import { User } from '../users/entities/user.entity';
import { CreateEnvelopeDto } from './dto/create-envelope.dto';
import { SetOpeningBalanceDto } from './dto/set-opening-balance.dto';
import { UpdateEnvelopeDto } from './dto/update-envelope.dto';
import { FundsService, type FundView } from './funds.service';

@UseGuards(JwtAuthGuard, FamilyRequiredGuard)
@Controller('api/funds')
export class FundsController {
  constructor(private readonly fundsService: FundsService) {}

  @Get()
  list(@CurrentUser() user: User): Promise<FundView[]> {
    return this.fundsService.listForUser(user);
  }

  /** PUT /api/funds/:fundId/opening-balance — set số dư khởi đầu của quỹ. */
  @Put(':fundId/opening-balance')
  setOpeningBalance(
    @CurrentUser() user: User,
    @Param('fundId', ParseUUIDPipe) fundId: string,
    @Body() dto: SetOpeningBalanceDto,
  ): Promise<FundView> {
    return this.fundsService.setOpeningBalance(user, fundId, dto.amount);
  }

  // ─── Envelopes (quỹ mục tiêu) ──────────────────────────────────────

  @Get('envelopes')
  listEnvelopes(@CurrentUser() user: User): Promise<FundView[]> {
    return this.fundsService.listEnvelopes(user);
  }

  @Post('envelopes')
  createEnvelope(
    @CurrentUser() user: User,
    @Body() dto: CreateEnvelopeDto,
  ): Promise<FundView> {
    return this.fundsService.createEnvelope(user, dto);
  }

  @Patch('envelopes/:fundId')
  updateEnvelope(
    @CurrentUser() user: User,
    @Param('fundId', ParseUUIDPipe) fundId: string,
    @Body() dto: UpdateEnvelopeDto,
  ): Promise<FundView> {
    return this.fundsService.updateEnvelope(user, fundId, dto);
  }

  @Post('envelopes/:fundId/archive')
  archiveEnvelope(
    @CurrentUser() user: User,
    @Param('fundId', ParseUUIDPipe) fundId: string,
  ): Promise<FundView> {
    return this.fundsService.archiveEnvelope(user, fundId);
  }

  @Post('envelopes/:fundId/unarchive')
  unarchiveEnvelope(
    @CurrentUser() user: User,
    @Param('fundId', ParseUUIDPipe) fundId: string,
  ): Promise<FundView> {
    return this.fundsService.unarchiveEnvelope(user, fundId);
  }
}
