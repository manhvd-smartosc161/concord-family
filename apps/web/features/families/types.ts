import type { LoginResponse } from '../auth/types';

export interface FamilyView {
  id: string;
  name: string;
  weddingDate: string | null;
  createdById: string;
  completedAt: string | null;
}

export interface FamilyMember {
  id: string;
  name: string;
  email: string;
  role: 'husband' | 'wife' | null;
  gender: 'male' | 'female';
  birthdate: string | null;
}

export interface FamilyMembersView {
  family: FamilyView;
  members: FamilyMember[];
}

export interface InvitationPreview {
  invitation: { token: string; email: string; expiresAt: string };
  family: FamilyView;
  inviter: { name: string };
}

export interface CreateFamilyPayload {
  name: string;
  weddingDate?: string;
}

export interface CreateInvitationResponse {
  id: string;
  email: string;
  token: string;
  link: string;
  expiresAt: string;
}

export type FamilyMutationResponse = LoginResponse;
