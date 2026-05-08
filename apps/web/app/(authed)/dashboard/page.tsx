'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ApiError } from '@/lib/api-client';
import { formatVND } from '@/lib/format';
import { listEnvelopes } from '@/features/funds/api';
import type { FundView } from '@/features/funds/types';
import { listGoals } from '@/features/goals/api';
import type { GoalView } from '@/features/goals/types';
import { getMonthlyReport } from '@/features/reports/api';
import type { MonthlyReport } from '@/features/reports/types';
import {
  deleteTransaction,
  listRecentTransactions,
} from '@/features/transactions/api';
import type { TransactionView } from '@/features/transactions/types';
import { useAuthedLayout } from '../layout';
import { pickFundIcon } from '@/features/funds/components/fund-card';
import { EditTransactionModal } from '@/features/transactions/components/edit-transaction-modal';
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  ProgressBar,
  Skeleton,
  StatCard,
} from '@/components/ui';

export default function DashboardPage() {
  const { user, funds, reloadFunds } = useAuthedLayout();
  const [goals, setGoals] = useState<GoalView[]>([]);
  const [envelopes, setEnvelopes] = useState<FundView[]>([]);
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [recent, setRecent] = useState<TransactionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTxn, setEditTxn] = useState<TransactionView | null>(null);

  const reload = async () => {
    const now = new Date();
    const [g, e, r, t] = await Promise.all([
      listGoals(),
      listEnvelopes(),
      getMonthlyReport(now.getFullYear(), now.getMonth() + 1, 'joint'),
      listRecentTransactions(8),
    ]);
    setGoals(g);
    setEnvelopes(e.filter((env) => !env.archivedAt));
    setReport(r);
    setRecent(t);
  };

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  async function handleDeleteTxn(id: string) {
    if (
      !confirm('Xoá giao dịch này? Số dư quỹ sẽ được hoàn lại.')
    )
      return;
    try {
      await deleteTransaction(id);
      // Reload funds (sidebar) + dashboard data
      await Promise.all([reloadFunds(), reload()]);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Lỗi không xác định';
      alert(`Không xoá được: ${msg}`);
    }
  }

  const totalVisible =
    funds
      .filter((f) => f.balance !== null)
      .reduce((sum, f) => sum + (f.balance ?? 0), 0) ?? 0;

  const yearlyGoal = goals.find((g) => g.period === 'year' && g.type === 'save');

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title={`Chào ${user.name} 👋`}
        subtitle={`Hôm nay là ${new Date().toLocaleDateString('vi-VN', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}`}
      />

      <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-6">
        <div className="mx-auto max-w-6xl space-y-6">
          {/* Goal hero (legacy) */}
          {yearlyGoal && <GoalHero goal={yearlyGoal} />}
          {loading && !yearlyGoal && envelopes.length === 0 && (
            <Skeleton className="h-32 w-full rounded-xl" />
          )}

          {/* Envelopes summary */}
          {envelopes.length > 0 && <EnvelopesBlock envelopes={envelopes} />}

          {/* Month stats */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Tháng này — thu"
              value={report ? formatVND(report.income) : '—'}
              tone="positive"
              hint={`${report?.txnCount ?? 0} giao dịch tổng`}
            />
            <StatCard
              label="Tháng này — chi"
              value={report ? `−${formatVND(report.expense)}` : '—'}
              tone="negative"
              hint={
                report
                  ? `${report.byCategory.length} mục có chi tiêu`
                  : undefined
              }
            />
            <StatCard
              label="Tháng này — net"
              value={report ? formatVND(report.net, true) : '—'}
              tone={
                !report ? 'default' : report.net >= 0 ? 'positive' : 'negative'
              }
              hint="Thu trừ chi"
            />
          </div>

          {/* Funds + Recent txns */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.2fr]">
            <FundsBlock totalVisible={totalVisible} funds={funds} />
            <RecentBlock
              recent={recent}
              loading={loading}
              onEdit={(t) => setEditTxn(t)}
              onDelete={handleDeleteTxn}
            />
          </div>
        </div>
      </div>

      <EditTransactionModal
        open={editTxn !== null}
        txn={editTxn}
        funds={funds}
        onClose={() => setEditTxn(null)}
        onSaved={() => {
          void Promise.all([reloadFunds(), reload()]);
        }}
      />
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────

function GoalHero({ goal }: { goal: GoalView }) {
  const pctRaw = (goal.currentProgress / Math.max(goal.targetAmount, 1)) * 100;
  const pct = Math.max(0, Math.min(100, pctRaw));
  const tone =
    goal.paceStatus === 'ahead'
      ? 'emerald'
      : goal.paceStatus === 'on_track'
        ? 'amber'
        : 'rose';
  const paceLabel = {
    ahead: 'Đang vượt tiến độ',
    on_track: 'Đúng tiến độ',
    behind: 'Đang chậm',
  }[goal.paceStatus];
  const paceTone = {
    ahead: 'emerald',
    on_track: 'amber',
    behind: 'rose',
  }[goal.paceStatus] as 'emerald' | 'amber' | 'rose';

  return (
    <Card padding="p-6" className="bg-gradient-to-br from-emerald-50 to-white">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wide text-emerald-700">
            Mục tiêu năm {new Date(goal.startDate).getFullYear()}
          </div>
          <div className="mt-0.5 text-base font-semibold text-stone-800">
            Tiết kiệm {formatVND(goal.targetAmount)} cùng nhau
          </div>
        </div>
        <Badge tone={paceTone}>{paceLabel}</Badge>
      </div>

      <div className="mb-1 flex items-baseline justify-between">
        <span className="font-mono text-3xl font-semibold tabular-nums text-stone-900">
          {formatVND(goal.currentProgress)}
        </span>
        <span className="text-sm text-stone-500">
          / {formatVND(goal.targetAmount)}
          <span className="ml-2 text-xs text-stone-400">
            ({pctRaw.toFixed(1)}%)
          </span>
        </span>
      </div>
      <ProgressBar value={pct} max={100} tone={tone} />
      <p className="mt-1.5 text-[10px] text-stone-400">
        Tính theo dòng tiền vào quỹ tiết kiệm & đầu tư trong năm
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 border-t border-stone-100 pt-4 sm:grid-cols-3">
        <Stat
          label="Còn lại"
          value={formatVND(Math.max(0, goal.targetAmount - goal.currentProgress))}
        />
        <Stat label="Còn ngày" value={`${goal.daysRemaining} ngày`} />
        <Stat
          label="Dự kiến cuối kỳ"
          value={formatVND(goal.projection)}
          hint={
            goal.projection >= goal.targetAmount ? 'Đạt mục tiêu' : 'Hụt mục tiêu'
          }
        />
      </div>
    </Card>
  );
}

function EnvelopesBlock({ envelopes }: { envelopes: FundView[] }) {
  return (
    <Card>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-stone-800">
          Quỹ mục tiêu
        </h3>
        <Link
          href="/goals"
          className="text-xs text-emerald-700 hover:text-emerald-900"
        >
          Quản lý →
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {envelopes.map((env) => (
          <EnvelopeMiniCard key={env.id} env={env} />
        ))}
      </div>
    </Card>
  );
}

function EnvelopeMiniCard({ env }: { env: FundView }) {
  const balance = env.balance ?? 0;
  const target = env.targetAmount ?? 0;
  const hasTarget = target > 0;
  const progress = env.progress;
  const pct = progress?.percent ?? (hasTarget ? (balance / target) * 100 : 0);
  const pctClamped = Math.max(0, Math.min(100, pct));
  const reached = progress?.reached ?? false;

  const tone = reached
    ? 'emerald'
    : progress?.paceStatus === 'behind'
      ? 'rose'
      : pctClamped >= 70
        ? 'emerald'
        : pctClamped >= 30
          ? 'amber'
          : 'rose';

  const monthlyTarget = env.monthlyContributionTarget ?? 0;
  const monthInflow = progress?.monthContribution ?? 0;
  const hasMonthly = monthlyTarget > 0;
  const monthReached = hasMonthly && monthInflow >= monthlyTarget;

  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50/50 px-4 py-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium text-stone-800">
          {env.name}
        </span>
        {reached && (
          <span className="shrink-0 text-[10px] font-semibold text-emerald-700">
            ✅ Đạt
          </span>
        )}
        {!reached && progress?.paceStatus === 'behind' && (
          <span className="shrink-0 text-[10px] font-semibold text-rose-700">
            ⚠ Chậm
          </span>
        )}
        {!reached && progress?.paceStatus === 'ahead' && (
          <span className="shrink-0 text-[10px] font-semibold text-emerald-700">
            ✓ Vượt
          </span>
        )}
      </div>
      <div className="mb-1 flex items-baseline justify-between font-mono text-xs tabular-nums">
        <span className="font-semibold text-stone-900">
          {formatVND(balance)}
        </span>
        {hasTarget && (
          <span className="text-stone-500">
            / {formatVND(target)}{' '}
            <span className="text-stone-400">({pct.toFixed(0)}%)</span>
          </span>
        )}
      </div>
      {hasTarget && <ProgressBar value={pctClamped} max={100} tone={tone} />}
      {progress?.daysRemaining != null && (
        <div className="mt-1 text-[10px] text-stone-500">
          Còn {progress.daysRemaining} ngày
        </div>
      )}
      {hasMonthly && (
        <div className="mt-2 border-t border-stone-200 pt-2 text-[11px]">
          <span className={monthReached ? 'text-emerald-700' : 'text-amber-700'}>
            Tháng này: {formatVND(monthInflow)} / {formatVND(monthlyTarget)}
            {monthReached ? ' ✅' : ''}
          </span>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-stone-500">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-base font-semibold tabular-nums text-stone-800">
        {value}
      </div>
      {hint && <div className="text-[11px] text-stone-400">{hint}</div>}
    </div>
  );
}

function FundsBlock({
  totalVisible,
  funds,
}: {
  totalVisible: number;
  funds: ReturnType<typeof useAuthedLayout>['funds'];
}) {
  return (
    <Card>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-stone-800">Số dư quỹ</h3>
        <span className="font-mono text-xs tabular-nums text-stone-500">
          Tổng (bạn thấy được): {formatVND(totalVisible)}
        </span>
      </div>
      {(() => {
        const sorted = [...funds].sort((a, b) => {
          if (a.purpose !== b.purpose) {
            return a.purpose === 'spending' ? -1 : 1;
          }
          return a.name.localeCompare(b.name, 'vi');
        });
        const spendingFunds = sorted.filter((f) => f.purpose === 'spending');
        const goalFunds = sorted.filter(
          (f) => f.purpose === 'savings' || f.purpose === 'investment',
        );
        const renderFund = (f: (typeof funds)[number]) => {
          const isPrivate = f.accessLevel === 'private';
          const tone = {
            owner: 'border-emerald-100 bg-emerald-50/40',
            joint: 'border-amber-100 bg-amber-50/40',
            private: 'border-stone-200 bg-stone-50',
          }[f.accessLevel];
          return (
            <div
              key={f.id}
              className={`flex items-center justify-between rounded-lg border ${tone} px-3 py-2.5`}
            >
              <span className="flex items-center gap-2 text-sm font-medium text-stone-700">
                <span>{pickFundIcon(f)}</span> {f.name}
              </span>
              <span className="font-mono text-sm font-semibold tabular-nums">
                {isPrivate ? (
                  <span className="text-stone-300">— — — đ</span>
                ) : (
                  <span className="text-stone-900">
                    {formatVND(f.balance ?? 0)}
                  </span>
                )}
              </span>
            </div>
          );
        };
        return (
          <div className="space-y-2">
            {spendingFunds.map(renderFund)}
            {goalFunds.length > 0 && (
              <>
                <p className="pt-1 text-[10px] font-medium uppercase tracking-wider text-stone-400">
                  Tiết kiệm & đầu tư
                </p>
                {goalFunds.map(renderFund)}
              </>
            )}
          </div>
        );
      })()}
    </Card>
  );
}

function RecentBlock({
  recent,
  loading,
  onEdit,
  onDelete,
}: {
  recent: TransactionView[];
  loading: boolean;
  onEdit: (t: TransactionView) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-stone-800">
          Giao dịch gần đây
        </h3>
        <Link
          href="/chat"
          className="text-xs text-emerald-700 hover:text-emerald-900"
        >
          + Thêm qua chat
        </Link>
      </div>
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      )}
      {!loading && recent.length === 0 && (
        <EmptyState
          icon="📭"
          title="Chưa có giao dịch nào"
          description="Vào tab Chat để gõ giao dịch tự nhiên — agent sẽ log vào quỹ tương ứng."
        />
      )}
      {!loading &&
        recent.map((t) => (
          <TxnRow
            key={t.id}
            t={t}
            onEdit={() => onEdit(t)}
            onDelete={() => onDelete(t.id)}
          />
        ))}
    </Card>
  );
}

