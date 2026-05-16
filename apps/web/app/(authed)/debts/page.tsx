'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, EmptyState, PageHeader, StatCard } from '@/components/ui';
import { listDebts } from '@/features/debts/api';
import { DebtCard } from '@/features/debts/components/debt-card';
import { DebtDetailModal } from '@/features/debts/components/debt-detail-modal';
import { DebtFormModal } from '@/features/debts/components/debt-form-modal';
import type { DebtDirection, DebtStatus, DebtView } from '@/features/debts/types';
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

export default function DebtsPage() {
  const t = useTranslations('debts');
  const [debts, setDebts] = useState<DebtView[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<DebtStatus | ''>('open');
  const [direction, setDirection] = useState<DebtDirection | ''>('');
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DebtView | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listDebts({
        status: status || undefined,
        direction: direction || undefined,
      });
      setDebts(list);
    } finally {
      setLoading(false);
    }
  }, [status, direction]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const groups = useMemo(() => {
    const iOwe = debts.filter((d) => d.direction === 'i_owe');
    const theyOwe = debts.filter((d) => d.direction === 'they_owe_me');
    return { iOwe, theyOwe };
  }, [debts]);

  const kpi = useMemo(() => {
    const owe = groups.iOwe.filter((d) => d.status === 'open').reduce((s, d) => s + d.outstanding, 0);
    const lent = groups.theyOwe.filter((d) => d.status === 'open').reduce((s, d) => s + d.outstanding, 0);
    return { owe, lent, net: lent - owe };
  }, [groups]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle_template', {
          owe: String(groups.iOwe.filter((d) => d.status === 'open').length),
          lent: String(groups.theyOwe.filter((d) => d.status === 'open').length),
        })}
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
            <div className="flex flex-wrap items-center gap-4">
              <FilterGroup
                value={status}
                onChange={(v) => setStatus(v)}
                options={[
                  { value: 'open', label: t('filter_status_open') },
                  { value: 'closed', label: t('filter_status_closed') },
                  { value: '', label: t('filter_status_all') },
                ]}
              />
              <span className="hidden h-5 w-px bg-border sm:inline-block" />
              <FilterGroup
                value={direction}
                onChange={(v) => setDirection(v)}
                options={[
                  { value: '', label: t('filter_direction_all') },
                  { value: 'i_owe', label: t('filter_direction_i_owe') },
                  { value: 'they_owe_me', label: t('filter_direction_they_owe') },
                ]}
              />
            </div>
          </Card>

          {loading ? (
            <Card>
              <div className="text-center text-sm text-muted-foreground">Đang tải…</div>
            </Card>
          ) : (
            <>
              {(direction === '' || direction === 'i_owe') && (
                <section className="space-y-2">
                  <h2 className="text-sm font-semibold text-foreground">{t('section_i_owe')}</h2>
                  {groups.iOwe.length === 0 ? (
                    <EmptyState
                      icon="💳"
                      title={status === 'closed' ? t('empty_closed') : t('empty_open')}
                    />
                  ) : (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {groups.iOwe.map((d) => (
                        <DebtCard key={d.id} debt={d} onClick={() => setDetailId(d.id)} />
                      ))}
                    </div>
                  )}
                </section>
              )}

              {(direction === '' || direction === 'they_owe_me') && (
                <section className="space-y-2">
                  <h2 className="text-sm font-semibold text-foreground">{t('section_they_owe_me')}</h2>
                  {groups.theyOwe.length === 0 ? (
                    <EmptyState
                      icon="🤝"
                      title={status === 'closed' ? t('empty_closed') : t('empty_open')}
                    />
                  ) : (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {groups.theyOwe.map((d) => (
                        <DebtCard key={d.id} debt={d} onClick={() => setDetailId(d.id)} />
                      ))}
                    </div>
                  )}
                </section>
              )}
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
