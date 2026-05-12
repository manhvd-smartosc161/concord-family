'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ApiError } from '@/lib/api-client';
import { formatVND } from '@/lib/format';
import { setFundOpeningBalance } from '@/features/funds/api';
import type { FundView } from '@/features/funds/types';
import { listGoals, updateYearlySavingsGoal } from '@/features/goals/api';
import type { GoalView } from '@/features/goals/types';
import { pickFundIcon } from '@/features/funds/components/fund-card';
import { useAuthedLayout } from '../layout';
import { Card, PageHeader, Skeleton } from '@/components/ui';

export default function FinanceSettingsPage() {
  const t = useTranslations('finance');
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
      />
      <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <YearlyGoalSection />
          <OpeningBalanceSection />
        </div>
      </div>
    </div>
  );
}

function YearlyGoalSection() {
  const t = useTranslations('finance');
  const tCommon = useTranslations('common');
  const [goal, setGoal] = useState<GoalView | null>(null);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  useEffect(() => {
    listGoals()
      .then((gs) => {
        const yearly = gs.find((g) => g.period === 'year' && g.type === 'save');
        if (yearly) { setGoal(yearly); setTarget(yearly.targetAmount); }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const year = new Date().getFullYear();
  const isDirty = target !== '' && Number(target) > 0 && Number(target) !== goal?.targetAmount;

  async function onSave() {
    if (target === '' || Number(target) <= 0) return;
    setSaving(true);
    setFeedback(null);
    try {
      const updated = await updateYearlySavingsGoal(Number(target));
      setGoal(updated);
      setFeedback({ kind: 'ok', msg: t('goal_saved') });
      setTimeout(() => setFeedback(null), 2500);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Lỗi không xác định';
      setFeedback({ kind: 'err', msg });
    } finally {
      setSaving(false);
    }
  }

  const presets = [100_000_000, 150_000_000, 200_000_000];

  return (
    <Card padding="p-6">
      <h3 className="mb-1 text-sm font-semibold text-stone-800">{t('yearly_goal_title', { year })}</h3>
      <p className="mb-5 text-xs text-stone-500">
        {t('yearly_goal_desc')}
      </p>

      {loading && <Skeleton className="h-32 w-full rounded-lg" />}

      {!loading && (
        <>
          <label className="mb-1.5 block text-xs font-medium text-stone-700">{t('goal_vnd')}</label>
          <input
            type="number"
            value={target}
            onChange={(e) => setTarget(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder={t('goal_placeholder')}
            className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm transition-colors focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
          <p className="mt-1 text-[11px] text-stone-400">
            {target !== '' && Number(target) > 0
              ? <><span>{t('goal_preview')} </span><span className="font-mono">{formatVND(Number(target))}</span></>
              : t('goal_hint')}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {presets.map((p) => (
              <button key={p} type="button" onClick={() => setTarget(p)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  target === p
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                }`}>
                {formatVND(p)}
              </button>
            ))}
          </div>

          <div className="mt-5 flex flex-col items-start justify-between border-t border-stone-100 pt-4 sm:flex-row sm:items-center">
            {feedback && (
              <span className={`text-xs ${feedback.kind === 'ok' ? 'text-emerald-700' : 'text-rose-700'}`}>
                {feedback.kind === 'ok' ? '✅' : '⚠️'} {feedback.msg}
              </span>
            )}
            <div className="mt-3 flex w-full gap-2 sm:ml-auto sm:mt-0 sm:w-auto sm:gap-3">
              <button
                onClick={() => { setTarget(goal?.targetAmount ?? ''); setFeedback(null); }}
                disabled={saving || !goal}
                className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-50 sm:flex-none"
              >
                {tCommon('reset')}
              </button>
              <button
                onClick={onSave}
                disabled={saving || !isDirty}
                className="flex-1 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-emerald-800 active:scale-[0.99] disabled:bg-stone-300 sm:flex-none"
              >
                {saving ? tCommon('saving') : tCommon('save')}
              </button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

function OpeningBalanceSection() {
  const t = useTranslations('finance');
  const { funds, reloadFunds } = useAuthedLayout();
  const accessible = funds.filter((f) => f.accessLevel !== 'private');

  return (
    <Card padding="p-6">
      <h3 className="mb-1 text-sm font-semibold text-stone-800">{t('opening_balance_title')}</h3>
      <p className="mb-5 text-xs text-stone-500">
        {t('opening_balance_desc')}
      </p>

      {accessible.length === 0 && <Skeleton className="h-24 w-full rounded-lg" />}

      <div className="space-y-3">
        {[...accessible]
          .sort((a, b) => {
            if (a.purpose !== b.purpose) return a.purpose === 'spending' ? -1 : 1;
            return a.name.localeCompare(b.name, 'vi');
          })
          .map((fund) => (
            <OpeningBalanceRow key={fund.id} fund={fund} onSaved={() => void reloadFunds()} />
          ))}
      </div>
    </Card>
  );
}

function OpeningBalanceRow({ fund, onSaved }: { fund: FundView; onSaved: () => void }) {
  const t = useTranslations('finance');
  const tCommon = useTranslations('common');
  const initial = fund.openingBalance ?? 0;
  const [value, setValue] = useState<number | ''>(initial);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  useEffect(() => { setValue(fund.openingBalance ?? 0); }, [fund.openingBalance]);

  const isDirty = value !== '' && Number(value) !== initial;
  const isJoint = fund.type === 'joint';

  async function onSave() {
    if (value === '' || Number(value) < 0) return;
    setSaving(true);
    setFeedback(null);
    try {
      await setFundOpeningBalance(fund.id, Number(value));
      setFeedback({ kind: 'ok', msg: t('balance_saved') });
      onSaved();
      setTimeout(() => setFeedback(null), 2500);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Lỗi không xác định';
      setFeedback({ kind: 'err', msg });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`rounded-lg border px-4 py-3 ${isJoint ? 'border-amber-100 bg-amber-50/40' : 'border-emerald-100 bg-emerald-50/30'}`}>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="flex items-center gap-1.5 text-sm font-medium text-stone-800">
          <span>{pickFundIcon(fund)}</span> {fund.name}
        </span>
        <span className="text-[11px] text-stone-500">
          {t('current_balance')}: <span className="font-mono">{formatVND(fund.balance ?? 0)}</span>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number" min={0} value={value}
          onChange={(e) => setValue(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder="0"
          className="min-w-0 flex-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
        />
        <span className="font-mono text-xs tabular-nums text-stone-500">
          {value !== '' && Number(value) >= 0 ? formatVND(Number(value)) : '—'}
        </span>
        <button
          onClick={onSave} disabled={saving || !isDirty}
          className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-medium text-white transition-all hover:bg-emerald-800 active:scale-[0.99] disabled:bg-stone-300"
        >
          {saving ? tCommon('saving') : tCommon('save')}
        </button>
      </div>
      {feedback && (
        <div className={`mt-2 text-[11px] ${feedback.kind === 'ok' ? 'text-emerald-700' : 'text-rose-700'}`}>
          {feedback.kind === 'ok' ? '✅' : '⚠️'} {feedback.msg}
        </div>
      )}
    </div>
  );
}
