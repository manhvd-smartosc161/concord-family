'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ApiError } from '@/lib/api-client';
import { formatVND } from '@/lib/format';
import {
  archiveEnvelope,
  createEnvelope,
  listEnvelopes,
  unarchiveEnvelope,
  updateEnvelope,
} from '@/features/funds/api';
import type {
  CreateEnvelopePayload,
  FundView,
  UpdateEnvelopePayload,
} from '@/features/funds/types';
import { listTransactions } from '@/features/transactions/api';
import type { TransactionView } from '@/features/transactions/types';
import { useAuthedLayout } from '../layout';
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  ProgressBar,
  Skeleton,
} from '@/components/ui';

export default function GoalsPage() {
  const t = useTranslations('goals');
  const tCommon = useTranslations('common');
  const { reloadFunds } = useAuthedLayout();
  const [envelopes, setEnvelopes] = useState<FundView[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);

  async function reload() {
    const list = await listEnvelopes();
    setEnvelopes(list);
  }

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  const active = envelopes.filter((e) => !e.archivedAt);
  const archived = envelopes.filter((e) => e.archivedAt);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <button
            onClick={() => setEditingId('new')}
            className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-emerald-800 active:scale-[0.98]"
          >
            {t('create_fund')}
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-6">
        <div className="mx-auto max-w-4xl space-y-4">
          {loading && (
            <>
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
            </>
          )}

          {!loading && active.length === 0 && archived.length === 0 && (
            <Card>
              <EmptyState
                icon="🐷"
                title={t('no_goals')}
                description={t('no_goals_desc')}
              />
            </Card>
          )}

          {active.map((env) => (
            <EnvelopeCard
              key={env.id}
              envelope={env}
              onEdit={() => setEditingId(env.id)}
              onArchive={async () => {
                if (!confirm(`Archive "${env.name}"?`)) return;
                await archiveEnvelope(env.id);
                await Promise.all([reload(), reloadFunds()]);
              }}
            />
          ))}

          {archived.length > 0 && (
            <details className="mt-6">
              <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-stone-500 hover:text-stone-700">
                Đã archive ({archived.length})
              </summary>
              <div className="mt-3 space-y-3">
                {archived.map((env) => (
                  <EnvelopeCard
                    key={env.id}
                    envelope={env}
                    onEdit={() => setEditingId(env.id)}
                    onArchive={async () => {
                      await unarchiveEnvelope(env.id);
                      await Promise.all([reload(), reloadFunds()]);
                    }}
                  />
                ))}
              </div>
            </details>
          )}
        </div>
      </div>

      <EnvelopeFormModal
        open={editingId !== null}
        envelope={
          editingId && editingId !== 'new'
            ? envelopes.find((e) => e.id === editingId) ?? null
            : null
        }
        onClose={() => setEditingId(null)}
        onSaved={async () => {
          await Promise.all([reload(), reloadFunds()]);
          setEditingId(null);
        }}
      />
    </div>
  );
}

// ─── Envelope card ─────────────────────────────────────────────────────

