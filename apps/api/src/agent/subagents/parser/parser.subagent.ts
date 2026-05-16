import * as fs from 'fs';
import * as path from 'path';
import type Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Category } from '../../../modules/categories/entities/category.entity';
import { CategoriesService } from '../../../modules/categories/categories.service';
import { DebtPaymentsService } from '../../../modules/debts/debt-payments.service';
import { DebtsService } from '../../../modules/debts/debts.service';
import { Fund } from '../../../modules/funds/entities/fund.entity';
import { ImportantDate } from '../../../modules/important-dates/entities/important-date.entity';
import { TransactionsService } from '../../../modules/transactions/transactions.service';
import { User } from '../../../modules/users/entities/user.entity';
import { AnthropicService } from '../../core/anthropic.service';
import {
  AskClarificationInput,
  CreateCategoryInput,
  DeleteTransactionInput,
  LogDebtPaymentInput,
  LogTransactionInput,
  ProposeImportantDateInput,
  ProposeNewDebtInput,
  UpdateTransactionInput,
  parserTools,
} from './parser.tools';

export type ParseAction =
  | {
      kind: 'logged';
      id: string;
      fundName: string;
      amount: number;
      categoryName: string | null;
      balance: number;
    }
  | {
      kind: 'updated';
      id: string;
      fundName: string;
      amount: number;
      categoryName: string | null;
    }
  | { kind: 'deleted'; id: string }
  | { kind: 'clarify'; question: string }
  | {
      kind: 'category_created';
      name: string;
      isEssential: boolean;
      parentName: string | null;
    }
  | { kind: 'tool_error'; toolName: string; message: string }
  | {
      kind: 'important_date_proposed';
      name: string;
      type: 'birthday' | 'death_anniversary' | 'anniversary' | 'other';
      date: string;
      isLunar: boolean;
      remindDaysBefore: number[];
      notes: string | null;
    }
  | {
      kind: 'debt_payment_logged';
      debtId: string;
      counterparty: string;
      amount: number;
      fundName: string;
      outstanding: number;
      direction: 'i_owe' | 'they_owe_me';
      txnId: string | null;
    }
  | {
      kind: 'debt_created';
      debtId: string;
      counterparty: string;
      principal: number;
      direction: 'i_owe' | 'they_owe_me';
      visibility: 'private' | 'shared';
    };

export interface ParseResult {
  reply: string;
  actions: ParseAction[];
  stopReason: string | null;
  usage: { inputTokens: number; outputTokens: number };
}

@Injectable()
export class ParserSubagent {
  private readonly logger = new Logger(ParserSubagent.name);
  private readonly skill: string;

  constructor(
    private readonly anthropic: AnthropicService,
    private readonly transactionsService: TransactionsService,
    private readonly categoriesService: CategoriesService,
    private readonly debtsService: DebtsService,
    private readonly debtPaymentsService: DebtPaymentsService,
    @InjectRepository(Fund)
    private readonly fundRepo: Repository<Fund>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(ImportantDate)
    private readonly importantDateRepo: Repository<ImportantDate>,
  ) {
    const skillPath = path.join(__dirname, 'skill.md');
    this.skill = fs.readFileSync(skillPath, 'utf8');
  }

  async parse(
    message: string,
    user: User,
    options?: {
      defaultFundName?: string;
      history?: Array<{ role: 'user' | 'agent'; text: string }>;
    },
  ): Promise<ParseResult> {
    const context = await this.buildContext(user, options?.defaultFundName);
    const messages = buildMessages(options?.history ?? [], message);

    const response = await this.anthropic.client.messages.create({
      model: this.anthropic.fastModel,
      max_tokens: 4096,
      system: [
        // Static portion → cacheable (saves ~90% of input cost on repeat calls).
        {
          type: 'text',
          text: this.skill,
          cache_control: { type: 'ephemeral' },
        },
        // Dynamic portion (changes per request).
        { type: 'text', text: context },
      ],
      tools: parserTools,
      // Buộc model phải gọi 1 trong 4 tool, không cho emit text-only reply
      // (model hay hallucinate "✅ Đã ghi..." mà không thực sự log).
      tool_choice: { type: 'any' },
      messages,
    });

    return this.handleResponse(response, user, message);
  }

