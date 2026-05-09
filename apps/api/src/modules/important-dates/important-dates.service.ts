import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateImportantDateDto } from './dto/create-important-date.dto';
import { UpdateImportantDateDto } from './dto/update-important-date.dto';
import { ImportantDate } from './entities/important-date.entity';
import { YearlyAiService } from './yearly-ai.service';
import {
  daysBetweenUtc,
  resolveOccurrenceForYear,
  todayInTimezone,
} from './lib/lunar';
import type { AiDateKind } from './entities/yearly-ai-cache.entity';

const TZ = 'Asia/Ho_Chi_Minh';

export interface ImportantDateView {
  id: string;
  name: string;
  type: ImportantDate['type'];
  date: string;
  isLunar: boolean;
  remindDaysBefore: number[];
  notes: string | null;
  createdById: string;
  nextOccurrence: string;
  daysUntilNext: number;
}

export type AgendaItemSource = 'user' | 'ai';
export type AgendaItemKind = ImportantDate['type'] | AiDateKind;

export interface AgendaItem {
  occursOn: string;
  daysUntil: number;
  source: AgendaItemSource;
  kind: AgendaItemKind;
  name: string;
  isLunar: boolean;
  notes: string | null;
  sourceId: string | null;
  remindDaysBefore: number[];
}

export interface UpcomingView {
  items: AgendaItem[];
  aiGeneratedAt: string | null;
}

export interface YearAgendaView {
  year: number;
  items: AgendaItem[];
  aiGeneratedAt: string | null;
}

@Injectable()
export class ImportantDatesService {
  constructor(
    @InjectRepository(ImportantDate)
    private readonly repo: Repository<ImportantDate>,
    private readonly yearlyAi: YearlyAiService,
  ) {}

  async list(): Promise<ImportantDateView[]> {
    const all = await this.repo.find();
    return all
      .map((e) => this.toView(e))
      .sort((a, b) => a.daysUntilNext - b.daysUntilNext);
  }

  async create(
    userId: string,
    dto: CreateImportantDateDto,
  ): Promise<ImportantDateView> {
    const dedup = Array.from(new Set(dto.remindDaysBefore)).sort(
      (a, b) => a - b,
    );
    const entity = this.repo.create({
      name: dto.name,
      type: dto.type,
      date: dto.date.slice(0, 10),
      isLunar: dto.isLunar,
      remindDaysBefore: dedup,
      notes: dto.notes ?? null,
      createdById: userId,
    });
    return this.toView(await this.repo.save(entity));
  }

  async findOne(id: string): Promise<ImportantDateView> {
    const e = await this.repo.findOne({ where: { id } });
    if (!e) throw new NotFoundException();
    return this.toView(e);
  }

  async update(
    id: string,
    dto: UpdateImportantDateDto,
  ): Promise<ImportantDateView> {
    const e = await this.repo.findOne({ where: { id } });
    if (!e) throw new NotFoundException();
    if (dto.name !== undefined) e.name = dto.name;
    if (dto.type !== undefined) e.type = dto.type;
    if (dto.date !== undefined) e.date = dto.date.slice(0, 10);
    if (dto.isLunar !== undefined) e.isLunar = dto.isLunar;
    if (dto.remindDaysBefore !== undefined) {
      e.remindDaysBefore = Array.from(new Set(dto.remindDaysBefore)).sort(
        (a, b) => a - b,
      );
    }
    if (dto.notes !== undefined) e.notes = dto.notes;
    return this.toView(await this.repo.save(e));
  }

  async remove(id: string): Promise<void> {
    const result = await this.repo.delete(id);
    if (result.affected === 0) throw new NotFoundException();
  }

  async listUpcoming(limit = 10): Promise<UpcomingView> {
    const today = todayInTimezone(TZ);
    const all = await this.collectAgenda(today, today.getUTCFullYear());
    const future = all.items.filter((i) => i.daysUntil >= 0);
    future.sort((a, b) => a.daysUntil - b.daysUntil);
    return {
      items: future.slice(0, limit),
      aiGeneratedAt: all.aiGeneratedAt,
    };
  }