function TxnRow({
  t,
  onEdit,
  onDelete,
}: {
  t: TransactionView;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isExpense = t.amount < 0;
  return (
    <div className="group flex items-center justify-between border-b border-stone-100 py-2 last:border-0">
      <div className="flex items-center gap-2.5">
        <span className="text-base">
          {t.category?.icon ?? (isExpense ? '💸' : '💰')}
        </span>
        <div className="leading-tight">
          <div className="text-sm text-stone-800">
            {t.note ?? t.category?.name ?? '(không ghi chú)'}
          </div>
          <div className="text-[11px] text-stone-500">
            {t.fund.name}
            {t.category && ` • ${t.category.name}`} •{' '}
            {new Date(t.date).toLocaleDateString('vi-VN', {
              day: '2-digit',
              month: '2-digit',
            })}{' '}
            • {t.loggedBy.name}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`font-mono text-sm font-semibold tabular-nums ${
            isExpense ? 'text-rose-700' : 'text-emerald-700'
          }`}
        >
          {formatVND(t.amount, true)}
        </span>
        <div className="flex items-center gap-1 sm:invisible sm:group-hover:visible">
          <button
            onClick={onEdit}
            aria-label="Sửa giao dịch"
            title="Sửa quỹ / số tiền / category"
            className="rounded-md p-1 text-stone-400 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>
          <button
            onClick={onDelete}
            aria-label="Xoá giao dịch"
            title="Xoá + hoàn lại số dư"
            className="rounded-md p-1 text-stone-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
