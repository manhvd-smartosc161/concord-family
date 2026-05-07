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

@UseGuards(JwtAuthGuard)
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
  list(): Promise<ImportantDateView[]> {
    return this.service.list();
  }

  @Get('upcoming')
  upcoming(
    @Query('limit') limitRaw?: string,
  ): Promise<UpcomingView> {
    const parsed = limitRaw ? parseInt(limitRaw, 10) : 10;
    const limit = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 100) : 10;
    return this.service.listUpcoming(limit);
  }

  @Get('year/:year')
  year(@Param('year', ParseIntPipe) year: number): Promise<YearAgendaView> {
    return this.service.listForYear(year);
  }

  @Post()
  create(
    @CurrentUser() user: User,
    @Body() dto: CreateImportantDateDto,
  ): Promise<ImportantDateView> {
    return this.service.create(user.id, dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ImportantDateView> {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateImportantDateDto,
  ): Promise<ImportantDateView> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
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
    body: { name: string; date: string; notes?: string | null; kind?: string },
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
