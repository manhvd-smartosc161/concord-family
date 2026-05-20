import * as fs from 'fs';
import * as path from 'path';
import type Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../../../modules/categories/entities/category.entity';
import { Family } from '../../../modules/families/entities/family.entity';
import { Fund } from '../../../modules/funds/entities/fund.entity';
import { FundsService } from '../../../modules/funds/funds.service';
import { GoalsService } from '../../../modules/goals/goals.service';
import { ImportantDatesService } from '../../../modules/important-dates/important-dates.service';
import { ReportsService } from '../../../modules/reports/reports.service';
import { TasksService } from '../../../modules/tasks/tasks.service';
import { TransactionsService } from '../../../modules/transactions/transactions.service';
import { User } from '../../../modules/users/entities/user.entity';
import {
  getCurrentFinancialMonth,
  getFinancialMonthRange,
} from '../../../shared/common/date-helpers';
import { AnthropicService } from '../../core/anthropic.service';
import {
  AnswererScope,
  GetMonthlyReportInput,
  ListUpcomingDatesInput,
  SearchTransactionsInput,
  answererTools,
} from './answerer.tools';

export interface AnswerResult {
  reply: string;
  stopReason: string | null;
  usage: { inputTokens: number; outputTokens: number };
}

const MAX_TOOL_ROUNDS = 3;

@Injectable()
export class AnswererSubagent {
  private readonly logger = new Logger(AnswererSubagent.name);
  private readonly skill: string;

  constructor(
    private readonly anthropic: AnthropicService,
    private readonly transactionsService: TransactionsService,
    private readonly reportsService: ReportsService,
    private readonly fundsService: FundsService,
    private readonly goalsService: GoalsService,
    private readonly importantDatesService: ImportantDatesService,
    private readonly tasksService: TasksService,
    @InjectRepository(Family) private readonly familyRepo: Repository<Family>,
    @InjectRepository(Fund) private readonly fundRepo: Repository<Fund>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
  ) {
    const skillPath = path.join(__dirname, 'skill.md');
    this.skill = fs.readFileSync(skillPath, 'utf8');
  }

  async answer(
    message: string,
    user: User,
    scope: AnswererScope,
    history: Array<{ role: 'user' | 'agent'; text: string }> = [],
  ): Promise<AnswerResult> {
    const context = await this.buildContext(user, scope);

    const messages: Anthropic.MessageParam[] = buildMessages(history, message);

    let inputTokens = 0;
    let outputTokens = 0;
    let stopReason: string | null = null;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response: Anthropic.Message =
        await this.anthropic.client.messages.create({
          model: this.anthropic.defaultModel,
          max_tokens: 1024,
          system: [
            {
              type: 'text',
              text: this.skill,
              cache_control: { type: 'ephemeral' },
            },
            { type: 'text', text: context },
          ],
          tools: answererTools,
          messages,
        });

      inputTokens += response.usage.input_tokens;
      outputTokens += response.usage.output_tokens;
      stopReason = response.stop_reason;

      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );

      if (toolUses.length === 0 || response.stop_reason !== 'tool_use') {
        const reply = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('\n')
          .trim();
        return {
          reply:
            reply ||
            'Xin lỗi, mình chưa hiểu câu hỏi. Bạn nói cụ thể hơn được không?',
          stopReason,
          usage: { inputTokens, outputTokens },
        };
      }

