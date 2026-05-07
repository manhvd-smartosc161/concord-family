import Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Thin wrapper around the Anthropic SDK so subagents can inject one shared
 * client and we can configure it (timeout, default headers) in one place.
 */
@Injectable()
export class AnthropicService implements OnModuleInit {
  private readonly logger = new Logger(AnthropicService.name);
  client!: Anthropic;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey || apiKey.startsWith('sk-ant-...')) {
      this.logger.warn(
        '⚠️  ANTHROPIC_API_KEY is missing or placeholder. ' +
          'Set it in .env before calling /api/chat.',
      );
    }
    this.client = new Anthropic({ apiKey });
  }

  /** Default reasoning model — Sonnet 4.6 unless overridden in .env. */
  get defaultModel(): string {
    return (
      this.config.get<string>('ANTHROPIC_DEFAULT_MODEL') ?? 'claude-sonnet-4-6'
    );
  }

  /** Fast model for narrow parse/classify — Haiku 4.5 unless overridden. */
  get fastModel(): string {
    return (
      this.config.get<string>('ANTHROPIC_FAST_MODEL') ??
      'claude-haiku-4-5-20251001'
    );
  }
}
