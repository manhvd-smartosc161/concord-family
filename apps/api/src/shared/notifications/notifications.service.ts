import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../../modules/users/entities/user.entity';
import { DeviceToken } from './entities/device-token.entity';
import { EmailService } from './email.service';
import { FcmService } from './fcm.service';
import { buildEmail } from './templates/important-date';
import type { ImportantDate } from '../../modules/important-dates/entities/important-date.entity';

export interface NotificationPayload {
  title: string;
  body: string;
  link?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(DeviceToken)
    private readonly tokens: Repository<DeviceToken>,
    private readonly email: EmailService,
    private readonly fcm: FcmService,
  ) {}

  async notifyImportantDate(
    entry: ImportantDate,
    daysBefore: number,
  ): Promise<void> {
    const users = await this.users.find();
    const tokens = await this.tokens.find({
      where: { userId: In(users.map((u) => u.id)) },
    });
    const { subject, html, text } = buildEmail(entry, daysBefore);
    const link = `/important-dates`;

    await Promise.allSettled([
      ...users.map((u) => this.email.send(u.email, { subject, html, text })),
      ...tokens.map((t) =>
        this.fcm.send(t.fcmToken, { title: subject, body: text, link }),
      ),
    ]);
    this.logger.log(
      `notified ${users.length} users, ${tokens.length} devices for "${entry.name}" (d=${daysBefore})`,
    );
  }

  async registerToken(
    userId: string,
    fcmToken: string,
    platform: 'ios_pwa' | 'android' | 'desktop',
  ): Promise<DeviceToken> {
    const existing = await this.tokens.findOne({ where: { fcmToken } });
    if (existing) {
      existing.userId = userId;
      existing.platform = platform;
      existing.lastSeenAt = new Date();
      return this.tokens.save(existing);
    }
    return this.tokens.save(
      this.tokens.create({
        userId,
        fcmToken,
        platform,
        lastSeenAt: new Date(),
      }),
    );
  }

  async unregisterToken(userId: string, fcmToken: string): Promise<void> {
    const t = await this.tokens.findOne({ where: { fcmToken } });
    if (!t) throw new NotFoundException('token not found');
    if (t.userId !== userId) throw new NotFoundException('token not found');
    await this.tokens.delete(t.id);
  }
}