  /** Build the dynamic context block (current user, visible funds, category list). */
  private async buildContext(
    user: User,
    defaultFundName?: string,
  ): Promise<string> {
    const recentTxns = await this.transactionsService.lastLoggedByUser(
      user.id,
      5,
    );
    const recentLines = recentTxns.length
      ? recentTxns.map((t) => {
          const sign = t.amount >= 0 ? '+' : '−';
          const abs = Math.abs(t.amount).toLocaleString('vi-VN');
          const cat = t.category?.name ?? '(no category)';
          const note = t.note ? ` — "${t.note}"` : '';
          const ts = t.createdAt.toLocaleString('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
          });
          return `  - id=\`${t.id}\` · ${t.fund.name} · ${sign}${abs}đ · ${cat}${note} · log lúc ${ts}`;
        })
      : ['  (chưa có giao dịch nào trước đó)'];
    const allFamilyFunds = await this.fundRepo.find({
      where: { familyId: user.familyId! },
      order: { type: 'ASC', name: 'ASC' },
    });
    const writableFunds = allFamilyFunds.filter(
      (f) => f.type === 'joint' || f.ownerId === user.id,
    );

    // Top-level categories with their children (compact tree).
    const tops = await this.categoryRepo.find({
      where: { familyId: user.familyId!, parentId: IsNull() },
      order: { name: 'ASC' },
    });
    const tree: string[] = [];
    for (const top of tops) {
      const children = await this.categoryRepo.find({
        where: { parentId: top.id },
        order: { name: 'ASC' },
      });
      const childNames = children.map((c) => c.name).join(', ');
      tree.push(`  - ${top.icon ?? '•'} ${top.name}: ${childNames}`);
    }

