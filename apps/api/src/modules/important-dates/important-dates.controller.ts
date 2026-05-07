import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
  MonthListView,
} from './important-dates.service';
import { todayInTimezone } from './lib/lunar';

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

  @Get('this-month')
  listThisMonth(): Promise<MonthListView> {
    return this.service.listThisMonth();
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
    if (process.env.NODE_ENV !== 'development') {
      throw new ForbiddenException('test notify disabled outside development');
    }
    const entry = await this.repo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException();
    await this.notifications.notifyImportantDate(entry, 0);
    return { ok: true };
  }

  @Post('refresh-ai-cache')
  async refreshAi(): Promise<MonthListView> {
    const today = todayInTimezone('Asia/Ho_Chi_Minh');
    const year = today.getUTCFullYear();
    const month = today.getUTCMonth() + 1;
    await this.service.refreshAiCache(year, month);
    return this.service.listForMonth(year, month, today);
  }

  @Post('_test-ai-date')
  async testAiDate(
    @Body() body: { name: string; date: string; notes?: string | null; kind?: string },
  ): Promise<{ ok: true }> {
    if (process.env.NODE_ENV !== 'development') {
      throw new ForbiddenException('test disabled outside development');
    }
    const target = new Date(`${body.date.slice(0, 10)}T00:00:00Z`);
    const today = todayInTimezone('Asia/Ho_Chi_Minh');
    const daysBefore = Math.max(
      0,
      Math.round((target.getTime() - today.getTime()) / 86_400_000),
    );
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
