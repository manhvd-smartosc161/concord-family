import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationsService } from '../../shared/notifications/notifications.service';
import { ImportantDatesService } from './important-dates.service';
import { MonthlyAiService } from './monthly-ai.service';
import { addDaysUtc, daysBetweenUtc, todayInTimezone } from './lib/lunar';

const TZ = 'Asia/Ho_Chi_Minh';

@Injectable()
export class ImportantDatesCron {
  private readonly logger = new Logger(ImportantDatesCron.name);

  constructor(
    private readonly service: ImportantDatesService,
    private readonly notifications: NotificationsService,
    private readonly monthlyAi: MonthlyAiService,
  ) {}

  @Cron('0 8 * * *', { timeZone: TZ })
  async tick(): Promise<void> {
    await this.run();
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
    const months = uniqueMonthsToScan(today);
    for (const { year, month } of months) {
      let cache;
      try {
        cache = await this.monthlyAi.getOrGenerate(year, month);
      } catch (err) {
        this.logger.warn(
          `skip AI cache for ${year}-${month}: ${(err as Error).message}`,
        );
        continue;
      }
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

function uniqueMonthsToScan(today: Date): { year: number; month: number }[] {
  const horizon = addDaysUtc(today, 60);
  const months = new Set<string>();
  for (
    let d = new Date(today);
    d <= horizon;
    d = new Date(d.getTime() + 86_400_000)
  ) {
    months.add(`${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`);
  }
  return Array.from(months).map((s) => {
    const [y, m] = s.split('-').map(Number);
    return { year: y, month: m };
  });
}
