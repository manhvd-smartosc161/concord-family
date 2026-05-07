import type { TransactionView } from '../types';

export interface DayGrouped {
  day: string;
  items: TransactionView[];
}

export function groupByDay(items: TransactionView[]): DayGrouped[] {
  const buckets = new Map<string, TransactionView[]>();
  for (const t of items) {
    const day = t.date.slice(0, 10);
    if (!buckets.has(day)) buckets.set(day, []);
    buckets.get(day)!.push(t);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([day, items]) => ({ day, items }));
}

export function formatDayLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (+d === +today) return 'Hôm nay';
  if (+d === +yesterday) return 'Hôm qua';
  return d.toLocaleDateString('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
