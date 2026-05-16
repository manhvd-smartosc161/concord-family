'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api-client';
import { PageHeader, Skeleton } from '@/components/ui';
import { useAuthedLayout } from '../layout';
import { DebtsPageClient } from '@/features/debts/components/debts-page-client';
import type { DebtSummary, DebtView } from '@/features/debts/types';
import { listDebts, getDebtsSummary } from '@/features/debts/api';

export default function DebtsPage() {
  const { funds, reloadFunds } = useAuthedLayout();
  const [loading, setLoading] = useState(true);
  const [debts, setDebts] = useState<DebtView[]>([]);
  const [summary, setSummary] = useState<DebtSummary | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, s] = await Promise.all([
        listDebts({ status: 'open', direction: 'lent' }),
        getDebtsSummary(),
      ]);
      setDebts(list);
      setSummary(s);
    } catch (e) {
      if (e instanceof ApiError) console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || !summary) {
    return (
      <>
        <PageHeader title="Nợ & Cho vay" />
        <div className="p-4">
          <Skeleton className="h-32" />
        </div>
      </>
    );
  }

  return (
    <DebtsPageClient
      funds={funds}
      initialDebts={debts}
      initialSummary={summary}
      onMutated={reloadFunds}
    />
  );
}
