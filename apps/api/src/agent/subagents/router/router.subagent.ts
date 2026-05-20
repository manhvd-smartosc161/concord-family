import * as fs from 'fs';
import * as path from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { AnthropicService } from '../../core/anthropic.service';
import { RouteInput, routeTool, type RouteIntent } from './router.tools';

export interface RouteResult {
  intent: RouteIntent;
  reason: string | null;
  usage: { inputTokens: number; outputTokens: number };
}

@Injectable()
export class RouterSubagent {
  private readonly logger = new Logger(RouterSubagent.name);
  private readonly skill: string;

  constructor(private readonly anthropic: AnthropicService) {
    const skillPath = path.join(__dirname, 'skill.md');
    this.skill = fs.readFileSync(skillPath, 'utf8');
  }

  async classify(
    message: string,
    history: Array<{ role: 'user' | 'agent'; text: string }> = [],
  ): Promise<RouteResult> {
    const recent = history
      .slice(-4)
      .map((m) => `${m.role === 'user' ? 'U' : 'A'}: ${m.text.slice(0, 200)}`)
      .join('\n');
    const userBlock = recent
      ? `Recent history:\n${recent}\n\nCurrent message:\n${message}`
      : `Current message:\n${message}`;

    const response = await this.anthropic.client.messages.create({
      model: this.anthropic.fastModel,
      max_tokens: 200,
      system: [
        {
          type: 'text',
          text: this.skill,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: [routeTool],
      tool_choice: { type: 'tool', name: 'route' },
      messages: [{ role: 'user', content: userBlock }],
    });

    for (const block of response.content) {
      if (block.type === 'tool_use' && block.name === 'route') {
        const input = block.input as RouteInput;
        return {
          intent: input.intent,
          reason: input.reason ?? null,
          usage: {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
          },
        };
      }
    }

    this.logger.warn(
      'Router did not return a tool_use block; defaulting to question',
    );
    return {
      intent: 'question',
      reason: 'fallback (no tool_use)',
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }
}
