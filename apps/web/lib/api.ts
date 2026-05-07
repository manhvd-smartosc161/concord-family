/**
 * Thin fetch wrapper around the Concord NestJS API.
 *
 * All authenticated calls flow through `apiFetch()` which automatically
 * injects `Authorization: Bearer <token>` from localStorage.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const TOKEN_KEY = 'concord_access_token';

// ─── Token storage (client-side only) ──────────────────────────────────

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(TOKEN_KEY);
}

// ─── Types mirroring the API ──────────────────────────────────────────

export type UserRole = 'husband' | 'wife';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

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
  purpose: 'general' | 'envelope';
  targetAmount: number | null;
  targetDeadline: string | null;
  monthlyContributionTarget: number | null;
  archivedAt: string | null;
  progress?: EnvelopeProgress;
}

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

export interface CategoryAggregate {
  categoryId: string | null;
  categoryName: string;
  icon: string | null;
  amount: number;
  count: number;
}

export interface DayAggregate {
  date: string;
  income: number;
  expense: number;
}

export interface MonthlyReport {
  range: { start: string; end: string };
  income: number;
  expense: number;
  net: number;
  txnCount: number;
  byCategory: CategoryAggregate[];
  byDay: DayAggregate[];
}

export interface GoalView {
  id: string;
  type: 'save' | 'spend_under';
  period: 'month' | 'year';
  scope: 'couple' | 'personal';
  targetAmount: number;
  startDate: string;
  deadline: string;
  currentProgress: number;
  projection: number;
  paceStatus: 'ahead' | 'on_track' | 'behind';
  daysElapsed: number;
  daysTotal: number;
  daysRemaining: number;
}

export interface SalaryRule {
  id: string;
  pctToPersonal: number;
  pctToJoint: number;
  fixedAmountToJoint: number | null;
}

export type ParseAction =
  | {
      kind: 'logged';
      id: string;
      fundName: string;
      amount: number;
      categoryName: string | null;
      balance: number;
    }
  | {
      kind: 'updated';
      id: string;
      fundName: string;
      amount: number;
      categoryName: string | null;
    }
  | { kind: 'deleted'; id: string }
  | { kind: 'clarify'; question: string }
  | { kind: 'tool_error'; toolName: string; message: string };

export interface ChatResponse {
  reply: string;
  actions: ParseAction[];
  stopReason: string | null;
  usage: { inputTokens: number; outputTokens: number };
  sessionId: string;
  userMessageId: string;
  agentMessageId: string;
}

export interface ChatSessionView {
  id: string;
  title: string;
  createdAt: string;
  lastMessageAt: string;
  messageCount: number;
  fundId: string;
  fundName: string;
}

export interface ChatMessageView {
  id: string;
  role: 'user' | 'agent';
  text: string;
  actions: ParseAction[] | null;
  usage: { inputTokens: number; outputTokens: number } | null;
  author: { id: string; name: string };
  createdAt: string;
}

// ─── Internal fetch helper ─────────────────────────────────────────────

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function apiFetch<T>(
  path: string,
  init?: RequestInit & { auth?: boolean },
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.auth !== false) {
    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });

  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = (await res.json()) as { message?: string | string[] };
      if (Array.isArray(body.message)) msg = body.message.join(', ');
      else if (body.message) msg = body.message;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Calls ─────────────────────────────────────────────────────────────

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
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

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await apiFetch<void>('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

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

// ─── Envelopes (quỹ mục tiêu) ─────────────────────────────────────────

export interface CreateEnvelopePayload {
  name: string;
  targetAmount?: number;
  targetDeadline?: string;
  monthlyContributionTarget?: number;
}

export interface UpdateEnvelopePayload {
  name?: string;
  targetAmount?: number | null;
  targetDeadline?: string | null;
  monthlyContributionTarget?: number | null;
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

export function listRecentTransactions(limit = 20): Promise<TransactionView[]> {
  return apiFetch<TransactionView[]>(`/api/transactions/recent?limit=${limit}`);
}

export interface TransactionFilters {
  fundId?: string;
  from?: string; // ISO date
  to?: string;   // ISO date
  q?: string;
  offset?: number;
  limit?: number;
}

export interface TransactionPage {
  items: TransactionView[];
  total: number;
}

export function listTransactions(filters: TransactionFilters): Promise<TransactionPage> {
  const qs = new URLSearchParams();
  if (filters.fundId) qs.set('fundId', filters.fundId);
  if (filters.from) qs.set('from', filters.from);
  if (filters.to) qs.set('to', filters.to);
  if (filters.q) qs.set('q', filters.q);
  if (filters.offset != null) qs.set('offset', String(filters.offset));
  if (filters.limit != null) qs.set('limit', String(filters.limit));
  const q = qs.toString();
  return apiFetch<TransactionPage>(
    `/api/transactions${q ? `?${q}` : ''}`,
  );
}

export async function deleteTransaction(id: string): Promise<void> {
  await apiFetch<void>(`/api/transactions/${id}`, { method: 'DELETE' });
}

export interface UpdateTransactionPayload {
  fundId?: string;
  amount?: number;
  categoryId?: string | null;
  note?: string | null;
}

export function updateTransaction(
  id: string,
  patch: UpdateTransactionPayload,
): Promise<TransactionView> {
  return apiFetch<TransactionView>(`/api/transactions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export interface CategoryView {
  id: string;
  name: string;
  parentId: string | null;
  parentName: string | null;
  icon: string | null;
  isEssential: boolean;
}

export function listCategories(): Promise<CategoryView[]> {
  return apiFetch<CategoryView[]>('/api/categories');
}

export function getMonthlyReport(year: number, month: number): Promise<MonthlyReport> {
  return apiFetch<MonthlyReport>(`/api/reports/monthly?year=${year}&month=${month}`);
}

export function listGoals(): Promise<GoalView[]> {
  return apiFetch<GoalView[]>('/api/goals');
}

export function updateYearlySavingsGoal(
  targetAmount: number,
): Promise<GoalView> {
  return apiFetch<GoalView>('/api/goals/yearly-savings', {
    method: 'PUT',
    body: JSON.stringify({ targetAmount }),
  });
}

export function getSalaryRule(): Promise<SalaryRule> {
  return apiFetch<SalaryRule>('/api/salary-rules');
}

export function updateSalaryRule(
  pctToPersonal: number,
  pctToJoint: number,
  fixedAmountToJoint: number | null = null,
): Promise<SalaryRule> {
  return apiFetch<SalaryRule>('/api/salary-rules', {
    method: 'PUT',
    body: JSON.stringify({ pctToPersonal, pctToJoint, fixedAmountToJoint }),
  });
}

export function sendChat(
  message: string,
  sessionId: string,
): Promise<ChatResponse> {
  return apiFetch<ChatResponse>('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message, sessionId }),
  });
}

export function listChatSessions(): Promise<ChatSessionView[]> {
  return apiFetch<ChatSessionView[]>('/api/chat/sessions');
}

export function createChatSession(
  fundId: string,
  title?: string,
): Promise<ChatSessionView> {
  return apiFetch<ChatSessionView>('/api/chat/sessions', {
    method: 'POST',
    body: JSON.stringify(title ? { fundId, title } : { fundId }),
  });
}

export function listChatMessages(sessionId: string): Promise<ChatMessageView[]> {
  return apiFetch<ChatMessageView[]>(
    `/api/chat/sessions/${sessionId}/messages`,
  );
}

export async function deleteChatSession(sessionId: string): Promise<void> {
  await apiFetch<void>(`/api/chat/sessions/${sessionId}`, { method: 'DELETE' });
}

// ─── Format helpers ────────────────────────────────────────────────────

export function formatVND(n: number, withSign = false): string {
  const formatted = Math.abs(n).toLocaleString('vi-VN');
  if (n < 0) return `−${formatted}đ`;
  if (n === 0 || !withSign) return `${formatted}đ`;
  return `+${formatted}đ`;
}
