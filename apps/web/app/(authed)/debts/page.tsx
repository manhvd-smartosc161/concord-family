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
            <div className="flex flex-wrap gap-2">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as DebtStatus | '')}
                className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
              >
                <option value="open">{t('filter_status_open')}</option>
                <option value="closed">{t('filter_status_closed')}</option>
                <option value="">{t('filter_status_all')}</option>
              </select>
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as DebtDirection | '')}
                className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
              >
                <option value="">{t('filter_direction_all')}</option>
                <option value="i_owe">{t('filter_direction_i_owe')}</option>
                <option value="they_owe_me">{t('filter_direction_they_owe')}</option>
              </select>
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
