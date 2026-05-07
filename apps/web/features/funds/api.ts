import { apiFetch } from '@/lib/api-client';
import type {
  CreateEnvelopePayload,
  FundView,
  UpdateEnvelopePayload,
} from './types';

export function listFunds(): Promise<FundView[]> {
  return apiFetch<FundView[]>('/api/funds');
}

export function setFundOpeningBalance(
  fundId: string,
  amount: number,
): Promise<FundView> {
  return apiFetch<FundView>(`/api/funds/${fundId}/opening-balance`, {
    method: 'PUT',
    body: JSON.stringify({ amount }),
  });
}

export function listEnvelopes(): Promise<FundView[]> {
  return apiFetch<FundView[]>('/api/funds/envelopes');
}

export function createEnvelope(
  payload: CreateEnvelopePayload,
): Promise<FundView> {
  return apiFetch<FundView>('/api/funds/envelopes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateEnvelope(
  fundId: string,
  payload: UpdateEnvelopePayload,
): Promise<FundView> {
  return apiFetch<FundView>(`/api/funds/envelopes/${fundId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function archiveEnvelope(fundId: string): Promise<FundView> {
  return apiFetch<FundView>(`/api/funds/envelopes/${fundId}/archive`, {
    method: 'POST',
  });
}

export function unarchiveEnvelope(fundId: string): Promise<FundView> {
  return apiFetch<FundView>(`/api/funds/envelopes/${fundId}/unarchive`, {
    method: 'POST',
  });
}