      messages.push({ role: 'assistant', content: response.content });
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const use of toolUses) {
        const result = await this.runTool(use.name, use.input, user, scope);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: use.id,
          content: JSON.stringify(result),
        });
      }
      messages.push({ role: 'user', content: toolResults });
    }

    return {
      reply:
        'Mình cần thêm thời gian để trả lời câu này. Thử hỏi lại với câu ngắn gọn hơn nhé.',
      stopReason: 'max_rounds',
      usage: { inputTokens, outputTokens },
    };
  }

  private async runTool(
    name: string,
    input: unknown,
    user: User,
    scope: AnswererScope,
  ): Promise<unknown> {
    try {
      switch (name) {
        case 'search_transactions':
          return await this.toolSearchTransactions(
            input as SearchTransactionsInput,
            user,
            scope,
          );
        case 'get_monthly_report':
          return await this.toolGetMonthlyReport(
            input as GetMonthlyReportInput,
            user,
            scope,
          );
        case 'list_funds':
          return await this.toolListFunds(user, scope);
        case 'get_goals_progress':
          return await this.toolGoalsProgress(user);
        case 'list_upcoming_dates':
          return await this.toolUpcomingDates(
            input as ListUpcomingDatesInput,
            user,
          );
        case 'list_tasks_this_week':
          return await this.toolTasksThisWeek(user);
        default:
          return { error: `Unknown tool: ${name}` };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Tool ${name} failed: ${msg}`);
      return { error: msg };
    }
  }

  private async buildContext(
    user: User,
    scope: AnswererScope,
  ): Promise<string> {
    const family = await this.familyRepo.findOneByOrFail({
      id: user.familyId!,
    });
    const cutoffDay = family.financialMonthCutoffDay;
    const now = new Date();
    const fm = getCurrentFinancialMonth(now, cutoffDay);
    const week = currentIsoWeek(now);
    const scopeLabel =
      scope === 'personal' ? 'private (chỉ của bạn)' : 'joint (Quỹ Chung)';

    return [
      '## Current Context',
      `- User: ${user.name} (${user.role === 'husband' ? 'chồng' : 'vợ'})`,
      `- Scope: ${scopeLabel}`,
      `- Financial cutoffDay: ${cutoffDay}`,
      `- Current financial month: ${fm.year}-${String(fm.month).padStart(2, '0')}`,
      `- Current ISO week: ${week}`,
      `- Now: ${now.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`,
    ].join('\n');
  }

  private async toolSearchTransactions(
    input: SearchTransactionsInput,
    user: User,
    scope: AnswererScope,
  ): Promise<unknown> {
    const family = await this.familyRepo.findOneByOrFail({
      id: user.familyId!,
    });
    const { start, end } = getFinancialMonthRange(
      input.year,
      input.month,
      family.financialMonthCutoffDay,
    );
    const visibleFundIds = await this.scopedFundIds(user, scope);
    if (visibleFundIds.length === 0) {
      return {
        range: { start, end },
        items: [],
        total: 0,
        expenseSum: 0,
        incomeSum: 0,
      };
    }

    let categoryId: string | undefined;
    if (input.categoryName) {
      const cat = await this.categoryRepo
        .createQueryBuilder('c')
        .where('c.family_id = :familyId', { familyId: user.familyId! })
        .andWhere('LOWER(c.name) = LOWER(:name)', { name: input.categoryName })
        .getOne();
      if (!cat) {
        return {
          range: { start, end },
          items: [],
          total: 0,
          expenseSum: 0,
          incomeSum: 0,
          note: `Không tìm thấy category "${input.categoryName}".`,
        };
      }
      categoryId = cat.id;
    }

    const limit = Math.min(input.limit ?? 50, 200);
    const perFundLimit = Math.max(
      10,
      Math.ceil(limit / Math.max(visibleFundIds.length, 1)),
    );
    const perFundResults = await Promise.all(
      visibleFundIds.map((fundId) =>
        this.transactionsService.listForUser(user, {
          from: start,
          to: new Date(end.getTime() - 1),
          fundId,
          categoryId,
          q: input.query,
          limit: perFundLimit,
        }),
      ),
    );
    const inScope = perFundResults
      .flatMap((r) => r.items)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, limit);
    let expenseSum = 0;
    let incomeSum = 0;
    for (const t of inScope) {
      if (t.amount < 0) expenseSum += -t.amount;
      else incomeSum += t.amount;
    }
    return {
      range: { start, end },
      items: inScope.map((t) => ({
        date: t.date,
        amount: t.amount,
        category: t.category?.name ?? null,
        icon: t.category?.icon ?? null,
        fund: t.fund.name,
        note: t.note,
      })),
      total: inScope.length,
      expenseSum,
      incomeSum,
    };
  }

  private async toolGetMonthlyReport(
    input: GetMonthlyReportInput,
    user: User,
    scope: AnswererScope,
  ): Promise<unknown> {
    if (scope === 'joint') {
      return await this.reportsService.monthly(
        user,
        input.year,
        input.month,
        'joint',
      );
    }
    const myFundIds = await this.scopedFundIds(user, 'personal');
    if (myFundIds.length === 0) {
      return {
        range: null,
        income: 0,
        expense: 0,
        net: 0,
        txnCount: 0,
        byCategory: [],
        byDay: [],
        note: 'Bạn chưa có quỹ cá nhân nào.',
      };
    }
    if (myFundIds.length === 1) {
      return await this.reportsService.monthly(
        user,
        input.year,
        input.month,
        'all',
        myFundIds[0],
      );
    }
    const perFund = await Promise.all(
      myFundIds.map((id) =>
        this.reportsService.monthly(user, input.year, input.month, 'all', id),
      ),
    );
    let income = 0;
    let expense = 0;
    let txnCount = 0;
    const byCategoryMap = new Map<
      string,
      { categoryId: string | null; categoryName: string; icon: string | null; amount: number; count: number }
    >();
    for (const rep of perFund) {
      income += rep.income;
      expense += rep.expense;
      txnCount += rep.txnCount;
      for (const c of rep.byCategory) {
        const key = c.categoryId ?? `__name_${c.categoryName}`;
        const acc = byCategoryMap.get(key);
        if (acc) {
          acc.amount += c.amount;
          acc.count += c.count;
        } else {
          byCategoryMap.set(key, { ...c });
        }
      }
    }
    return {
      range: perFund[0].range,
      income,
      expense,
      net: income - expense,
      txnCount,
      byCategory: [...byCategoryMap.values()].sort((a, b) => b.amount - a.amount),
      byDay: [],
    };
  }

  private async toolListFunds(
    user: User,
    scope: AnswererScope,
  ): Promise<unknown> {
    const funds = await this.fundsService.listForUser(user);
    const filtered = funds.filter((f) => {
      if (scope === 'personal')
        return f.type === 'personal' && f.accessLevel === 'owner';
      return f.type === 'joint';
    });
    return filtered.map((f) => ({
      name: f.name,
      type: f.type,
      purpose: f.purpose,
      balance: f.balance ?? 0,
    }));
  }

  private async toolGoalsProgress(user: User): Promise<unknown> {
    const goals = await this.goalsService.listForUser(user);
    return goals.map((g) => ({
      id: g.id,
      type: g.type,
      period: g.period,
      scope: g.scope,
      targetAmount: g.targetAmount,
      currentProgress: g.currentProgress,
      paceStatus: g.paceStatus,
      daysRemaining: g.daysRemaining,
    }));
  }

  private async toolUpcomingDates(
    input: ListUpcomingDatesInput,
    user: User,
  ): Promise<unknown> {
    const limit = Math.min(input.limit ?? 10, 30);
    const view = await this.importantDatesService.listUpcoming(
      user.familyId!,
      limit,
    );
    return view.items.map((d) => ({
      name: d.name,
      kind: d.kind,
      occursOn: d.occursOn,
      daysUntil: d.daysUntil,
      isLunar: d.isLunar,
    }));
  }

  private async toolTasksThisWeek(user: User): Promise<unknown> {
    const tasks = await this.tasksService.list(user);
    return tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      assignee: t.assignee,
      weekYear: t.weekYear,
    }));
  }

  private async scopedFundIds(
    user: User,
    scope: AnswererScope,
  ): Promise<string[]> {
    const where =
      scope === 'personal'
        ? {
            familyId: user.familyId!,
            type: 'personal' as const,
            ownerId: user.id,
          }
        : { familyId: user.familyId!, type: 'joint' as const };
    const funds = await this.fundRepo.find({ where, select: { id: true } });
    return funds.map((f) => f.id);
  }
}

function currentIsoWeek(d: Date): string {
  const date = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function buildMessages(
  history: Array<{ role: 'user' | 'agent'; text: string }>,
  currentMessage: string,
): Anthropic.MessageParam[] {
  const out: Anthropic.MessageParam[] = [];
  for (const h of history) {
    const role: 'user' | 'assistant' = h.role === 'user' ? 'user' : 'assistant';
    const text = h.text || '(empty)';
    if (out.length > 0 && out[out.length - 1].role === role) {
      const last = out[out.length - 1].content;
      if (typeof last === 'string') {
        out[out.length - 1].content = last + '\n\n' + text;
      } else {
        out.push({ role, content: text });
      }
    } else {
      out.push({ role, content: text });
    }
  }
  if (
    out.length > 0 &&
    out[out.length - 1].role === 'user' &&
    typeof out[out.length - 1].content === 'string'
  ) {
    out[out.length - 1].content =
      (out[out.length - 1].content as string) + '\n\n' + currentMessage;
  } else {
    out.push({ role: 'user', content: currentMessage });
  }
  return out;
}