    const nowVN = new Date().toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
    });

    const defaultFundLine = defaultFundName
      ? [
          '',
          `### 🎯 Cuộc hội thoại này gắn với quỹ: **"${defaultFundName}"**`,
          `→ Khi user KHÔNG nói rõ quỹ nào, mặc định dùng **${defaultFundName}**.`,
          `→ Vẫn tuân thủ rule semantic (lương → quỹ riêng người nhận; "đưa vợ" → transfer 2 leg).`,
        ]
      : [];

    const existingDates = await this.importantDateRepo.find({
      where: { familyId: user.familyId! },
      order: { date: 'ASC' },
    });
    const existingDatesLines = existingDates.length
      ? existingDates.map((d) => {
          const lunar = d.isLunar ? ' (âm)' : '';
          return `  - "${d.name}" — ${d.date}${lunar} (${d.type})`;
        })
      : ['  (chưa có ngày nào trong hệ thống)'];

    const openDebts = await this.debtsService.listForUser(user, { status: 'open' });
    const openDebtLines = openDebts.length
      ? openDebts.map((d) => {
          const dir = d.direction === 'i_owe' ? 'tôi nợ' : 'cho vay';
          const vis = d.visibility === 'shared' ? '👥' : '🔒';
          return `  - id=\`${d.id}\` · ${vis} ${dir} "${d.counterparty}" · còn ${d.outstanding.toLocaleString('vi-VN')}đ`;
        })
      : ['  (chưa có khoản nợ/cho vay nào)'];

    return [
      '## Current Context',
      '',
      `- Current user: **${user.name}** (role: ${user.role === 'husband' ? 'chồng' : 'vợ'})`,
      `- Now: ${nowVN} (Asia/Ho_Chi_Minh)`,
      ...defaultFundLine,
      '',
      '### Quỹ user CÓ THỂ ghi vào',
      ...writableFunds.map(
        (f) =>
          `  - **"${f.name}"** (${f.type === 'joint' ? 'chung' : 'riêng'}, balance hiện tại: ${(
            f.balance ?? 0
          ).toLocaleString('vi-VN')}đ)`,
      ),
      '',
      '### Categories có sẵn (top-level: sub-categories)',
      ...tree,
      '',
      '> Khi gọi log_transaction, dùng EXACT fundName từ list trên.',
      '> categoryName có thể là tên top-level HOẶC sub-category.',
      '> KHÔNG bịa fund mới.',
      '> Nếu user yêu cầu category mới (hoặc không có category phù hợp), dùng create_category.',
      '> Hỏi xác nhận trước bằng ask_clarification (trừ khi user đã nói rõ ràng muốn tạo).',
      '',
      '### Giao dịch user vừa log (để update_transaction / delete_transaction)',
      ...recentLines,
      '',
      '### Ngày quan trọng đã có trong hệ thống',
      ...existingDatesLines,
      '',
      '> Khi gọi propose_important_date, kiểm tra xem ngày đó đã có trong list trên chưa.',
      '> Nếu name + date trùng (cùng tên + cùng ngày DD/MM) → KHÔNG propose lại và KHÔNG nhắc tới ngày đó trong reply (BE sẽ tự bỏ qua, đừng làm noise).',
      '> KHÔNG re-propose nội dung từ history (turn cũ). Chỉ xử lý các ngày user nhắc trong CURRENT message.',
      '',
      '### Khoản nợ / cho vay đang mở',
      ...openDebtLines,
      '',
      '> Khi user nói "trả X", "trả nợ Y", "trả thẻ Z", "nhận lại N từ A" → match với list trên và gọi log_debt_payment với debtId EXACT.',
      '> Khi user phát sinh khoản nợ/cho vay MỚI (không có trong list) → gọi propose_new_debt.',
      '> Nếu user không nói rõ trả từ quỹ nào → dùng ask_clarification, KHÔNG bịa quỹ.',
      '> Nếu nhiều debt cùng counterparty → chọn theo hướng phù hợp ("trả" = i_owe, "nhận từ" = they_owe_me).',
    ].join('\n');
  }

  private async findDuplicateImportantDate(
    name: string,
    date: string,
    isLunar: boolean,
    familyId: string,
  ): Promise<{ name: string; date: string; isLunar: boolean } | null> {
    const all = await this.importantDateRepo.find({ where: { familyId } });
    const normName = name.trim().toLowerCase();
    const monthDay = date.slice(5);
    for (const d of all) {
      if (d.isLunar !== isLunar) continue;
      if (d.date.slice(5) !== monthDay) continue;
      if (d.name.trim().toLowerCase() !== normName) continue;
      return { name: d.name, date: d.date, isLunar: d.isLunar };
    }
    return null;
  }

  private async handleResponse(
    response: Anthropic.Message,
    user: User,
    rawText: string,
  ): Promise<ParseResult> {
    const actions: ParseAction[] = [];
    const replyParts: string[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        replyParts.push(block.text);
      } else if (block.type === 'tool_use') {
        if (block.name === 'log_transaction') {
          const input = block.input as LogTransactionInput;
          try {
            const { txn, fund, category } =
              await this.transactionsService.createFromAgent(
                input,
                user,
                rawText,
              );
            actions.push({
              kind: 'logged',
              id: txn.id,
              fundName: fund.name,
              amount: input.amount,
              categoryName: category?.name ?? null,
              balance: fund.balance,
            });
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.warn(`log_transaction failed: ${msg}`);
            actions.push({
              kind: 'tool_error',
              toolName: 'log_transaction',
              message: msg,
            });
          }
        } else if (block.name === 'ask_clarification') {
          const input = block.input as AskClarificationInput;
          actions.push({ kind: 'clarify', question: input.question });
        } else if (block.name === 'update_transaction') {
          const input = block.input as UpdateTransactionInput;
          try {
            const view = await this.transactionsService.updateFromAgent(
              input.txn_id,
              user,
              {
                fundName: input.fundName,
                amount: input.amount,
                categoryName: input.categoryName,
                note: input.note,
              },
            );
            actions.push({
              kind: 'updated',
              id: view.id,
              fundName: view.fund.name,
              amount: view.amount,
              categoryName: view.category?.name ?? null,
            });
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.warn(`update_transaction failed: ${msg}`);
            actions.push({
              kind: 'tool_error',
              toolName: 'update_transaction',
              message: msg,
            });
          }
        } else if (block.name === 'delete_transaction') {
          const input = block.input as DeleteTransactionInput;
          try {
            await this.transactionsService.deleteForUser(input.txn_id, user);
            actions.push({ kind: 'deleted', id: input.txn_id });
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.warn(`delete_transaction failed: ${msg}`);
            actions.push({
              kind: 'tool_error',
              toolName: 'delete_transaction',
              message: msg,
            });
          }
        } else if (block.name === 'create_category') {
          const input = block.input as CreateCategoryInput;
          try {
            const category = await this.categoriesService.createCategory(
              {
                name: input.name,
                icon: input.icon,
                isEssential: input.isEssential,
                parentName: input.parentName,
              },
              user,
            );
            actions.push({
              kind: 'category_created',
              name: category.name,
              isEssential: category.isEssential,
              parentName: input.parentName ?? null,
            });
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.warn(`create_category failed: ${msg}`);
            actions.push({
              kind: 'tool_error',
              toolName: 'create_category',
              message: msg,
            });
          }
        } else if (block.name === 'propose_important_date') {
          try {
            const input = block.input as ProposeImportantDateInput;
            if (!input?.name || !input?.date) {
              throw new Error('thiếu name hoặc date');
            }
            const isLunar = input.isLunar ?? false;
            const duplicate = await this.findDuplicateImportantDate(
              input.name,
              input.date,
              isLunar,
              user.familyId!,
            );
            if (!duplicate) {
              actions.push({
                kind: 'important_date_proposed',
                name: input.name,
                type: input.type ?? 'other',
                date: input.date,
                isLunar,
                remindDaysBefore:
                  Array.isArray(input.remindDaysBefore) &&
                  input.remindDaysBefore.length > 0
                    ? input.remindDaysBefore
                    : [0, 2],
                notes: input.notes ?? null,
              });
            }
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.warn(`propose_important_date failed: ${msg}`);
            actions.push({
              kind: 'tool_error',
              toolName: 'propose_important_date',
              message: msg,
            });
          }
        } else if (block.name === 'log_debt_payment') {
          const input = block.input as LogDebtPaymentInput;
          try {
            const debt = await this.debtsService.findByIdRaw(input.debtId);
            if (!debt || debt.familyId !== user.familyId) {
              throw new Error('Không tìm thấy khoản nợ');
            }
            this.debtsService.assertCanEdit(debt, user);
            const fund = await this.fundRepo.findOne({
              where: { name: input.fundName, familyId: user.familyId! },
            });
            if (!fund) {
              throw new Error(`Không tìm thấy quỹ "${input.fundName}"`);
            }
            const txnAmount =
              debt.direction === 'i_owe' ? -input.amount : input.amount;
            const txnCategoryName =
              debt.direction === 'i_owe' ? 'Trả nợ' : 'Nhận trả nợ';
            const { txn } = await this.transactionsService.createFromAgent(
              {
                fundName: fund.name,
                amount: txnAmount,
                categoryName: txnCategoryName,
                note: `${debt.direction === 'i_owe' ? 'Trả' : 'Nhận từ'} ${debt.counterparty}`,
                date: input.paidAt,
              },
              user,
              rawText,
            );
            const payment = await this.debtPaymentsService.create(
              user,
              debt.id,
              {
                amount: input.amount,
                paidAt: input.paidAt ?? new Date().toISOString(),
                transactionId: txn.id,
                note: input.note,
              },
            );
            const refreshed = await this.debtsService.findByIdRaw(debt.id);
            actions.push({
              kind: 'debt_payment_logged',
              debtId: debt.id,
              counterparty: debt.counterparty,
              amount: input.amount,
              fundName: fund.name,
              outstanding: refreshed?.outstanding ?? 0,
              direction: debt.direction,
              txnId: payment.transactionId,
            });
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.warn(`log_debt_payment failed: ${msg}`);
            actions.push({
              kind: 'tool_error',
              toolName: 'log_debt_payment',
              message: msg,
            });
          }
        } else if (block.name === 'propose_new_debt') {
          const input = block.input as ProposeNewDebtInput;
          try {
            const view = await this.debtsService.create(user, {
              direction: input.direction,
              counterparty: input.counterparty,
              principal: input.principal,
              visibility: input.visibility ?? 'private',
              dueDate: input.dueDate,
              note: input.note,
            });
            actions.push({
              kind: 'debt_created',
              debtId: view.id,
              counterparty: view.counterparty,
              principal: view.principal,
              direction: view.direction,
              visibility: view.visibility,
            });
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.warn(`propose_new_debt failed: ${msg}`);
            actions.push({
              kind: 'tool_error',
              toolName: 'propose_new_debt',
              message: msg,
            });
          }
        }
      }
    }

    let reply = replyParts.join('').trim();
    // The model often emits only tool_use blocks with no text when stop_reason
    // is "tool_use". Synthesize a deterministic confirmation from the actions
    // we just executed — cheaper than a follow-up Claude call.
    if (!reply) reply = synthesizeReply(actions);

    return {
      reply,
      actions,
      stopReason: response.stop_reason ?? null,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }
}

