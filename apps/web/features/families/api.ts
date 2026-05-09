import { apiFetch } from '@/lib/api-client';
import type {
  CreateFamilyPayload,
  CreateInvitationResponse,
  FamilyMembersView,
  FamilyMutationResponse,
  InvitationPreview,
} from './types';

export function createFamily(
  payload: CreateFamilyPayload,
): Promise<FamilyMutationResponse> {
  return apiFetch<FamilyMutationResponse>('/api/families', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getMyFamily(): Promise<FamilyMembersView> {
  return apiFetch<FamilyMembersView>('/api/families/me');
}

export function createInvitation(
  email: string,
): Promise<CreateInvitationResponse> {
  return apiFetch<CreateInvitationResponse>('/api/families/me/invitations', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function getInvitation(token: string): Promise<InvitationPreview> {
  return apiFetch<InvitationPreview>(`/api/families/invitations/${token}`, {
    auth: false,
  });
}

export function acceptInvitation(
  token: string,
): Promise<FamilyMutationResponse> {
  return apiFetch<FamilyMutationResponse>(
    `/api/families/invitations/${token}/accept`,
    { method: 'POST' },
  );
}

export function leaveFamily(): Promise<FamilyMutationResponse> {
  return apiFetch<FamilyMutationResponse>('/api/families/me/leave', {
    method: 'DELETE',
  });
}

export function updateFamily(payload: {
  name?: string;
  weddingDate?: string | null;
}): Promise<{
  id: string;
  name: string;
  weddingDate: string | null;
  createdById: string;
  completedAt: string | null;
}> {
  return apiFetch('/api/families/me', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}
