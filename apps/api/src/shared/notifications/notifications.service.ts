import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../modules/users/entities/user.entity';
import { EmailService } from './email.service';
import { buildEmail } from './templates/important-date';
import type { ImportantDate } from '../../modules/important-dates/entities/important-date.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly email: EmailService,
  ) {}

  async notifyImportantDate(
    entry: ImportantDate,
    daysBefore: number,
  ): Promise<void> {
    const users = await this.users.find();
    const { subject, html, text } = buildEmail(entry, daysBefore);

    await Promise.allSettled(
      users.map((u) => this.email.send(u.email, { subject, html, text })),
    );
    this.logger.log(
      `notified ${users.length} users for "${entry.name}" (d=${daysBefore})`,
    );
  }

  async notifyAiDate(item: {
    name: string;
    notes: string | null;
    occursOn: string;
    kind: string;
  }, daysBefore: number): Promise<void> {
    const users = await this.users.find();
    const dayPhrase =
      daysBefore === 0 ? 'Hôm nay' : `Còn ${daysBefore} ngày nữa`;
    const subject = `📅 ${dayPhrase} là ${item.name}`;
    const body = `${dayPhrase} là ${item.name} (dương: ${item.occursOn})${item.notes ? `\n${item.notes}` : ''}`;
    const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1c1917;"><h1 style="font-size:20px;margin:0 0 12px;color:#0c0a09;">${escape(subject)}</h1><p style="font-size:14px;line-height:1.6;color:#44403c;white-space:pre-line;">${escape(body)}</p><hr style="border:none;border-top:1px solid #e7e5e4;margin:24px 0;" /><p style="font-size:12px;color:#a8a29e;">Concord — couple finance agent</p></div>`;
    const text = `${subject}\n\n${body}`;

    await Promise.allSettled(
      users.map((u) => this.email.send(u.email, { subject, html, text })),
    );
    this.logger.log(
      `notified ${users.length} users for AI date "${item.name}" (d=${daysBefore})`,
    );
  }
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
