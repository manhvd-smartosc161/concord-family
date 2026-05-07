import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as dns from 'dns';
import * as nodemailer from 'nodemailer';

export interface EmailMessage {
  subject: string;
  html: string;
  text: string;
}

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private from = '';

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    dns.setDefaultResultOrder('ipv4first');

    const user = this.config.get<string>('GMAIL_USER');
    const pass = this.config.get<string>('GMAIL_APP_PASSWORD');
    const from = this.config.get<string>('GMAIL_FROM');
    if (!user || !pass) {
      this.logger.warn(
        'GMAIL_USER / GMAIL_APP_PASSWORD not set — email sending disabled',
      );
      return;
    }
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user, pass },
      connectionTimeout: 15_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      tls: { servername: 'smtp.gmail.com' },
    });
    this.from = from ?? user;
  }

  async send(to: string, message: EmailMessage): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn(`email skipped (transporter disabled): ${to}`);
      return false;
    }
    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
      return true;
    } catch (err) {
      this.logger.error(
        `email send failed to ${to}: ${(err as Error).message}`,
      );
      return false;
    }
  }
}