  async listForYear(year: number): Promise<YearAgendaView> {
    await this.yearlyAi.ensureCache(year);
    const today = todayInTimezone(TZ);
    const collected = await this.collectAgenda(today, year, { fullYear: true });
    const future = collected.items.filter((i) => i.daysUntil >= 0);
    future.sort((a, b) => a.occursOn.localeCompare(b.occursOn));
    return {
      year,
      items: future,
      aiGeneratedAt: collected.aiGeneratedAt,
    };
  }

  private async collectAgenda(
    today: Date,
    year: number,
    opts: { fullYear?: boolean } = {},
  ): Promise<{ items: AgendaItem[]; aiGeneratedAt: string | null }> {
    const items: AgendaItem[] = [];
    const all = await this.repo.find();

    for (const e of all) {
      const dates = opts.fullYear
        ? [resolveOccurrenceForYear(e, year)]
        : [
            resolveOccurrenceForYear(e, year),
            resolveOccurrenceForYear(e, year + 1),
          ];
      for (const occurrence of dates) {
        items.push({
          occursOn: occurrence.toISOString().slice(0, 10),
          daysUntil: daysBetweenUtc(today, occurrence),
          source: 'user',
          kind: e.type,
          name: e.name,
          isLunar: e.isLunar,
          notes: e.notes,
          sourceId: e.id,
          remindDaysBefore: e.remindDaysBefore,
        });
      }
    }

    const years = opts.fullYear ? [year] : [year, year + 1];
    let aiGeneratedAt: string | null = null;
    for (const y of years) {
      const cache = await this.yearlyAi.findCache(y);
      if (!cache) continue;
      if (y === year) aiGeneratedAt = cache.generatedAt.toISOString();
      for (const ai of cache.items) {
        const occurrence = new Date(`${ai.date}T00:00:00Z`);
        items.push({
          occursOn: ai.date,
          daysUntil: daysBetweenUtc(today, occurrence),
          source: 'ai',
          kind: ai.kind,
          name: ai.name,
          isLunar: ai.kind === 'lunar',
          notes: ai.notes,
          sourceId: null,
          remindDaysBefore: ai.remindDaysBefore,
        });
      }
    }

    return { items, aiGeneratedAt };
  }

  async findDueOn(
    today: Date,
  ): Promise<{ entry: ImportantDate; daysBefore: number }[]> {
    const all = await this.repo.find();
    const due: { entry: ImportantDate; daysBefore: number }[] = [];
    for (const e of all) {
      const occurrence = resolveOccurrenceForYear(e, today.getUTCFullYear());
      let diff = daysBetweenUtc(today, occurrence);
      if (diff < 0) {
        const next = resolveOccurrenceForYear(e, today.getUTCFullYear() + 1);
        diff = daysBetweenUtc(today, next);
      }
      if (e.remindDaysBefore.includes(diff)) {
        due.push({ entry: e, daysBefore: diff });
      }
    }
    return due;
  }

  private toView(e: ImportantDate): ImportantDateView {
    const today = todayInTimezone(TZ);
    let occurrence = resolveOccurrenceForYear(e, today.getUTCFullYear());
    let diff = daysBetweenUtc(today, occurrence);
    if (diff < 0) {
      occurrence = resolveOccurrenceForYear(e, today.getUTCFullYear() + 1);
      diff = daysBetweenUtc(today, occurrence);
    }
    return {
      id: e.id,
      name: e.name,
      type: e.type,
      date:
        typeof e.date === 'string'
          ? e.date
          : new Date(e.date).toISOString().slice(0, 10),
      isLunar: e.isLunar,
      remindDaysBefore: e.remindDaysBefore,
      notes: e.notes,
      createdById: e.createdById,
      nextOccurrence: occurrence.toISOString().slice(0, 10),
      daysUntilNext: diff,
    };
  }
}
