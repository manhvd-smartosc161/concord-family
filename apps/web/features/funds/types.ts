export type FundAccessLevel = 'owner' | 'joint' | 'private';

export interface EnvelopeProgress {
  percent: number | null;
  paceStatus: 'ahead' | 'on_track' | 'behind' | null;
  daysElapsed: number | null;
  daysTotal: number | null;
  daysRemaining: number | null;
  monthContribution: number | null;
  reached: boolean;
}

export interface FundView {
  id: string;
  name: string;
  type: 'personal' | 'joint';
  accessLevel: FundAccessLevel;
  balance: number | null;
  openingBalance: number | null;
  purpose: 'spending' | 'savings' | 'investment';
  targetAmount: number | null;
  targetDeadline: string | null;
  monthlyContributionTarget: number | null;
  archivedAt: string | null;
  progress?: EnvelopeProgress;
}

export interface CreateEnvelopePayload {
  name: string;
  purpose?: 'savings' | 'investment';
  targetAmount?: number;
  targetDeadline?: string;
  monthlyContributionTarget?: number;
}

export interface UpdateEnvelopePayload {
  name?: string;
  purpose?: 'savings' | 'investment';
  targetAmount?: number | null;
  targetDeadline?: string | null;
  monthlyContributionTarget?: number | null;
}
