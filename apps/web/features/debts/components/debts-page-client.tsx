'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api-client';
import { PageHeader } from '@/components/ui';
import type { FundView } from '@/features/funds/types';
import { listDebts, getDebtsSummary } from '../api';
import type { DebtSummary, DebtView } from '../types';
import { DebtsSummaryCards } from './debts-summary-cards';
import { DebtsList } from './debts-list';
import { CreateDebtModal } from './create-debt-modal';
import { RecordPaymentModal } from './record-payment-modal';
import { DebtDetailDrawer } from './debt-detail-drawer';

type TabKey = 'lent' | 'borrowed' | 'settled';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'lent', label: '🤝 Cho vay' },
  { key: 'borrowed', label: '💸 Đang nợ' },
  { key: 'settled', label: '✅ Đã tất toán' },
];

interface Props {
  funds: FundView[];
  initialDebts: DebtView[];
  initialSummary: DebtSummary;
  onMutated: () => void;
}

export function DebtsPageClient({ funds, initialDebts, initialSummary, onMutated }: Props) {
  const [tab, setTab] = useState<TabKey>('lent');
  const [debts, setDebts] = useState<DebtView[]>(initialDebts);
  const [summary, setSummary] = useState<DebtSummary>(initialSummary);
  const [loading, setLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [paymentDebt, setPaymentDebt] = useState<DebtView | null>(null);
  const [detailDebtId, setDetailDebtId] = useState<string | null>(null);

  const load = useCallback(async (activeTab: TabKey) => {
    setLoading(true);
    try {
      const [list, s] = await Promise.all([
        listDebts(
          activeTab === 'settled'
            ? { status: 'settled' }
            : { status: 'open', direction: activeTab },
        ),
        getDebtsSummary(),
      ]);
      setDebts(list);
      setSummary(s);
    } catch (err) {
      if (err instanceof ApiError) console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(tab);
  }, [tab, load]);

  async function handleMutated() {
    onMutated();
    await load(tab);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Nợ & Cho vay"
        subtitle="Theo dõi các khoản cho vay và đi vay."
        actions={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-800"
          >
            + Thêm khoản
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-6">
        <div className="mx-auto max-w-5xl space-y-5">
          <DebtsSummaryCards summary={summary} />

          <div className="flex gap-1 rounded-xl border border-border bg-muted p-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  tab === t.key
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-36 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : (
            <DebtsList
              debts={debts}
              onCardClick={(d) => setDetailDebtId(d.id)}
              onRecordPayment={(d) => setPaymentDebt(d)}
            />
          )}
        </div>
      </div>

      <CreateDebtModal
        open={createOpen}
        funds={funds}
        onClose={() => setCreateOpen(false)}
        onSuccess={handleMutated}
      />

      <RecordPaymentModal
        open={paymentDebt !== null}
        debt={paymentDebt}
        onClose={() => setPaymentDebt(null)}
        onSuccess={handleMutated}
      />

      <DebtDetailDrawer
        open={detailDebtId !== null}
        debtId={detailDebtId}
        onClose={() => setDetailDebtId(null)}
        onMutated={handleMutated}
      />
    </div>
  );
}
