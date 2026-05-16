'use client';

import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/ui';
import { DebtCard } from './debt-card';
import type { DebtView } from '../types';

interface Props {
  debts: DebtView[];
  onCardClick: (debt: DebtView) => void;
  onRecordPayment: (debt: DebtView) => void;
}

export function DebtsList({ debts, onCardClick, onRecordPayment }: Props) {
  const t = useTranslations('debts');
  if (debts.length === 0) {
    return (
      <EmptyState
        icon="🧾"
        title={t('empty_title')}
        description={t('empty_desc')}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {debts.map((debt) => (
        <DebtCard
          key={debt.id}
          debt={debt}
          onClick={() => onCardClick(debt)}
          onRecordPayment={() => onRecordPayment(debt)}
        />
      ))}
    </div>
  );
}
