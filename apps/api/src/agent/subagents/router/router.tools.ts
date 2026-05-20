import type Anthropic from '@anthropic-ai/sdk';

export type RouteIntent = 'action' | 'question';

export interface RouteInput {
  intent: RouteIntent;
  reason?: string;
}

export const routeTool: Anthropic.Tool = {
  name: 'route',
  description:
    'Classify the user message into one intent: "action" (do something — log/edit/delete) or "question" (read/answer from data).',
  input_schema: {
    type: 'object',
    properties: {
      intent: {
        type: 'string',
        enum: ['action', 'question'],
        description: 'Intent classification.',
      },
      reason: {
        type: 'string',
        description: 'Short rationale for logging (≤80 chars).',
      },
    },
    required: ['intent'],
  },
};
