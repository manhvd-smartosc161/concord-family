import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentUser } from '../../shared/auth/decorators/current-user.decorator';
import { FamilyRequiredGuard } from '../../shared/auth/guards/family-required.guard';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';
import { NotificationsService } from '../../shared/notifications/notifications.service';
import { User } from '../users/entities/user.entity';
import { CreateImportantDateDto } from './dto/create-important-date.dto';
import { UpdateImportantDateDto } from './dto/update-important-date.dto';
import { ImportantDate } from './entities/important-date.entity';
import { ImportantDatesCron } from './important-dates.cron';
import {
  ImportantDatesService,
  ImportantDateView,
  UpcomingView,
  YearAgendaView,
} from './important-dates.service';
import {
  daysBetweenUtc,
  resolveOccurrenceForYear,
  todayInTimezone,
} from './lib/lunar';

@UseGuards(JwtAuthGuard, FamilyRequiredGuard)
@Controller('api/important-dates')
export class ImportantDatesController {
  constructor(
    private readonly service: ImportantDatesService,
    private readonly cron: ImportantDatesCron,
    private readonly notifications: NotificationsService,
    @InjectRepository(ImportantDate)
    private readonly repo: Repository<ImportantDate>,
  ) {}

  @Get()
  list(@CurrentUser() user: User): Promise<ImportantDateView[]> {
    return this.service.list(user.familyId!);
  }

  @Get('upcoming')
  upcoming(
    @CurrentUser() user: User,
    @Query('limit') limitRaw?: string,
  ): Promise<UpcomingView> {
    const parsed = limitRaw ? parseInt(limitRaw, 10) : 10;
    const limit =
      Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 100) : 10;
    return this.service.listUpcoming(user.familyId!, limit);
  }

  @Get('year/:year')
  year(
    @CurrentUser() user: User,
    @Param('year', ParseIntPipe) year: number,
  ): Promise<YearAgendaView> {
    return this.service.listForYear(user.familyId!, year);
  }

  @Post()
  create(
    @CurrentUser() user: User,
    @Body() dto: CreateImportantDateDto,
  ): Promise<ImportantDateView> {
    return this.service.create({ id: user.id, familyId: user.familyId! }, dto);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ImportantDateView> {
    return this.service.findOne(id, user.familyId!);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateImportantDateDto,
  ): Promise<ImportantDateView> {
    return this.service.update(id, user.familyId!, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.service.remove(id, user.familyId!);
  }

  @Post('_test-tick')
  async testTick(): Promise<{ count: number }> {
    if (process.env.NODE_ENV !== 'development') {
      throw new ForbiddenException('test tick disabled outside development');
    }
    return this.cron.run();
  }

  @Post(':id/test-notify')
  async testNotify(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ ok: true }> {
    const entry = await this.repo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException();
    const today = todayInTimezone('Asia/Ho_Chi_Minh');
    const year = today.getUTCFullYear();
    const occurrence = resolveOccurrenceForYear(entry, year);
    const target =
      occurrence < today
        ? resolveOccurrenceForYear(entry, year + 1)
        : occurrence;
    const daysBefore = daysBetweenUtc(today, target);
    await this.notifications.notifyImportantDate(entry, daysBefore);
    return { ok: true };
  }

  @Post('notify-ai-date')
  async notifyAiDate(
    @Body()
    body: {
      name: string;
      date: string;
      notes?: string | null;
      kind?: string;
    },
  ): Promise<{ ok: true }> {
    const target = new Date(`${body.date.slice(0, 10)}T00:00:00Z`);
    const today = todayInTimezone('Asia/Ho_Chi_Minh');
    const daysBefore = daysBetweenUtc(today, target);
    await this.notifications.notifyAiDate(
      {
        name: body.name,
        notes: body.notes ?? null,
        occursOn: body.date,
        kind: body.kind ?? 'other',
      },
      daysBefore,
    );
    return { ok: true };
  }
}
