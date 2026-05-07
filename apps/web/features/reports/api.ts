import { apiFetch } from '@/lib/api-client';
import type { MonthlyReport } from './types';

export function getMonthlyReport(
  year: number,
  month: number,
): Promise<MonthlyReport> {
  return apiFetch<MonthlyReport>(
    `/api/reports/monthly?year=${year}&month=${month}`,
  );
}