function EnvelopeCard({
  envelope,
  onEdit,
  onArchive,
}: {
  envelope: FundView;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const tGoals = useTranslations('goals');
  const tCommonCard = useTranslations('common');
  const [showLedger, setShowLedger] = useState(false);
  const balance = envelope.balance ?? 0;
  const target = envelope.targetAmount ?? 0;
  const hasTarget = target > 0;
  const progress = envelope.progress;
  const pctRaw = hasTarget ? (balance / target) * 100 : 0;
  const pct = progress?.percent ?? Math.max(0, Math.min(100, pctRaw));
  const reached = progress?.reached ?? (hasTarget && balance >= target);
  const isArchived = !!envelope.archivedAt;

  const paceTone =
    progress?.paceStatus === 'ahead'
      ? 'emerald'
      : progress?.paceStatus === 'on_track'
        ? 'amber'
        : progress?.paceStatus === 'behind'
          ? 'rose'
          : 'neutral';
  const paceLabel = progress?.paceStatus
    ? {
        ahead: tGoals('ahead'),
        on_track: tGoals('on_track'),
        behind: tGoals('behind'),
      }[progress.paceStatus]
    : null;

  const barTone = reached
    ? 'emerald'
    : progress?.paceStatus === 'behind'
      ? 'rose'
      : pct >= 70
        ? 'emerald'
        : pct >= 30
          ? 'amber'
          : 'rose';

  const deadline = envelope.targetDeadline
    ? new Date(envelope.targetDeadline)
    : null;

  const monthlyTarget = envelope.monthlyContributionTarget ?? 0;
  const monthContribution = progress?.monthContribution ?? 0;
  const hasMonthlyTarget = monthlyTarget > 0;
  const monthPct = hasMonthlyTarget
    ? Math.max(0, Math.min(100, (monthContribution / monthlyTarget) * 100))
    : 0;
  const monthReached = hasMonthlyTarget && monthContribution >= monthlyTarget;
  const monthName = new Date().toLocaleDateString('vi-VN', { month: 'long' });

  return (
    <Card padding="p-5" className={isArchived ? 'opacity-60' : ''}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-stone-900">
              {envelope.purpose === 'investment' ? '📈 ' : '🐷 '}
              {envelope.name}
            </h3>
            {envelope.purpose === 'investment' && (
              <Badge tone="sky">Đầu tư</Badge>
            )}
            {reached && <Badge tone="emerald">✅ {tGoals('reached')}</Badge>}
            {!reached && paceLabel && <Badge tone={paceTone}>{paceLabel}</Badge>}
            {isArchived && <Badge tone="neutral">Archived</Badge>}
          </div>
          {deadline && (
            <p className="mt-1 text-[11px] text-stone-500">
              Deadline: {deadline.toLocaleDateString('vi-VN')}
              {progress?.daysRemaining != null && (
                <span className="ml-1">· {tGoals('days_remaining', { days: progress.daysRemaining })}</span>
              )}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            onClick={onEdit}
            className="rounded-md border border-stone-200 px-2.5 py-1 text-[11px] text-stone-600 transition-colors hover:bg-stone-50"
          >
            {tCommonCard('edit')}
          </button>
          <button
            onClick={onArchive}
            className="rounded-md border border-stone-200 px-2.5 py-1 text-[11px] text-stone-600 transition-colors hover:bg-stone-50"
          >
            {isArchived ? 'Unarchive' : 'Archive'}
          </button>
        </div>
      </div>

      <div className="mb-1 flex items-baseline justify-between">
        <span className="font-mono text-lg font-semibold tabular-nums text-stone-900 sm:text-xl lg:text-2xl">
          {formatVND(balance)}
        </span>
        {hasTarget && (
          <span className="text-sm text-stone-500">
            / {formatVND(target)}
            <span className="ml-2 text-xs text-stone-400">
              ({pctRaw.toFixed(1)}%)
            </span>
          </span>
        )}
      </div>
      {hasTarget && <ProgressBar value={pct} max={100} tone={barTone} />}
      {!hasTarget && !hasMonthlyTarget && (
        <p className="text-xs text-stone-400">
          {tGoals('no_goals_desc')}
        </p>
      )}

      {hasMonthlyTarget && (
        <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50/40 px-3 py-2.5">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wide text-amber-800">
              {monthName} — góp đều đặn{' '}
              {monthReached ? '✅' : null}
            </span>
            <span className="font-mono text-xs tabular-nums text-amber-900">
              {formatVND(monthContribution)} / {formatVND(monthlyTarget)}
            </span>
          </div>
          <ProgressBar
            value={monthPct}
            max={100}
            tone={monthReached ? 'emerald' : 'amber'}
          />
          {!monthReached && (
            <p className="mt-1 text-[11px] text-amber-700">
              {tGoals('month_contribution', {
                current: formatVND(monthContribution),
                target: formatVND(monthlyTarget),
              })}
            </p>
          )}
        </div>
      )}

      <div className="mt-3 border-t border-stone-100 pt-3">
        <button
          onClick={() => setShowLedger((v) => !v)}
          className="flex items-center gap-1 text-[11px] font-medium text-stone-500 hover:text-stone-700"
        >
          <span>{showLedger ? '▲' : '▼'}</span> {tGoals('manage')}
        </button>
        {showLedger && <FundLedgerPanel fundId={envelope.id} />}
      </div>
    </Card>
  );
}

// ─── Fund ledger ───────────────────────────────────────────────────────

function FundLedgerPanel({ fundId }: { fundId: string }) {
  const [txns, setTxns] = useState<TransactionView[] | null>(null);

  useEffect(() => {
    listTransactions({ fundId, limit: 200 }).then((r) => setTxns(r.items));
  }, [fundId]);

  if (txns === null)
    return <Skeleton className="mt-3 h-16 w-full rounded-lg" />;
  if (txns.length === 0)
    return (
      <p className="mt-3 text-center text-[11px] text-stone-400">
        Chưa có giao dịch nào
      </p>
    );

  const currentYear = new Date().getFullYear();
  const byYear = groupLedgerByYear(txns);
  const thisYearTxns = byYear[currentYear] ?? [];
  const prevYears = Object.entries(byYear)
    .filter(([y]) => Number(y) < currentYear)
    .sort(([a], [b]) => Number(b) - Number(a));

  return (
    <div className="mt-3 space-y-3">
      <LedgerYearSection
        year={currentYear}
        txns={thisYearTxns}
        isCurrentYear
      />
      {prevYears.length > 0 && (
        <details>
          <summary className="cursor-pointer text-[11px] text-stone-400 hover:text-stone-600">
            Các năm trước ({prevYears.length} năm)
          </summary>
          <div className="mt-2 space-y-3">
            {prevYears.map(([year, rows]) => (
              <LedgerYearSection key={year} year={Number(year)} txns={rows} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function LedgerYearSection({
  year,
  txns,
  isCurrentYear,
}: {
  year: number;
  txns: TransactionView[];
  isCurrentYear?: boolean;
}) {
  const inflow = txns
    .filter((t) => t.amount > 0)
    .reduce((s, t) => s + t.amount, 0);
  const outflow = txns
    .filter((t) => t.amount < 0)
    .reduce((s, t) => s + Math.abs(t.amount), 0);
  const net = inflow - outflow;

  return (
    <div>
      <div
        className={`rounded-lg px-3 py-2 ${
          isCurrentYear
            ? 'border border-sky-100 bg-sky-50'
            : 'bg-stone-50'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-600">
            Năm {year}
          </span>
          {isCurrentYear && (
            <span
              className={`font-mono text-xs font-semibold tabular-nums ${
                net >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {net >= 0 ? '+' : ''}
              {formatVND(net)} đóng góp mục tiêu
            </span>
          )}
        </div>
        <div className="mt-0.5 flex gap-3 text-[10px] text-stone-500">
          <span>
            Vào:{' '}
            <span className="font-mono text-emerald-700">
              +{formatVND(inflow)}
            </span>
          </span>
          <span>
            Rút:{' '}
            <span className="font-mono text-rose-700">
              -{formatVND(outflow)}
            </span>
          </span>
        </div>
      </div>
      {txns.length > 0 && (
        <div className="mt-1 divide-y divide-stone-100">
          {txns.map((t) => (
            <LedgerRow key={t.id} txn={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function LedgerRow({ txn }: { txn: TransactionView }) {
  const isInflow = txn.amount > 0;
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="min-w-0">
        <div className="truncate text-xs text-stone-700">
          {txn.category?.icon}{' '}
          {txn.note ?? txn.category?.name ?? '—'}
        </div>
        <div className="text-[10px] text-stone-400">
          {formatLedgerDate(txn.date)}
          {txn.category?.name ? ` · ${txn.category.name}` : ''}
        </div>
      </div>
      <span
        className={`ml-3 font-mono text-xs font-medium tabular-nums ${
          isInflow ? 'text-emerald-700' : 'text-rose-700'
        }`}
      >
        {isInflow ? '+' : ''}
        {formatVND(txn.amount)}
      </span>
    </div>
  );
}

function groupLedgerByYear(
  txns: TransactionView[],
): Record<number, TransactionView[]> {
  const map: Record<number, TransactionView[]> = {};
  for (const t of txns) {
    const y = new Date(t.date).getFullYear();
    (map[y] ??= []).push(t);
  }
  for (const arr of Object.values(map)) {
    arr.sort((a, b) => +new Date(b.date) - +new Date(a.date));
  }
  return map;
}

function formatLedgerDate(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// ─── Form modal ────────────────────────────────────────────────────────

function EnvelopeFormModal({
  open,
  envelope,
  onClose,
  onSaved,
}: {
  open: boolean;
  envelope: FundView | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const tGoalsModal = useTranslations('goals');
  const tCommonModal = useTranslations('common');
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState<'savings' | 'investment'>('savings');
  const [targetAmount, setTargetAmount] = useState<number | ''>('');
  const [targetDeadline, setTargetDeadline] = useState('');
  const [monthly, setMonthly] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(envelope?.name ?? '');
    setPurpose(
      envelope?.purpose === 'investment' ? 'investment' : 'savings',
    );
    setTargetAmount(envelope?.targetAmount ?? '');
    setTargetDeadline(envelope?.targetDeadline ?? '');
    setMonthly(envelope?.monthlyContributionTarget ?? '');
    setErr(null);
  }, [open, envelope]);

  if (!open) return null;

  const isEdit = !!envelope;

  async function onSubmit() {
    if (!name.trim()) {
      setErr('Tên quỹ không được rỗng');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      if (isEdit && envelope) {
        const patch: UpdateEnvelopePayload = {
          name: name.trim(),
          purpose,
          targetAmount: targetAmount === '' ? null : Number(targetAmount),
          targetDeadline: targetDeadline === '' ? null : targetDeadline,
          monthlyContributionTarget: monthly === '' ? null : Number(monthly),
        };
        await updateEnvelope(envelope.id, patch);
      } else {
        const payload: CreateEnvelopePayload = { name: name.trim(), purpose };
        if (targetAmount !== '') payload.targetAmount = Number(targetAmount);
        if (targetDeadline !== '') payload.targetDeadline = targetDeadline;
        if (monthly !== '') payload.monthlyContributionTarget = Number(monthly);
        await createEnvelope(payload);
      }
      onSaved();
    } catch (e) {
      setErr(
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Lỗi không xác định',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-stone-900/30 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-base font-semibold text-stone-900">
          {isEdit ? tCommonModal('edit') : tGoalsModal('create_fund')}
        </h2>
        <p className="mb-5 text-xs text-stone-500">
          Quỹ tiết kiệm & đầu tư — cả 2 vợ chồng cùng thấy và góp được.
        </p>

        <div className="space-y-4">
          <Field label={tGoalsModal('label_fund_type')} required>
            <div className="flex gap-2">
              {(
                [
                  { value: 'savings', label: '🐷 Tiết kiệm' },
                  { value: 'investment', label: '📈 Đầu tư' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPurpose(opt.value)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    purpose === opt.value
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                      : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label={tGoalsModal('label_fund_name')} required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="vd: Quỹ Du lịch"
              className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm transition-colors focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </Field>

          <Field
            label={tGoalsModal('label_target_amount')}
            hint={
              targetAmount !== '' && Number(targetAmount) > 0
                ? formatVND(Number(targetAmount))
                : tGoalsModal('hint_no_target')
            }
          >
            <input
              type="number"
              value={targetAmount}
              onChange={(e) =>
                setTargetAmount(e.target.value === '' ? '' : Number(e.target.value))
              }
              placeholder="vd: 50000000"
              className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm transition-colors focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </Field>

          <Field label={tGoalsModal('label_deadline')} hint={tGoalsModal('hint_deadline_optional')}>
            <input
              type="date"
              value={targetDeadline}
              onChange={(e) => setTargetDeadline(e.target.value)}
              className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm transition-colors focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </Field>

          <Field
            label={tGoalsModal('label_monthly_target')}
            hint={
              monthly !== '' && Number(monthly) > 0
                ? `${formatVND(Number(monthly))}/tháng — ${tGoalsModal('hint_monthly_example')}`
                : tGoalsModal('hint_monthly_optional')
            }
          >
            <input
              type="number"
              value={monthly}
              onChange={(e) =>
                setMonthly(e.target.value === '' ? '' : Number(e.target.value))
              }
              placeholder="vd: 10000000"
              className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm transition-colors focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </Field>

          {err && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              ⚠️ {err}
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="w-full rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm text-stone-700 transition-colors hover:bg-stone-50 sm:w-auto"
          >
            {tCommonModal('cancel')}
          </button>
          <button
            onClick={onSubmit}
            disabled={saving || !name.trim()}
            className="w-full rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-emerald-800 active:scale-[0.99] disabled:bg-stone-300 sm:w-auto"
          >
            {saving ? tCommonModal('saving') : isEdit ? tCommonModal('save') : tGoalsModal('create_fund')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-stone-700">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-stone-400">{hint}</p>}
    </div>
  );
}
