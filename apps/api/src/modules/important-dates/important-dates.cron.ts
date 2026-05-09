import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { Not, IsNull, Repository } from 'typeorm';
import { NotificationsService } from '../../shared/notifications/notifications.service';
import { Family } from '../families/entities/family.entity';
import { ImportantDatesService } from './important-dates.service';
import { YearlyAiService } from './yearly-ai.service';
import { daysBetweenUtc, todayInTimezone } from './lib/lunar';

const TZ = 'Asia/Ho_Chi_Minh';

@Injectable()
export class ImportantDatesCron implements OnModuleInit {
  private readonly logger = new Logger(ImportantDatesCron.name);

  constructor(
    private readonly service: ImportantDatesService,
    private readonly notifications: NotificationsService,
    private readonly yearlyAi: YearlyAiService,
    @InjectRepository(Family)
    private readonly familyRepo: Repository<Family>,
  ) {}

  onModuleInit(): void {
    void this.warmAllFamilies().catch((err: unknown) => {
      this.logger.warn(`boot warm: ${(err as Error).message}`);
    });
  }

  private async warmAllFamilies(): Promise<void> {
    const families = await this.familyRepo.find({
      where: { completedAt: Not(IsNull()) },
    });
    const year = todayInTimezone(TZ).getUTCFullYear();
    for (const f of families) {
      await this.yearlyAi
        .ensureCache(year, f.id)
        .catch((err: unknown) =>
          this.logger.warn(`AI cache fail for ${f.id}/${year}: ${(err as Error).message}`),
        );
    }
  }

  @Cron('0 8 * * *', { timeZone: TZ })
  async tick(): Promise<void> {
    await this.run();
  }

  @Cron('0 0 1 1 *', { timeZone: TZ })
  async yearlyAiTick(): Promise<void> {
    const today = todayInTimezone(TZ);
    const year = today.getUTCFullYear();
    this.logger.log(`yearly AI tick: regenerating ${year} for all families`);
    const families = await this.familyRepo.find({
      where: { completedAt: Not(IsNull()) },
    });
    for (const f of families) {
      try {
        await this.yearlyAi.regenerate(year, f.id);
      } catch (err) {
        this.logger.error(`yearly AI regen failed for ${f.id}: ${(err as Error).message}`);
      }
    }
  }

  async run(): Promise<{ count: number }> {
    const today = todayInTimezone(TZ);
    const families = await this.familyRepo.find({
      where: { completedAt: Not(IsNull()) },
    });

    let totalCount = 0;

    for (const family of families) {
      const due = await this.service.findDueOn(family.id, today);
      this.logger.log(
        `tick family=${family.id}: ${due.length} user reminder(s) due on ${today.toISOString().slice(0, 10)}`,
      );
      for (const { entry, daysBefore } of due) {
        try {
          await this.notifications.notifyImportantDate(entry, daysBefore);
        } catch (err) {
          this.logger.error(
            `notify failed for ${entry.id}: ${(err as Error).message}`,
          );
        }
      }

      const aiDue = await this.findAiDueOn(family.id, today);
      this.logger.log(`tick family=${family.id}: ${aiDue.length} AI reminder(s) due`);
      for (const { item, daysBefore } of aiDue) {
        try {
          await this.notifications.notifyAiDate(
            {
              name: item.name,
              notes: item.notes,
              occursOn: item.date,
              kind: item.kind,
            },
            daysBefore,
          );
        } catch (err) {
          this.logger.error(
            `AI notify failed for ${item.name}: ${(err as Error).message}`,
          );
        }
      }

      totalCount += due.length + aiDue.length;
    }

    return { count: totalCount };
  }

  private async findAiDueOn(familyId: string, today: Date) {
    const out: {
      item: { date: string; name: string; kind: string; notes: string | null };
      daysBefore: number;
    }[] = [];
    const year = today.getUTCFullYear();
    for (const y of [year, year + 1]) {
      const cache = await this.yearlyAi.findCache(y, familyId);
      if (!cache) continue;
      for (const item of cache.items) {
        const occurrence = new Date(`${item.date}T00:00:00Z`);
        const diff = daysBetweenUtc(today, occurrence);
        if (item.remindDaysBefore.includes(diff)) {
          out.push({ item, daysBefore: diff });
        }
      }
    }
    return out;
  }
}
