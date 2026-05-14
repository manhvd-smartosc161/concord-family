'use client';

import { useTranslations } from 'next-intl';
import { formatVND } from '@/lib/format';
import type { FundView } from '../types';

export function pickFundIcon(fund: {
  name: string;
  type: 'personal' | 'joint';
  purpose: 'spending' | 'savings' | 'investment';
  accessLevel: 'owner' | 'joint' | 'private';
}): string {
  if (fund.accessLevel === 'private') return '🔒';
  if (fund.purpose === 'spending') {
    return fund.type === 'joint' ? '🤝' : '💰';
  }
  const n = fund.name.toLowerCase();
  if (/du l[ịi]ch|travel|nghỉ|nghi/.test(n)) return '✈️';
  if (/sửa nh[àa]|nhà|home|build/.test(n)) return '🏠';
  if (/học|education|sóc|con|trường|school|cấp/.test(n)) return '📚';
  if (/đầu tư|invest|stock|chứng khoán/.test(n)) return '📈';
  if (/tiết kiệm|savings|ti[êe]́t/.test(n)) return '🐷';
  if (/y tế|sức khỏe|sức khoẻ|health|khám|thuốc/.test(n)) return '🏥';
  if (/xe|ô tô|car|moto|honda/.test(n)) return '🚗';
  if (/cưới|hỏi|wedding/.test(n)) return '💍';
  if (/khẩn cấp|emergency|dự phòng/.test(n)) return '🆘';
  if (/quà|tặng|gift/.test(n)) return '🎁';
  if (/tết|new year/.test(n)) return '🧧';
  if (/sinh nhật|birthday/.test(n)) return '🎂';
  if (/điện tử|tech|máy/.test(n)) return '💻';
  const fallbacks = ['🎯', '⭐', '💎', '🌱', '🪙', '🌟', '🎨', '🧭'];
  let h = 0;
  for (let i = 0; i < fund.name.length; i++) h = (h * 31 + fund.name.charCodeAt(i)) | 0;
  return fallbacks[Math.abs(h) % fallbacks.length];
}

export function FundCard({ fund }: { fund: FundView }) {
  const tCommon = useTranslations('common');
  const isPrivate = fund.accessLevel === 'private';
  const isGoalFund = fund.purpose === 'savings' || fund.purpose === 'investment';
  const variant = {
    owner:
      'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white',
    joint: isGoalFund
      ? 'border-sky-200 bg-gradient-to-br from-sky-50 to-white'
      : 'border-amber-200 bg-gradient-to-br from-amber-50 to-white',
    private: 'border-stone-200 bg-stone-50',
  }[fund.accessLevel];

  const icon = pickFundIcon(fund);
  const label =
    fund.accessLevel === 'owner'
      ? tCommon('fund_label_yours')
      : fund.accessLevel === 'joint'
        ? fund.purpose === 'investment'
          ? tCommon('fund_label_investment')
          : fund.purpose === 'savings'
            ? tCommon('fund_label_savings')
            : tCommon('fund_label_joint')
        : tCommon('fund_label_private');

  return (
    <div className={`rounded-lg border ${variant} p-3`}>
      <div className="flex items-start justify-between gap-2">
        <span
          className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-medium text-stone-800"
          title={fund.name}
        >
          <span className="shrink-0">{icon}</span>
          <span className="truncate">{fund.name}</span>
        </span>
        <span className="shrink-0 whitespace-nowrap text-[10px] uppercase tracking-wide text-stone-400">
          {label}
        </span>
      </div>
      <div className="mt-1 font-mono text-base font-semibold tabular-nums">
        {isPrivate ? (
          <span className="text-stone-300">— — — đ</span>
        ) : (
          <span className="text-stone-900">{formatVND(fund.balance ?? 0)}</span>
        )}
      </div>
    </div>
  );
}
