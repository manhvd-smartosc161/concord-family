import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as admin from 'firebase-admin';
import { Repository } from 'typeorm';
import { DeviceToken } from './entities/device-token.entity';

export interface FcmPayload {
  title: string;
  body: string;
  link?: string;
}

@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);
  private app: admin.app.App | null = null;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(DeviceToken)
    private readonly deviceTokenRepo: Repository<DeviceToken>,
  ) {}

  onModuleInit(): void {
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const rawKey = this.config.get<string>('FIREBASE_PRIVATE_KEY');
    if (!projectId || !clientEmail || !rawKey) {
      this.logger.warn('FIREBASE_* not set — FCM push disabled');
      return;
    }
    const privateKey = rawKey.replace(/\\n/g, '\n');
    const existing = admin.apps.find((a) => a?.name === 'concord');
    this.app =
      existing ??
      admin.initializeApp(
        {
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        },
        'concord',
      );
  }

  async send(token: string, payload: FcmPayload): Promise<boolean> {
    if (!this.app) {
      this.logger.warn('fcm skipped (app disabled)');
      return false;
    }
    try {
      await admin.messaging(this.app).send({
        token,
        notification: { title: payload.title, body: payload.body },
        webpush: payload.link
          ? { fcmOptions: { link: payload.link } }
          : undefined,
      });
      return true;
    } catch (err) {
      const code = (err as { code?: string }).code ?? '';
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token' ||
        code === 'messaging/invalid-argument'
      ) {
        await this.deviceTokenRepo.delete({ fcmToken: token });
        this.logger.log(`removed dead token (${code})`);
      } else {
        this.logger.error(`fcm send failed: ${(err as Error).message}`);
      }
      return false;
    }
  }
}
