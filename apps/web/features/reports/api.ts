import { apiFetch } from '@/lib/api-client';
import type { MonthlyReport } from './types';

export type MonthlyReportScope = 'all' | 'joint';

export function getMonthlyReport(
  year: number,
  month: number,
  scope: MonthlyReportScope = 'all',
  fundId?: string,
): Promise<MonthlyReport> {
  const params = new URLSearchParams({
    year: String(year),
    month: String(month),
  });
  if (scope !== 'all') params.set('scope', scope);
  if (fundId) params.set('fundId', fundId);
  return apiFetch<MonthlyReport>(`/api/reports/monthly?${params.toString()}`);
}
