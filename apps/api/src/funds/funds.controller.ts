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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../users/entities/user.entity';
import { CreateEnvelopeDto } from './dto/create-envelope.dto';
import { SetOpeningBalanceDto } from './dto/set-opening-balance.dto';
import { UpdateEnvelopeDto } from './dto/update-envelope.dto';
import { FundsService, type FundView } from './funds.service';

@UseGuards(JwtAuthGuard)
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
  createEnvelope(@Body() dto: CreateEnvelopeDto): Promise<FundView> {
    return this.fundsService.createEnvelope(dto);
  }

  @Patch('envelopes/:fundId')
  updateEnvelope(
    @Param('fundId', ParseUUIDPipe) fundId: string,
    @Body() dto: UpdateEnvelopeDto,
  ): Promise<FundView> {
    return this.fundsService.updateEnvelope(fundId, dto);
  }

  @Post('envelopes/:fundId/archive')
  archiveEnvelope(
    @Param('fundId', ParseUUIDPipe) fundId: string,
  ): Promise<FundView> {
    return this.fundsService.archiveEnvelope(fundId);
  }

  @Post('envelopes/:fundId/unarchive')
  unarchiveEnvelope(
    @Param('fundId', ParseUUIDPipe) fundId: string,
  ): Promise<FundView> {
    return this.fundsService.unarchiveEnvelope(fundId);
  }
}
