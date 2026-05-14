import { apiFetch } from '@/lib/api-client';
import type { AuthUser, LoginResponse, RegisterPayload } from './types';

export function register(payload: RegisterPayload): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
    auth: false,
  });
}

export function login(email: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    auth: false,
  });
}

export function me(): Promise<AuthUser> {
  return apiFetch<AuthUser>('/api/auth/me');
}

export function familyMembers(): Promise<AuthUser[]> {
  return apiFetch<AuthUser[]>('/api/auth/family-members');
}

export function updateProfile(payload: {
  name?: string;
  birthdate?: string | null;
}): Promise<AuthUser> {
  return apiFetch<AuthUser>('/api/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await apiFetch<void>('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export function uploadAvatar(file: File): Promise<AuthUser> {
  const form = new FormData();
  form.append('file', file);
  return apiFetch<AuthUser>('/api/auth/me/avatar', {
    method: 'POST',
    body: form,
  });
}

export async function forgotPassword(email: string): Promise<void> {
  await apiFetch<void>('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
    auth: false,
  });
}

export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<void> {
  await apiFetch<void>('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
    auth: false,
  });
}
