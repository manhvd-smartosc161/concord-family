export type DebtDirection = 'i_owe' | 'they_owe_me';
export type DebtVisibility = 'private' | 'shared';
export type DebtStatus = 'open' | 'closed';

export interface DebtView {
  id: string;
  direction: DebtDirection;
  counterparty: string;
  principal: number;
  outstanding: number;
  visibility: DebtVisibility;
  dueDate: string | null;
  note: string | null;
  status: DebtStatus;
  ownerId: string;
  isMine: boolean;
  createdAt: string;
  closedAt: string | null;
}

export interface DebtPaymentView {
  id: string;
  debtId: string;
  transactionId: string | null;
  amount: number;
  paidAt: string;
  note: string | null;
}

export interface DebtDetail extends DebtView {
  payments: DebtPaymentView[];
}

export interface DebtMatch {
  id: string;
  counterparty: string;
  outstanding: number;
  direction: DebtDirection;
  score: number;
}

export interface CreateDebtPayload {
  direction: DebtDirection;
  counterparty: string;
  principal: number;
  visibility?: DebtVisibility;
  dueDate?: string | null;
  note?: string | null;
}

export interface UpdateDebtPayload {
  counterparty?: string;
  principal?: number;
  visibility?: DebtVisibility;
  dueDate?: string | null;
  note?: string | null;
}

export interface CreatePaymentPayload {
  amount: number;
  paidAt: string;
  transactionId?: string;
  note?: string;
}

export interface ListDebtsFilter {
  status?: DebtStatus;
  direction?: DebtDirection;
  visibility?: DebtVisibility;
}
