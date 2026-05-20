import type Anthropic from '@anthropic-ai/sdk';

export type AnswererScope = 'personal' | 'joint';

export interface SearchTransactionsInput {
  year: number;
  month: number;
  categoryName?: string;
  query?: string;
  limit?: number;
}

export interface GetMonthlyReportInput {
  year: number;
  month: number;
}

export interface ListUpcomingDatesInput {
  limit?: number;
}

export const searchTransactionsTool: Anthropic.Tool = {
  name: 'search_transactions',
  description:
    'List transactions in a given financial month, optionally filtered by category name or note text. Returns date, amount, category, fund, note for each.',
  input_schema: {
    type: 'object',
    properties: {
      year: { type: 'number', description: 'Financial year (e.g. 2026).' },
      month: {
        type: 'number',
        description:
          'Financial month 1–12. Range is resolved using the family cutoff.',
      },
      categoryName: {
        type: 'string',
        description: 'Exact category name (case-insensitive). Optional.',
      },
      query: {
        type: 'string',
        description: 'Free-text substring matched on note. Optional.',
      },
      limit: { type: 'number', description: 'Max items (default 50, cap 200).' },
    },
    required: ['year', 'month'],
  },
};

export const getMonthlyReportTool: Anthropic.Tool = {
  name: 'get_monthly_report',
  description:
    'Get a full monthly report for the given financial month: income, expense, net, byCategory, byDay. Scope (personal/joint) is applied automatically.',
  input_schema: {
    type: 'object',
    properties: {
      year: { type: 'number' },
      month: { type: 'number' },
    },
    required: ['year', 'month'],
  },
};

export const listFundsTool: Anthropic.Tool = {
  name: 'list_funds',
  description:
    'List funds visible in the current chat scope. Returns name, type, balance, purpose. No parameters.',
  input_schema: { type: 'object', properties: {}, required: [] },
};

export const getGoalsProgressTool: Anthropic.Tool = {
  name: 'get_goals_progress',
  description:
    'List savings/investment goals visible to the user with current progress and pace. No parameters.',
  input_schema: { type: 'object', properties: {}, required: [] },
};

export const listUpcomingDatesTool: Anthropic.Tool = {
  name: 'list_upcoming_dates',
  description:
    'List family-wide upcoming birthdays/anniversaries with daysUntil. Available in both private and joint scopes.',
  input_schema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Default 10, cap 30.' },
    },
    required: [],
  },
};

export const listTasksThisWeekTool: Anthropic.Tool = {
  name: 'list_tasks_this_week',
  description:
    'List family-wide tasks for the current ISO week (title, status, assignee). No parameters.',
  input_schema: { type: 'object', properties: {}, required: [] },
};

export const answererTools: Anthropic.Tool[] = [
  searchTransactionsTool,
  getMonthlyReportTool,
  listFundsTool,
  getGoalsProgressTool,
  listUpcomingDatesTool,
  listTasksThisWeekTool,
];