/**
 * Convert chat history (role='user'|'agent') sang Anthropic messages format.
 * Skip empty texts. Đảm bảo array kết thúc bằng user turn (current message);
 * nếu history kết thúc bằng user, history's trailing user turn được giữ và
 * current message append thêm vào cuối — nhưng chuẩn flow là history luôn
 * end ở agent vì current user message chưa được append vào history khi gọi.
 */
function buildMessages(
  history: Array<{ role: 'user' | 'agent'; text: string }>,
  currentMessage: string,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const out: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (const h of history) {
    const text = h.text?.trim();
    if (!text) continue;
    const role = h.role === 'agent' ? 'assistant' : 'user';
    if (out.length > 0 && out[out.length - 1].role === role) {
      out[out.length - 1].content += '\n\n' + text;
    } else {
      out.push({ role, content: text });
    }
  }
  if (out.length > 0 && out[out.length - 1].role === 'user') {
    out[out.length - 1].content += '\n\n' + currentMessage;
  } else {
    out.push({ role: 'user', content: currentMessage });
  }
  return out;
}

function synthesizeReply(actions: ParseAction[]): string {
  if (actions.length === 0) {
    return 'Tôi chưa hiểu yêu cầu. Thử gõ rõ số tiền + quỹ + nội dung nhé.';
  }
  const logged = actions.filter(
    (a): a is Extract<ParseAction, { kind: 'logged' }> => a.kind === 'logged',
  );
  const updated = actions.filter(
    (a): a is Extract<ParseAction, { kind: 'updated' }> => a.kind === 'updated',
  );
  const deleted = actions.filter(
    (a): a is Extract<ParseAction, { kind: 'deleted' }> => a.kind === 'deleted',
  );
  const clarifies = actions.filter(
    (a): a is Extract<ParseAction, { kind: 'clarify' }> => a.kind === 'clarify',
  );
  const categoryCreated = actions.filter(
    (a): a is Extract<ParseAction, { kind: 'category_created' }> =>
      a.kind === 'category_created',
  );
  const errors = actions.filter(
    (a): a is Extract<ParseAction, { kind: 'tool_error' }> =>
      a.kind === 'tool_error',
  );

  const parts: string[] = [];
  if (logged.length === 1) {
    const a = logged[0];
    parts.push(
      `✅ Đã ghi: ${formatVND(a.amount, true)} • ${a.fundName}` +
        (a.categoryName ? ` • ${a.categoryName}` : ''),
    );
  } else if (logged.length > 1) {
    parts.push(`✅ Đã ghi ${logged.length} giao dịch.`);
  }
  if (updated.length > 0) {
    for (const u of updated) {
      parts.push(
        `🔧 Đã sửa: ${formatVND(u.amount, true)} • ${u.fundName}` +
          (u.categoryName ? ` • ${u.categoryName}` : ''),
      );
    }
  }
  if (deleted.length > 0) {
    parts.push(
      deleted.length === 1
        ? '🗑️ Đã xoá giao dịch.'
        : `🗑️ Đã xoá ${deleted.length} giao dịch.`,
    );
  }
  if (clarifies.length > 0) {
    parts.push(...clarifies.map((c) => `❓ ${c.question}`));
  }
  if (categoryCreated.length > 0) {
    for (const c of categoryCreated) {
      const essentialLabel = c.isEssential ? 'thiết yếu' : 'không thiết yếu';
      const parentPart = c.parentName
        ? ` (thuộc ${c.parentName})`
        : ' (danh mục cha)';
      parts.push(
        `✨ Đã tạo category: **${c.name}**${parentPart} — ${essentialLabel}`,
      );
    }
  }
  const debtPayments = actions.filter(
    (a): a is Extract<ParseAction, { kind: 'debt_payment_logged' }> =>
      a.kind === 'debt_payment_logged',
  );
  for (const p of debtPayments) {
    const verb = p.direction === 'i_owe' ? 'trả' : 'nhận';
    const status = p.outstanding === 0 ? ' — đã tất toán ✅' : ` (còn ${formatVND(p.outstanding)})`;
    parts.push(
      `💳 Đã ${verb} ${formatVND(p.amount)} cho **${p.counterparty}** từ ${p.fundName}${status}`,
    );
  }
  const debtCreated = actions.filter(
    (a): a is Extract<ParseAction, { kind: 'debt_created' }> =>
      a.kind === 'debt_created',
  );
  for (const d of debtCreated) {
    const verb = d.direction === 'i_owe' ? 'nợ' : 'cho vay';
    parts.push(
      `📒 Đã ghi khoản ${verb}: **${d.counterparty}** — ${formatVND(d.principal)}`,
    );
  }
  if (errors.length > 0) {
    parts.push(...errors.map((e) => `⚠️ ${e.message}`));
  }
  return parts.join('\n');
}

function formatVND(n: number, withSign = false): string {
  const formatted = Math.abs(n).toLocaleString('vi-VN');
  if (n < 0) return `−${formatted}đ`;
  if (n === 0 || !withSign) return `${formatted}đ`;
  return `+${formatted}đ`;
}
