import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../modules/users/entities/user.entity';
import { EmailService } from './email.service';
import { buildEmail } from './templates/important-date';
import {
  buildLunarMilestoneEmail,
  type LunarMilestoneInput,
} from './templates/lunar-milestone';
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

  async notifyLunarMilestone(input: LunarMilestoneInput): Promise<void> {
    const users = await this.users.find();
    const { subject, html, text } = buildLunarMilestoneEmail(input);

    await Promise.allSettled(
      users.map((u) => this.email.send(u.email, { subject, html, text })),
    );
    this.logger.log(
      `notified ${users.length} users for lunar ${input.kind} (d=${input.daysBefore})`,
    );
  }
}
