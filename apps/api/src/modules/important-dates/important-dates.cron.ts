import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationsService } from '../../shared/notifications/notifications.service';
import { ImportantDatesService } from './important-dates.service';
import { findLunarMilestone, todayInTimezone } from './lib/lunar';

const LUNAR_DAYS_BEFORE = 2;

const TZ = 'Asia/Ho_Chi_Minh';

@Injectable()
export class ImportantDatesCron {
  private readonly logger = new Logger(ImportantDatesCron.name);

  constructor(
    private readonly service: ImportantDatesService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron('0 8 * * *', { timeZone: TZ })
  async tick(): Promise<void> {
    await this.run();
  }

  async run(): Promise<{ count: number }> {
    const today = todayInTimezone(TZ);
    const due = await this.service.findDueOn(today);
    this.logger.log(
      `tick: ${due.length} reminder(s) due on ${today.toISOString().slice(0, 10)}`,
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

    const milestone = findLunarMilestone(today, LUNAR_DAYS_BEFORE);
    if (milestone) {
      try {
        await this.notifications.notifyLunarMilestone({
          ...milestone,
          daysBefore: LUNAR_DAYS_BEFORE,
        });
      } catch (err) {
        this.logger.error(
          `lunar milestone notify failed: ${(err as Error).message}`,
        );
      }
    }

    return { count: due.length + (milestone ? 1 : 0) };
  }
}
