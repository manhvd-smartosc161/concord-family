import { apiFetch } from '@/lib/api-client';
import type {
  CreateDebtPayload,
  CreatePaymentPayload,
  DebtDetail,
  DebtMatch,
  DebtPaymentView,
  DebtView,
  ListDebtsFilter,
  UpdateDebtPayload,
} from './types';

function buildQuery(filter: ListDebtsFilter): string {
  const params = new URLSearchParams();
  if (filter.status) params.set('status', filter.status);
  if (filter.direction) params.set('direction', filter.direction);
  if (filter.visibility) params.set('visibility', filter.visibility);
  const s = params.toString();
  return s ? `?${s}` : '';
}

export function listDebts(filter: ListDebtsFilter = {}): Promise<DebtView[]> {
  return apiFetch<DebtView[]>(`/api/debts${buildQuery(filter)}`);
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

export function updateDebt(id: string, payload: UpdateDebtPayload): Promise<DebtView> {
  return apiFetch<DebtView>(`/api/debts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteDebt(id: string): Promise<void> {
  return apiFetch<void>(`/api/debts/${id}`, { method: 'DELETE' });
}

export function closeDebt(id: string): Promise<DebtView> {
  return apiFetch<DebtView>(`/api/debts/${id}/close`, { method: 'POST' });
}

export function reopenDebt(id: string): Promise<DebtView> {
  return apiFetch<DebtView>(`/api/debts/${id}/reopen`, { method: 'POST' });
}

export function createPayment(
  debtId: string,
  payload: CreatePaymentPayload,
): Promise<DebtPaymentView> {
  return apiFetch<DebtPaymentView>(`/api/debts/${debtId}/payments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function deletePayment(debtId: string, paymentId: string): Promise<void> {
  return apiFetch<void>(`/api/debts/${debtId}/payments/${paymentId}`, {
    method: 'DELETE',
  });
}

export function matchDebts(
  counterparty: string,
  direction?: 'i_owe' | 'they_owe_me',
): Promise<DebtMatch[]> {
  return apiFetch<DebtMatch[]>('/api/debts/match', {
    method: 'POST',
    body: JSON.stringify({ counterparty, direction }),
  });
}
