'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, EmptyState, PageHeader, StatCard } from '@/components/ui';
import { listDebts } from '@/features/debts/api';
import { DebtCard } from '@/features/debts/components/debt-card';
import { DebtDetailModal } from '@/features/debts/components/debt-detail-modal';
import { DebtFormModal } from '@/features/debts/components/debt-form-modal';
import type { DebtStatus, DebtView } from '@/features/debts/types';
import { formatVND } from '@/lib/format';

function FilterGroup<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-background p-0.5">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              active
                ? 'bg-emerald-600 text-white shadow-sm dark:bg-emerald-700'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function DebtSection({
  title,
  emptyIcon,
  emptyTitle,
  items,
  onClick,
}: {
  title: string;
  emptyIcon: string;
  emptyTitle: string;
  items: DebtView[];
  onClick: (id: string) => void;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {items.length === 0 ? (
        <EmptyState icon={emptyIcon} title={emptyTitle} />
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {items.map((d) => (
            <DebtCard key={d.id} debt={d} onClick={() => onClick(d.id)} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function DebtsPage() {
  const t = useTranslations('debts');
  const [debts, setDebts] = useState<DebtView[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<DebtStatus | ''>('open');
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DebtView | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listDebts({ status: status || undefined });
      setDebts(list);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const groups = useMemo(() => {
    const isPrivate = (d: DebtView) => d.visibility === 'private';
    const isShared = (d: DebtView) => d.visibility === 'shared';
    return {
      myOwe: debts.filter((d) => isPrivate(d) && d.direction === 'i_owe'),
      myLent: debts.filter((d) => isPrivate(d) && d.direction === 'they_owe_me'),
      familyOwe: debts.filter((d) => isShared(d) && d.direction === 'i_owe'),
      familyLent: debts.filter((d) => isShared(d) && d.direction === 'they_owe_me'),
    };
  }, [debts]);

  const kpi = useMemo(() => {
    const open = (d: DebtView) => d.status === 'open';
    const owe = debts.filter((d) => d.direction === 'i_owe' && open(d)).reduce((s, d) => s + d.outstanding, 0);
    const lent = debts.filter((d) => d.direction === 'they_owe_me' && open(d)).reduce((s, d) => s + d.outstanding, 0);
    return { owe, lent, net: lent - owe };
  }, [debts]);

  const openCount =
    groups.myOwe.filter((d) => d.status === 'open').length +
    groups.familyOwe.filter((d) => d.status === 'open').length;
  const lentCount =
    groups.myLent.filter((d) => d.status === 'open').length +
    groups.familyLent.filter((d) => d.status === 'open').length;

  const emptyTitle = status === 'closed' ? t('empty_closed') : t('empty_open');

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle_template', { owe: String(openCount), lent: String(lentCount) })}
        actions={
          <button
            onClick={() => {
              setEditTarget(null);
              setFormOpen(true);
            }}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
          >
            {t('add_button')}
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-6">
        <div className="mx-auto max-w-5xl space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label={t('kpi_i_owe')} value={formatVND(kpi.owe)} tone="negative" />
            <StatCard label={t('kpi_they_owe')} value={formatVND(kpi.lent)} tone="positive" />
            <StatCard
              label={t('kpi_net')}
              value={formatVND(kpi.net, true)}
              tone={kpi.net >= 0 ? 'positive' : 'negative'}
            />
          </div>

          <Card>
            <FilterGroup
              value={status}
              onChange={(v) => setStatus(v)}
              options={[
                { value: 'open', label: t('filter_status_open') },
                { value: 'closed', label: t('filter_status_closed') },
                { value: '', label: t('filter_status_all') },
              ]}
            />
          </Card>

          {loading ? (
            <Card>
              <div className="text-center text-sm text-muted-foreground">Đang tải…</div>
            </Card>
          ) : (
            <>
              <DebtSection
                title={t('section_i_owe')}
                emptyIcon="💳"
                emptyTitle={emptyTitle}
                items={groups.myOwe}
                onClick={setDetailId}
              />
              <DebtSection
                title={t('section_they_owe_me')}
                emptyIcon="🤝"
                emptyTitle={emptyTitle}
                items={groups.myLent}
                onClick={setDetailId}
              />
              <DebtSection
                title={t('section_family_owe')}
                emptyIcon="🏠"
                emptyTitle={emptyTitle}
                items={groups.familyOwe}
                onClick={setDetailId}
              />
              <DebtSection
                title={t('section_family_lent')}
                emptyIcon="🏠"
                emptyTitle={emptyTitle}
                items={groups.familyLent}
                onClick={setDetailId}
              />
            </>
          )}
        </div>
      </div>

      <DebtFormModal
        open={formOpen}
        initial={editTarget}
        onClose={() => setFormOpen(false)}
        onSaved={async () => {
          setFormOpen(false);
          await reload();
        }}
      />

      <DebtDetailModal
        open={detailId !== null}
        debtId={detailId}
        onClose={() => setDetailId(null)}
        onEdit={(d) => {
          setDetailId(null);
          setEditTarget(d);
          setFormOpen(true);
        }}
        onChanged={() => void reload()}
      />
    </div>
  );
}
