'use client';

import { useEffect, useState } from 'react';
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
        title="Quỹ mục tiêu"
        subtitle="Tạo các envelope để dành tiền theo từng mục đích (du lịch, học hành, sửa nhà, đầu tư…)"
        actions={
          <button
            onClick={() => setEditingId('new')}
            className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-emerald-800 active:scale-[0.98]"
          >
            + Tạo quỹ
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto px-6 py-6">
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
                icon="🎯"
                title="Chưa có quỹ mục tiêu nào"
                description="Bấm + Tạo quỹ để bắt đầu. Vd: Quỹ Du lịch 50tr, Quỹ Sửa nhà 300tr, …"
              />
            </Card>
          )}

          {active.map((env) => (
            <EnvelopeCard
              key={env.id}
              envelope={env}
              onEdit={() => setEditingId(env.id)}
              onArchive={async () => {
                if (!confirm(`Archive quỹ "${env.name}"?`)) return;
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
        ahead: 'Đang vượt tiến độ',
        on_track: 'Đúng tiến độ',
        behind: 'Đang chậm',
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
              {envelope.name}
            </h3>
            {reached && <Badge tone="emerald">✅ Đạt</Badge>}
            {!reached && paceLabel && <Badge tone={paceTone}>{paceLabel}</Badge>}
            {isArchived && <Badge tone="neutral">Archived</Badge>}
          </div>
          {deadline && (
            <p className="mt-1 text-[11px] text-stone-500">
              Deadline: {deadline.toLocaleDateString('vi-VN')}
              {progress?.daysRemaining != null && (
                <span className="ml-1">· còn {progress.daysRemaining} ngày</span>
              )}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            onClick={onEdit}
            className="rounded-md border border-stone-200 px-2.5 py-1 text-[11px] text-stone-600 transition-colors hover:bg-stone-50"
          >
            Sửa
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
        <span className="font-mono text-2xl font-semibold tabular-nums text-stone-900">
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
          Chưa đặt target — chỉ track tích luỹ
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
              Cần góp thêm{' '}
              <span className="font-mono">
                {formatVND(monthlyTarget - monthContribution)}
              </span>{' '}
              trong tháng này
            </p>
          )}
        </div>
      )}
    </Card>
  );
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
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState<number | ''>('');
  const [targetDeadline, setTargetDeadline] = useState('');
  const [monthly, setMonthly] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(envelope?.name ?? '');
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
          targetAmount: targetAmount === '' ? null : Number(targetAmount),
          targetDeadline: targetDeadline === '' ? null : targetDeadline,
          monthlyContributionTarget: monthly === '' ? null : Number(monthly),
        };
        await updateEnvelope(envelope.id, patch);
      } else {
        const payload: CreateEnvelopePayload = { name: name.trim() };
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
          {isEdit ? 'Sửa quỹ mục tiêu' : 'Tạo quỹ mục tiêu mới'}
        </h2>
        <p className="mb-5 text-xs text-stone-500">
          Envelope joint — cả 2 vợ chồng cùng thấy và góp được.
        </p>

        <div className="space-y-4">
          <Field label="Tên quỹ" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="vd: Quỹ Du lịch"
              className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm transition-colors focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </Field>

          <Field
            label="Mục tiêu (VND)"
            hint={
              targetAmount !== '' && Number(targetAmount) > 0
                ? formatVND(Number(targetAmount))
                : 'Bỏ trống nếu chỉ tích luỹ tự do'
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

          <Field label="Deadline" hint="Bỏ trống nếu không có hạn cụ thể">
            <input
              type="date"
              value={targetDeadline}
              onChange={(e) => setTargetDeadline(e.target.value)}
              className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm transition-colors focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </Field>

          <Field
            label="Mục tiêu góp đều đặn (VND/tháng)"
            hint={
              monthly !== '' && Number(monthly) > 0
                ? `${formatVND(Number(monthly))}/tháng — vd "đầu tư 10tr/tháng đều đặn"`
                : 'Bỏ trống nếu không cần — chỉ dùng khi muốn track recurring'
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

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm text-stone-700 transition-colors hover:bg-stone-50"
          >
            Huỷ
          </button>
          <button
            onClick={onSubmit}
            disabled={saving || !name.trim()}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-emerald-800 active:scale-[0.99] disabled:bg-stone-300"
          >
            {saving ? 'Đang lưu…' : isEdit ? 'Cập nhật' : 'Tạo'}
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
