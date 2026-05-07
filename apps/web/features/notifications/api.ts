import { apiFetch } from '@/lib/api-client';
import type { RegisterDeviceTokenPayload } from './types';

export function registerDeviceToken(
  payload: RegisterDeviceTokenPayload,
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>('/api/notifications/device-tokens', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function unregisterDeviceToken(token: string): Promise<void> {
  return apiFetch<void>(
    `/api/notifications/device-tokens/${encodeURIComponent(token)}`,
    { method: 'DELETE' },
  );
}
