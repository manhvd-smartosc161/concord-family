export interface TransactionView {
  id: string;
  date: string;
  amount: number;
  note: string | null;
  source: string;
  fund: { id: string; name: string; type: 'personal' | 'joint' };
  category: { id: string; name: string; icon: string | null } | null;
  loggedBy: { id: string; name: string };
}

export interface TransactionFilters {
  fundId?: string;
  from?: string;
  to?: string;
  q?: string;
  offset?: number;
  limit?: number;
}

export interface TransactionPage {
  items: TransactionView[];
  total: number;
}

export interface UpdateTransactionPayload {
  fundId?: string;
  amount?: number;
  categoryId?: string | null;
  note?: string | null;
}
