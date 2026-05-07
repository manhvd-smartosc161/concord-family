import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../modules/users/entities/user.entity';
import { EmailService } from './email.service';
import { LivelyMessageService } from './lively-message.service';
import {
  buildLivelyEmail,
  type LivelyEmailInput,
} from './templates/lively-email';
import type { ImportantDate } from '../../modules/important-dates/entities/important-date.entity';

const USER_ICONS: Record<ImportantDate['type'], string> = {
  birthday: '🎂',
  death_anniversary: '🕯️',
  anniversary: '💍',
  other: '📌',
};

const USER_LABELS: Record<ImportantDate['type'], string> = {
  birthday: 'Sinh nhật',
  death_anniversary: 'Ngày giỗ',
  anniversary: 'Kỷ niệm',
  other: 'Sự kiện',
};

const AI_ICONS: Record<string, string> = {
  lunar: '🌙',
  national: '🇻🇳',
  international: '🌍',
  religious: '🙏',
  other: '📌',
};

const AI_LABELS: Record<string, string> = {
  lunar: 'Ngày âm lịch',
  national: 'Lễ Việt Nam',
  international: 'Lễ quốc tế',
  religious: 'Lễ tôn giáo',
  other: 'Sự kiện',
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly email: EmailService,
    private readonly lively: LivelyMessageService,
  ) {}

  async notifyImportantDate(
    entry: ImportantDate,
    daysBefore: number,
  ): Promise<void> {
    const message = await this.lively.generate({
      name: entry.name,
      kindLabel: USER_LABELS[entry.type],
      daysBefore,
      notes: entry.notes,
    });
    await this.deliver({
      icon: USER_ICONS[entry.type],
      kindLabel: USER_LABELS[entry.type],
      name: entry.name,
      occursOn: this.dateString(entry),
      isLunar: entry.isLunar,
      notes: entry.notes,
      daysBefore,
      message,
    });
  }

  async notifyAiDate(
    item: {
      name: string;
      notes: string | null;
      occursOn: string;
      kind: string;
    },
    daysBefore: number,
  ): Promise<void> {
    const icon = AI_ICONS[item.kind] ?? AI_ICONS.other;
    const kindLabel = AI_LABELS[item.kind] ?? AI_LABELS.other;
    const message = await this.lively.generate({
      name: item.name,
      kindLabel,
      daysBefore,
      notes: item.notes,
    });
    await this.deliver({
      icon,
      kindLabel,
      name: item.name,
      occursOn: item.occursOn,
      isLunar: item.kind === 'lunar',
      notes: item.notes,
      daysBefore,
      message,
    });
  }

  private async deliver(input: LivelyEmailInput): Promise<void> {
    const users = await this.users.find();
    const { subject, html, text } = buildLivelyEmail(input);
    await Promise.allSettled(
      users.map((u) => this.email.send(u.email, { subject, html, text })),
    );
    this.logger.log(
      `notified ${users.length} users for "${input.name}" (d=${input.daysBefore})`,
    );
  }

  private dateString(entry: ImportantDate): string {
    const raw =
      typeof entry.date === 'string'
        ? entry.date
        : new Date(entry.date).toISOString();
    return raw.slice(0, 10);
  }
}
