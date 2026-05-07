import { apiFetch } from '@/lib/api-client';
import type {
  CreateImportantDatePayload,
  ImportantDateView,
  UpcomingView,
  UpdateImportantDatePayload,
  YearAgendaView,
} from './types';

export function listImportantDates(): Promise<ImportantDateView[]> {
  return apiFetch<ImportantDateView[]>('/api/important-dates');
}

export function listUpcoming(limit = 10): Promise<UpcomingView> {
  return apiFetch<UpcomingView>(`/api/important-dates/upcoming?limit=${limit}`);
}

export function listForYear(year: number): Promise<YearAgendaView> {
  return apiFetch<YearAgendaView>(`/api/important-dates/year/${year}`);
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

export function notifyAiDate(
  name: string,
  date: string,
  kind: string,
  notes: string | null,
): Promise<{ ok: true }> {
  return apiFetch('/api/important-dates/notify-ai-date', {
    method: 'POST',
    body: JSON.stringify({ name, date, kind, notes }),
  });
}
