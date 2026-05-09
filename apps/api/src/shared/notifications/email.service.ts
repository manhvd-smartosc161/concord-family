import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail from '@sendgrid/mail';

export interface EmailMessage {
  subject: string;
  html: string;
  text: string;
}

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private enabled = false;
  private from = '';

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const apiKey = this.config.get<string>('SENDGRID_API_KEY');
    const from = this.config.get<string>('SENDGRID_FROM');
    if (!apiKey || !from) {
      this.logger.warn(
        'SENDGRID_API_KEY / SENDGRID_FROM not set — email sending disabled',
      );
      return;
    }
    sgMail.setApiKey(apiKey);
    this.from = from;
    this.enabled = true;
    this.logger.log(`SendGrid initialised, sender: ${this.from}`);
  }

  async send(to: string, message: EmailMessage): Promise<boolean> {
    if (!this.enabled) {
      this.logger.warn(`email skipped (SendGrid disabled): ${to}`);
      return false;
    }
    try {
      const [resp] = await sgMail.send({
        from: this.from,
        to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
      const headers = resp.headers as Record<string, string | undefined>;
      this.logger.log(
        `sent to ${to} (status ${resp.statusCode}, id=${headers['x-message-id'] ?? '?'})`,
      );
      return true;
    } catch (err) {
      const e = err as {
        message?: string;
        response?: { body?: { errors?: { message: string }[] } };
      };
      const detail =
        e.response?.body?.errors?.map((x) => x.message).join('; ') ??
        e.message ??
        String(err);
      this.logger.error(`email send failed to ${to}: ${detail}`);
      return false;
    }
  }
}
