import { apiFetch } from '@/lib/api-client';
import type {
  CreateImportantDatePayload,
  ImportantDateView,
  UpdateImportantDatePayload,
} from './types';

export function listImportantDates(): Promise<ImportantDateView[]> {
  return apiFetch<ImportantDateView[]>('/api/important-dates');
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
