import { apiFetch } from '@/lib/api-client';
import type {
  TransactionFilters,
  TransactionPage,
  TransactionView,
  UpdateTransactionPayload,
} from './types';

export interface CreateTransactionPayload {
  fundName: string;
  amount: number;
  categoryName?: string;
  note?: string;
  date?: string;
}

export function createTransaction(
  payload: CreateTransactionPayload,
): Promise<TransactionView & { fundBalance: number }> {
  return apiFetch<TransactionView & { fundBalance: number }>(
    '/api/transactions',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export function listRecentTransactions(limit = 20): Promise<TransactionView[]> {
  return apiFetch<TransactionView[]>(`/api/transactions/recent?limit=${limit}`);
}

export function listTransactions(
  filters: TransactionFilters,
): Promise<TransactionPage> {
  const qs = new URLSearchParams();
  if (filters.fundId) qs.set('fundId', filters.fundId);
  if (filters.categoryId) qs.set('categoryId', filters.categoryId);
  if (filters.from) qs.set('from', filters.from);
  if (filters.to) qs.set('to', filters.to);
  if (filters.q) qs.set('q', filters.q);
  if (filters.offset != null) qs.set('offset', String(filters.offset));
  if (filters.limit != null) qs.set('limit', String(filters.limit));
  if (filters.scope && filters.scope !== 'all') qs.set('scope', filters.scope);
  const q = qs.toString();
  return apiFetch<TransactionPage>(`/api/transactions${q ? `?${q}` : ''}`);
}

export async function deleteTransaction(id: string): Promise<void> {
  await apiFetch<void>(`/api/transactions/${id}`, { method: 'DELETE' });
}

export function updateTransaction(
  id: string,
  patch: UpdateTransactionPayload,
): Promise<TransactionView> {
  return apiFetch<TransactionView>(`/api/transactions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}
