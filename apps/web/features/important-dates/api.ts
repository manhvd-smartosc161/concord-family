import { apiFetch } from '@/lib/api-client';
import type {
  CreateImportantDatePayload,
  ImportantDateView,
  MonthListView,
  UpdateImportantDatePayload,
} from './types';

export function listImportantDates(): Promise<ImportantDateView[]> {
  return apiFetch<ImportantDateView[]>('/api/important-dates');
}

export function listThisMonth(): Promise<MonthListView> {
  return apiFetch<MonthListView>('/api/important-dates/this-month');
}

export function createImportantDate(
  payload: CreateImportantDatePayload,
): Promise<ImportantDateView> {
  return apiFetch<ImportantDateView>('/api/important-dates', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateImportantDate(
  id: string,
  payload: UpdateImportantDatePayload,
): Promise<ImportantDateView> {
  return apiFetch<ImportantDateView>(`/api/important-dates/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteImportantDate(id: string): Promise<void> {
  return apiFetch<void>(`/api/important-dates/${id}`, { method: 'DELETE' });
}

export function testNotifyImportantDate(id: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/api/important-dates/${id}/test-notify`, {
    method: 'POST',
  });
}

export function testLunarTick(): Promise<{
  ok: true;
  kind: 'mung1' | 'ram';
  target: string;
  lunarMonth: number;
}> {
  return apiFetch('/api/important-dates/_test-lunar-tick', { method: 'POST' });
}

export function testLunarByDate(
  kind: 'mung1' | 'ram',
  date: string,
): Promise<{ ok: true }> {
  return apiFetch('/api/important-dates/_lunar-notify', {
    method: 'POST',
    body: JSON.stringify({ kind, date }),
  });
}
