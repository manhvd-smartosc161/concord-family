export type DebtDirection = 'lent' | 'borrowed';
export type DebtStatus = 'open' | 'settled';

export interface DebtView {
  id: string;
  direction: DebtDirection;
  counterpartyName: string;
  principal: number;
  remainingAmount: number;
  paidAmount: number;
  status: DebtStatus;
  fundId: string;
  fundName: string;
  openedAt: string;
  closedAt: string | null;
  note: string | null;
  isLegacy: boolean;
}

export interface DebtPaymentView {
  id: string;
  kind: 'open' | 'repayment';
  amount: number;
  transactionId: string;
  paidAt: string;
  note: string | null;
}

export interface DebtSummary {
  totalLent: number;
  totalBorrowed: number;
  openLentCount: number;
  openBorrowedCount: number;
}

export interface DebtDetail {
  debt: DebtView;
  payments: DebtPaymentView[];
}

export interface CreateDebtPayload {
  direction: DebtDirection;
  counterpartyName: string;
  principal: number;
  fundId: string;
  note?: string;
  openedAt?: string;
  isLegacy?: boolean;
}

export interface RecordPaymentPayload {
  amount: number;
  note?: string;
  paidAt?: string;
}
