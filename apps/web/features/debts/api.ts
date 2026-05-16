import { apiFetch } from '@/lib/api-client';
import type {
  CreateDebtPayload,
  DebtDetail,
  DebtSummary,
  DebtView,
  RecordPaymentPayload,
} from './types';

export function listDebts(params?: {
  status?: 'open' | 'settled' | 'all';
  direction?: 'lent' | 'borrowed' | 'all';
}): Promise<DebtView[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.direction) qs.set('direction', params.direction);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<DebtView[]>(`/api/debts${suffix}`);
}

export function getDebtsSummary(): Promise<DebtSummary> {
  return apiFetch<DebtSummary>('/api/debts/summary');
}

export function getDebt(id: string): Promise<DebtDetail> {
  return apiFetch<DebtDetail>(`/api/debts/${id}`);
}

export function createDebt(payload: CreateDebtPayload): Promise<DebtView> {
  return apiFetch<DebtView>('/api/debts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function recordPayment(
  id: string,
  payload: RecordPaymentPayload,
): Promise<{ debt: DebtView; payment: { id: string; kind: 'repayment'; amount: number; transactionId: string; paidAt: string; note: string | null } }> {
  return apiFetch(`/api/debts/${id}/payments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function deletePayment(id: string, paymentId: string): Promise<DebtView> {
  return apiFetch<DebtView>(`/api/debts/${id}/payments/${paymentId}`, {
    method: 'DELETE',
  });
}

export function deleteDebt(id: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/api/debts/${id}`, { method: 'DELETE' });
}
