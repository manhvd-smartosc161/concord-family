import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Fund } from '../../modules/funds/entities/fund.entity';
import { Task } from '../../modules/tasks/entities/task.entity';
import type { TaskAssignee } from '../../modules/tasks/entities/task.entity';
import { User } from '../../modules/users/entities/user.entity';
import { EmailService } from './email.service';

function formatVND(n: number): string {
  const sign = n < 0 ? '−' : '+';
  return `${sign}${Math.abs(n).toLocaleString('vi-VN')}đ`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const ROLE_LABEL: Record<'husband' | 'wife', string> = {
  husband: 'Chồng',
  wife: 'Vợ',
};

const ASSIGNEE_LABEL: Record<TaskAssignee, string> = {
  husband: 'Chồng',
  wife: 'Vợ',
  both: 'Cả hai',
};

const TASK_CATEGORY_LABEL: Record<string, string> = {
  shopping: 'Mua sắm',
  chores: 'Việc nhà',
  finance: 'Tài chính',
  goal: 'Mục tiêu',
  cooking: 'Nấu ăn',
  health: 'Sức khoẻ',
  kids: 'Con cái',
  transport: 'Đi lại',
};

const TASK_STATUS_LABEL: Record<string, string> = {
  todo: 'Chưa làm',
  in_progress: 'Đang làm',
  done: 'Đã xong',
};

interface EmailShell {
  title: string;
  preheader: string;
  bodyHtml: string;
  bodyText: string;
  ctaLabel?: string;
  ctaUrl?: string;
}

function renderShell(shell: EmailShell): { html: string; text: string } {
  const webBase = process.env.WEB_BASE_URL ?? 'http://localhost:3000';
  const cta =
    shell.ctaLabel && shell.ctaUrl
      ? `<p style="margin:24px 0 0;text-align:center"><a href="${shell.ctaUrl}" style="display:inline-block;padding:10px 20px;background:#047857;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">${escapeHtml(shell.ctaLabel)}</a></p>`
      : '';
  const html = `<!doctype html>
<html lang="vi">
<head><meta charset="utf-8" /><title>${escapeHtml(shell.title)}</title></head>
<body style="margin:0;padding:24px 12px;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#1c1917">
  <span style="display:none;visibility:hidden;opacity:0;height:0;width:0">${escapeHtml(shell.preheader)}</span>
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e7e5e4;border-radius:12px;padding:24px">
    <div style="font-size:12px;color:#78716c;letter-spacing:0.04em;text-transform:uppercase">Concord</div>
    <h1 style="margin:8px 0 16px;font-size:18px;font-weight:600">${escapeHtml(shell.title)}</h1>
    ${shell.bodyHtml}
    ${cta}
    <hr style="border:0;border-top:1px solid #e7e5e4;margin:24px 0 12px" />
    <p style="margin:0;font-size:11px;color:#a8a29e">Bạn nhận email này vì là thành viên gia đình trong Concord. <a href="${webBase}/settings" style="color:#78716c">Cài đặt</a></p>
  </div>
</body>
</html>`;
  const text = `${shell.title}\n\n${shell.bodyText}${shell.ctaUrl ? `\n\n${shell.ctaLabel}: ${shell.ctaUrl}` : ''}\n\n— Concord`;
  return { html, text };
}

@Injectable()
export class FamilyEventsNotifier {
  private readonly logger = new Logger(FamilyEventsNotifier.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Fund) private readonly fundRepo: Repository<Fund>,
    private readonly emailService: EmailService,
  ) {}

  private webBase(): string {
    return process.env.WEB_BASE_URL ?? 'http://localhost:3000';
  }

  private async findCounterparts(
    familyId: string,
    excludeUserId: string,
  ): Promise<User[]> {
    return this.userRepo.find({
      where: { familyId },
      select: ['id', 'name', 'email', 'role'],
    }).then((users) => users.filter((u) => u.id !== excludeUserId));
  }

  private async findTaskAssignees(
    task: Task,
    excludeUserId: string,
  ): Promise<User[]> {
    const all = await this.userRepo.find({
      where: { familyId: task.familyId },
      select: ['id', 'name', 'email', 'role'],
    });
    return all.filter((u) => {
      if (u.id === excludeUserId) return false;
      if (task.assignee === 'both') return u.role === 'husband' || u.role === 'wife';
      return u.role === task.assignee;
    });
  }

  private send(to: string, shell: EmailShell): void {
    const { html, text } = renderShell(shell);
    void this.emailService
      .send(to, { subject: shell.title, html, text })
      .catch((err: unknown) => {
        this.logger.error(
          `family-event email failed (${to}): ${err instanceof Error ? err.message : String(err)}`,
        );
      });
  }

  async onTaskCreated(task: Task, actor: User): Promise<void> {
    this.logger.log(`[onTaskCreated] task=${task.id}, actor=${actor.id}, assignee=${task.assignee}`);
    const recipients = await this.findTaskAssignees(task, actor.id);
    this.logger.log(`[onTaskCreated] found ${recipients.length} recipients`);
    if (recipients.length === 0) return;
    const url = `${this.webBase()}/weekly`;
    const category = TASK_CATEGORY_LABEL[task.category] ?? task.category;
    const assigneeText = ASSIGNEE_LABEL[task.assignee];
    for (const r of recipients) {
      this.send(r.email, {
        title: `📝 Task mới: ${task.title}`,
        preheader: `${actor.name} vừa giao một task cho ${assigneeText.toLowerCase()}.`,
        bodyHtml: `<p style="margin:0 0 12px;font-size:14px;line-height:1.5">Xin chào ${escapeHtml(r.name)},</p>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.5"><strong>${escapeHtml(actor.name)}</strong> vừa giao task cho <strong>${escapeHtml(assigneeText)}</strong>:</p>
          <div style="padding:12px 16px;background:#fafaf9;border-left:3px solid #047857;border-radius:6px;font-size:14px;line-height:1.5">
            <div style="font-weight:600;margin-bottom:4px">${escapeHtml(task.title)}</div>
            <div style="font-size:12px;color:#57534e">Danh mục: ${escapeHtml(category)} · Tuần ${escapeHtml(task.weekYear)}</div>
            ${task.note ? `<div style="margin-top:8px;font-size:13px;color:#44403c">${escapeHtml(task.note)}</div>` : ''}
          </div>`,
        bodyText: `${actor.name} vừa giao task "${task.title}" cho ${assigneeText.toLowerCase()} (${category}, tuần ${task.weekYear}).${task.note ? ` Ghi chú: ${task.note}` : ''}`,
        ctaLabel: 'Mở danh sách task',
        ctaUrl: url,
      });
    }
  }

  async onTaskUpdated(
    task: Task,
    actor: User,
    changes: Array<{ field: string; from: string; to: string }>,
  ): Promise<void> {
    if (changes.length === 0) return;
    const recipients = await this.findTaskAssignees(task, actor.id);
    if (recipients.length === 0) return;
    const url = `${this.webBase()}/weekly`;
    const changesHtml = changes
      .map(
        (c) =>
          `<li><strong>${escapeHtml(c.field)}</strong>: ${escapeHtml(c.from)} → ${escapeHtml(c.to)}</li>`,
      )
      .join('');
    const changesText = changes
      .map((c) => `- ${c.field}: ${c.from} → ${c.to}`)
      .join('\n');
    for (const r of recipients) {
      this.send(r.email, {
        title: `✏️ Task được cập nhật: ${task.title}`,
        preheader: `${actor.name} vừa sửa task của bạn.`,
        bodyHtml: `<p style="margin:0 0 12px;font-size:14px;line-height:1.5"><strong>${escapeHtml(actor.name)}</strong> vừa sửa task <strong>${escapeHtml(task.title)}</strong>:</p>
          <ul style="margin:0 0 12px;padding-left:20px;font-size:13px;line-height:1.6;color:#44403c">${changesHtml}</ul>`,
        bodyText: `${actor.name} vừa sửa task "${task.title}":\n${changesText}`,
        ctaLabel: 'Xem task',
        ctaUrl: url,
      });
    }
  }

  async onTaskDeleted(task: Task, actor: User): Promise<void> {
    const recipients = await this.findTaskAssignees(task, actor.id);
    if (recipients.length === 0) return;
    for (const r of recipients) {
      this.send(r.email, {
        title: `🗑️ Task đã bị xoá: ${task.title}`,
        preheader: `${actor.name} đã xoá một task.`,
        bodyHtml: `<p style="margin:0 0 12px;font-size:14px;line-height:1.5"><strong>${escapeHtml(actor.name)}</strong> vừa xoá task <strong>${escapeHtml(task.title)}</strong> (${escapeHtml(ASSIGNEE_LABEL[task.assignee])}, tuần ${escapeHtml(task.weekYear)}).</p>`,
        bodyText: `${actor.name} đã xoá task "${task.title}" (${ASSIGNEE_LABEL[task.assignee]}, tuần ${task.weekYear}).`,
      });
    }
  }

  async onJointTransaction(params: {
    fundId: string;
    amount: number;
    note: string | null;
    categoryName: string | null;
    actor: User;
  }): Promise<void> {
    const fund = await this.fundRepo.findOneBy({ id: params.fundId });
    if (!fund || fund.type !== 'joint') return;
    if (params.note === '__opening_balance__') return;
    const recipients = await this.findCounterparts(fund.familyId, params.actor.id);
    if (recipients.length === 0) return;
    const url = `${this.webBase()}/transactions`;
    const sign = params.amount >= 0 ? 'thu' : 'chi';
    const amountStr = formatVND(params.amount);
    const actorRole = params.actor.role ? ROLE_LABEL[params.actor.role] : params.actor.name;
    for (const r of recipients) {
      this.send(r.email, {
        title: `💰 ${actorRole} vừa ${sign} ${amountStr} vào ${fund.name}`,
        preheader: `${params.note ?? params.categoryName ?? 'Giao dịch chung'}`,
        bodyHtml: `<p style="margin:0 0 12px;font-size:14px;line-height:1.5"><strong>${escapeHtml(params.actor.name)}</strong> vừa ghi một giao dịch vào <strong>${escapeHtml(fund.name)}</strong>:</p>
          <div style="padding:12px 16px;background:#fafaf9;border-left:3px solid #047857;border-radius:6px;font-size:14px;line-height:1.5">
            <div style="font-family:ui-monospace,Menlo,monospace;font-size:16px;font-weight:600;color:${params.amount >= 0 ? '#047857' : '#b91c1c'}">${escapeHtml(amountStr)}</div>
            ${params.categoryName ? `<div style="font-size:12px;color:#57534e;margin-top:2px">Danh mục: ${escapeHtml(params.categoryName)}</div>` : ''}
            ${params.note ? `<div style="margin-top:8px;font-size:13px;color:#44403c">${escapeHtml(params.note)}</div>` : ''}
          </div>`,
        bodyText: `${params.actor.name} vừa ghi ${amountStr} vào ${fund.name}${params.categoryName ? ` (${params.categoryName})` : ''}${params.note ? ` — ${params.note}` : ''}.`,
        ctaLabel: 'Xem giao dịch',
        ctaUrl: url,
      });
    }
  }

  async onJointDebtOpened(params: {
    fundId: string;
    direction: 'lent' | 'borrowed';
    counterpartyName: string;
    principal: number;
    isLegacy: boolean;
    actor: User;
  }): Promise<void> {
    const fund = await this.fundRepo.findOneBy({ id: params.fundId });
    if (!fund || fund.type !== 'joint') return;
    const recipients = await this.findCounterparts(fund.familyId, params.actor.id);
    if (recipients.length === 0) return;
    const url = `${this.webBase()}/debts`;
    const verb =
      params.direction === 'lent'
        ? `cho ${params.counterpartyName} vay`
        : `vay ${params.counterpartyName}`;
    const amountStr = `${params.principal.toLocaleString('vi-VN')}đ`;
    const legacyTag = params.isLegacy ? ' (có sẵn từ trước)' : '';
    const icon = params.direction === 'lent' ? '💸' : '📥';
    for (const r of recipients) {
      this.send(r.email, {
        title: `${icon} ${params.actor.name} ghi nhận khoản ${verb} ${amountStr}${legacyTag}`,
        preheader: `Khoản nợ trên ${fund.name}.`,
        bodyHtml: `<p style="margin:0 0 12px;font-size:14px;line-height:1.5"><strong>${escapeHtml(params.actor.name)}</strong> vừa ghi nhận khoản <strong>${escapeHtml(verb)} ${escapeHtml(amountStr)}</strong>${escapeHtml(legacyTag)} trên <strong>${escapeHtml(fund.name)}</strong>.</p>`,
        bodyText: `${params.actor.name} vừa ghi nhận khoản ${verb} ${amountStr}${legacyTag} trên ${fund.name}.`,
        ctaLabel: 'Xem khoản nợ',
        ctaUrl: url,
      });
    }
  }
}
