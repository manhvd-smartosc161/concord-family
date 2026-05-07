import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationsService } from '../../shared/notifications/notifications.service';
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
  ) {}

  async onModuleInit(): Promise<void> {
    const today = todayInTimezone(TZ);
    const year = today.getUTCFullYear();
    try {
      await this.yearlyAi.ensureCache(year);
    } catch (err) {
      this.logger.warn(
        `boot warm AI cache failed for ${year}: ${(err as Error).message}`,
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
    this.logger.log(`yearly AI tick: regenerating ${year}`);
    try {
      await this.yearlyAi.regenerate(year);
    } catch (err) {
      this.logger.error(`yearly AI regen failed: ${(err as Error).message}`);
    }
  }

  async run(): Promise<{ count: number }> {
    const today = todayInTimezone(TZ);
    const due = await this.service.findDueOn(today);
    this.logger.log(
      `tick: ${due.length} user reminder(s) due on ${today.toISOString().slice(0, 10)}`,
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

    const aiDue = await this.findAiDueOn(today);
    this.logger.log(`tick: ${aiDue.length} AI reminder(s) due`);
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

    return { count: due.length + aiDue.length };
  }

  private async findAiDueOn(today: Date) {
    const out: {
      item: { date: string; name: string; kind: string; notes: string | null };
      daysBefore: number;
    }[] = [];
    const year = today.getUTCFullYear();
    for (const y of [year, year + 1]) {
      const cache = await this.yearlyAi.findCache(y);
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
