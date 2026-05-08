'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '@/lib/api-client';
import { formatVND } from '@/lib/format';
import {
  createChatSession,
  deleteChatSession,
  listChatMessages,
  listChatSessions,
  sendChat,
} from '@/features/chat/api';
import type { ChatSessionView, ParseAction } from '@/features/chat/types';
import type { FundView } from '@/features/funds/types';
import { useAuthedLayout } from '../layout';
import { pickFundIcon } from '@/features/funds/components/fund-card';
import { MobileDrawer } from '@/components/ui';

interface PendingMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  text: string;
  actions?: ParseAction[];
  usage?: { inputTokens: number; outputTokens: number };
  author?: { id: string; name: string };
  error?: boolean;
}

const SUGGESTIONS_BY_FUND: Record<string, string[]> = {
  personal: [
    'vừa đổ xăng 200k',
    'cà phê Highland 65k',
    'lương về 25 triệu',
    'mua sách 250k',
  ],
  joint: [
    'mua sữa Bin 350k',
    'tiền điện tháng 5 1.2tr',
    'ăn cơm cả nhà 800k',
    'học phí Bin 5 triệu',
  ],
};

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionIdFromUrl = searchParams.get('session');

  const { user, funds, reloadFunds } = useAuthedLayout();
  const [sessions, setSessions] = useState<ChatSessionView[]>([]);
  const [messages, setMessages] = useState<PendingMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const ownFund = useMemo(
    () => funds.find((f) => f.accessLevel === 'owner'),
    [funds],
  );
  const [activeFundId, setActiveFundId] = useState<string | null>(null);
  const [sessionDrawerOpen, setSessionDrawerOpen] = useState(false);

  // ─── Load sessions ──────────────────────────────────────────────────
  const reloadSessions = useCallback(async () => {
    try {
      const next = await listChatSessions();
      setSessions(next);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    void reloadSessions();
  }, [reloadSessions]);

  // ─── Set initial active fund once sessions + funds are loaded ───────
  useEffect(() => {
    if (activeFundId) return;
    if (sessionIdFromUrl) {
      const sess = sessions.find((s) => s.id === sessionIdFromUrl);
      if (sess) {
        setActiveFundId(sess.fundId);
        return;
      }
    }
    if (ownFund) setActiveFundId(ownFund.id);
  }, [sessionIdFromUrl, sessions, ownFund, activeFundId]);

  // ─── Sync activeFund when session changes from URL ──────────────────
  useEffect(() => {
    if (!sessionIdFromUrl) return;
    const sess = sessions.find((s) => s.id === sessionIdFromUrl);
    if (sess && sess.fundId !== activeFundId) {
      setActiveFundId(sess.fundId);
    }
  }, [sessionIdFromUrl, sessions, activeFundId]);

  // ─── Load messages when session changes ─────────────────────────────
  useEffect(() => {
    if (!sessionIdFromUrl) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    listChatMessages(sessionIdFromUrl)
      .then((msgs) => {
        setMessages(
          msgs.map(
            (m): PendingMessage => ({
              id: m.id,
              role: m.role,
              text: m.text,
              actions: m.actions ?? undefined,
              usage: m.usage ?? undefined,
              author: m.author,
            }),
          ),
        );
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 404) {
          router.replace('/chat');
        } else {
          setMessages([
            {
              id: crypto.randomUUID(),
              role: 'system',
              text: `Không tải được lịch sử: ${(err as Error).message}`,
              error: true,
            },
          ]);
        }
      })
      .finally(() => setLoadingMessages(false));
  }, [sessionIdFromUrl, router]);

  // ─── Auto-scroll on new message ─────────────────────────────────────
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, isLoading]);

  // ─── Auto-focus composer khi AI vừa xong, để gõ tiếp ngay ───────────
  useEffect(() => {
    if (!isLoading && activeFundId) {
      composerRef.current?.focus();
    }
  }, [isLoading, activeFundId]);

  // ─── Auto-resize textarea theo nội dung ─────────────────────────────
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  // ─── Submit (auto-creates session if needed) ────────────────────────
  async function submit(text: string) {
    if (!text.trim() || isLoading) return;
    const trimmed = text.trim();

    // Resolve session: existing or auto-create in active fund
    let sid = sessionIdFromUrl;
    if (!sid) {
      if (!activeFundId) {
        setMessages((m) => [
          ...m,
          {
            id: crypto.randomUUID(),
            role: 'system',
            text: 'Chưa chọn quỹ nào. Click vào tab quỹ ở sidebar trái.',
            error: true,
          },
        ]);
        return;
      }
      try {
        const newSession = await createChatSession(activeFundId);
        sid = newSession.id;
        router.replace(`/chat?session=${newSession.id}`);
      } catch (err) {
        setMessages((m) => [
          ...m,
          {
            id: crypto.randomUUID(),
            role: 'system',
            text: `Không tạo được session: ${(err as Error).message}`,
            error: true,
          },
        ]);
        return;
      }
    }

    setInput('');
    setMessages((m) => [
      ...m,
      {
        id: crypto.randomUUID(),
        role: 'user',
        text: trimmed,
        author: { id: user.id, name: user.name },
      },
    ]);
    setIsLoading(true);

    try {
      const res = await sendChat(trimmed, sid);
      setMessages((m) => [
        ...m,
        {
          id: res.agentMessageId,
          role: 'agent',
          text: res.reply,
          actions: res.actions,
          usage: res.usage,
          author: { id: user.id, name: user.name },
        },
      ]);
      await reloadSessions();
      if (
        res.actions.some(
          (a) =>
            a.kind === 'logged' || a.kind === 'updated' || a.kind === 'deleted',
        )
      ) {
        await reloadFunds();
      }
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: 'system',
          text: `Lỗi: ${(err as Error).message}`,
          error: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleNewChat() {
    router.replace('/chat');
    setMessages([]);
  }

  function handleTabClick(fundId: string) {
    setActiveFundId(fundId);
    if (sessionIdFromUrl) {
      // Clear session so new chat starts fresh in clicked fund
      router.replace('/chat');
      setMessages([]);
    }
  }

  async function handleDeleteSession(id: string) {
    if (!confirm('Xoá hội thoại này (không hoàn tác)?')) return;
    try {
      await deleteChatSession(id);
      if (id === sessionIdFromUrl) {
        router.replace('/chat');
        setMessages([]);
      }
      await reloadSessions();
    } catch (err) {
      alert(`Không xoá được: ${(err as Error).message}`);
    }
  }

  const filteredSessions = sessions.filter((s) => s.fundId === activeFundId);
  const activeFund = funds.find((f) => f.id === activeFundId);
  const currentSession = sessionIdFromUrl
    ? sessions.find((s) => s.id === sessionIdFromUrl)
    : null;
  const isJointChat = activeFund?.type === 'joint';

  return (
    <div className="flex h-full min-h-0 flex-col lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
      {/* Session sidebar */}
      <aside className="hidden h-full min-h-0 flex-col border-r border-stone-200 bg-white lg:flex">
        <FundTabs
          funds={funds}
          activeId={activeFundId}
          onSelect={handleTabClick}
        />

        <div className="border-b border-stone-100 p-3">
          <button
            onClick={handleNewChat}
            disabled={!activeFundId}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="text-base leading-none">+</span> Cuộc trò chuyện mới
          </button>
        </div>

        <SessionList
          sessions={filteredSessions}
          activeId={sessionIdFromUrl}
          onDelete={handleDeleteSession}
          fundType={activeFund?.type}
        />
      </aside>

      {/* Main chat panel */}
      <div className="flex min-h-0 flex-1 flex-col">
        <ChatHeader
          fund={activeFund}
          session={currentSession}
          onHistoryOpen={() => setSessionDrawerOpen(true)}
        />

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-6 sm:px-4 lg:px-6">
          <div className="mx-auto max-w-3xl space-y-4">
            {loadingMessages && (
              <div className="text-center text-sm text-stone-400">
                Đang tải lịch sử…
              </div>
            )}
            {!loadingMessages && messages.length === 0 && (
              <EmptyState
                onSuggest={submit}
                userName={user.name}
                fund={activeFund}
              />
            )}
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                msg={m}
                showAuthor={isJointChat}
                currentUserId={user.id}
              />
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-stone-500">
                <span className="inline-flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-500" />
                </span>
                Parser đang nghĩ…
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(input);
          }}
          className="border-t border-stone-200 bg-white px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4 lg:px-6"
        >
          <div className="mx-auto max-w-4xl">
            <div className="rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2 transition-colors focus-within:border-emerald-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-100 sm:px-4 sm:py-3">
              <div className="flex items-end gap-2">
                <textarea
                  ref={composerRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      void submit(input);
                    }
                  }}
                  rows={1}
                  placeholder={
                    activeFund
                      ? `Gõ giao dịch cho ${activeFund.name}…`
                      : 'Chọn một quỹ ở sidebar trái'
                  }
                  className="min-h-[36px] w-full resize-none border-0 bg-transparent text-sm leading-relaxed placeholder:text-stone-400 focus:outline-none focus:ring-0 sm:min-h-[44px]"
                  style={{ maxHeight: '200px' }}
                  disabled={isLoading || loadingMessages || !activeFundId}
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim() || !activeFundId}
                  aria-label="Gửi"
                  title="Gửi (Enter)"
                  className="flex h-9 shrink-0 items-center justify-center rounded-full bg-emerald-700 px-3 text-white shadow-sm transition-all hover:bg-emerald-800 active:scale-95 disabled:cursor-not-allowed disabled:bg-stone-300 sm:px-4"
                >
                  <span className="hidden text-sm sm:inline">Gửi</span>
                  <svg
                    className="h-4 w-4 sm:hidden"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12l14-7-7 14-2-5-5-2z" />
                  </svg>
                </button>
              </div>
              <span className="mt-1 hidden text-[11px] text-stone-400 sm:block">
                Shift+Enter để xuống dòng
              </span>
            </div>
            <p className="mt-2 text-[11px] text-stone-400">
              {isJointChat
                ? '🤝 Quỹ chung — cả vợ chồng đều thấy chat này'
                : activeFund?.accessLevel === 'owner'
                  ? '🔒 Quỹ riêng — chỉ bạn thấy chat này'
                  : 'Chọn quỹ để bắt đầu'}
            </p>
          </div>
        </form>
      </div>

      <MobileDrawer
        open={sessionDrawerOpen}
        onClose={() => setSessionDrawerOpen(false)}
        widthClass="w-[280px]"
      >
        <div className="flex h-full flex-col">
          <FundTabs
            funds={funds}
            activeId={activeFundId}
            onSelect={(id) => { handleTabClick(id); setSessionDrawerOpen(false); }}
          />
          <div className="border-b border-stone-100 p-3">
            <button
              onClick={() => { handleNewChat(); setSessionDrawerOpen(false); }}
              disabled={!activeFundId}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="text-base leading-none">+</span> Cuộc trò chuyện mới
            </button>
          </div>
          <SessionListDrawer
            sessions={filteredSessions}
            activeId={sessionIdFromUrl}
            onDelete={handleDeleteSession}
            fundType={activeFund?.type}
            onPick={() => setSessionDrawerOpen(false)}
          />
        </div>
      </MobileDrawer>
    </div>
  );
}

// ─── Fund tabs ────────────────────────────────────────────────────────

function FundTabs({
  funds,
  activeId,
  onSelect,
}: {
  funds: FundView[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1 border-b border-stone-200 p-2">
      {funds.map((f) => {
        const isActive = f.id === activeId;
        const disabled = f.accessLevel === 'private';
        const variant = disabled
          ? 'cursor-not-allowed opacity-40'
          : isActive
            ? (f.purpose === 'savings' || f.purpose === 'investment')
              ? 'bg-sky-50 ring-1 ring-sky-300 text-sky-900'
              : f.type === 'joint'
                ? 'bg-amber-50 ring-1 ring-amber-300 text-amber-900'
                : 'bg-emerald-50 ring-1 ring-emerald-300 text-emerald-900'
            : 'text-stone-600 hover:bg-stone-100';
        const icon = pickFundIcon(f);
        const shortName = f.name.replace('Quỹ ', '');
        return (
          <button
            key={f.id}
            onClick={() => !disabled && onSelect(f.id)}
            disabled={disabled}
            title={disabled ? 'Quỹ riêng tư của người khác' : f.name}
            className={`flex flex-col items-center justify-center rounded-lg px-2 py-2 text-[11px] font-medium transition-colors ${variant}`}
          >
            <span className="mb-0.5 text-base leading-none">{icon}</span>
            <span className="truncate">{shortName}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Session list ─────────────────────────────────────────────────────

function SessionList({
  sessions,
  activeId,
  onDelete,
  fundType,
}: {
  sessions: ChatSessionView[];
  activeId: string | null;
  onDelete: (id: string) => void;
  fundType: 'personal' | 'joint' | undefined;
}) {
  const grouped = useMemo(() => groupByDate(sessions), [sessions]);
  return (
    <div className="flex-1 overflow-y-auto px-2 py-2">
      {sessions.length === 0 && (
        <div className="px-3 py-6 text-center text-xs text-stone-400">
          {fundType === 'joint'
            ? 'Chưa có cuộc trò chuyện chung nào.'
            : 'Chưa có cuộc trò chuyện nào.'}
        </div>
      )}
      {grouped.map(({ label, items }) => (
        <div key={label} className="mb-3">
          <h4 className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
            {label}
          </h4>
          <ul className="space-y-0.5">
            {items.map((s) => (
              <SessionItem
                key={s.id}
                session={s}
                active={s.id === activeId}
                onDelete={() => onDelete(s.id)}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function SessionItem({
  session,
  active,
  onDelete,
}: {
  session: ChatSessionView;
  active: boolean;
  onDelete: () => void;
}) {
  const router = useRouter();
  return (
    <li>
      <div
        className={`group flex items-center gap-1 rounded-lg pr-1 ${
          active ? 'bg-emerald-50' : 'hover:bg-stone-100'
        }`}
      >
        <button
          onClick={() => router.replace(`/chat?session=${session.id}`)}
          className="flex-1 truncate px-3 py-2 text-left text-xs"
          title={session.title}
        >
          <div
            className={`truncate ${
              active ? 'font-medium text-emerald-900' : 'text-stone-700'
            }`}
          >
            {session.title}
          </div>
          <div className="text-[10px] text-stone-400">
            {session.messageCount} tin nhắn ·{' '}
            {formatRelative(new Date(session.lastMessageAt))}
          </div>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label="Xoá hội thoại"
          className="hidden rounded p-1 text-stone-400 transition-colors hover:bg-rose-50 hover:text-rose-600 group-hover:block"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"
            />
          </svg>
        </button>
      </div>
    </li>
  );
}

function SessionListDrawer({
  sessions,
  activeId,
  onDelete,
  fundType,
  onPick,
}: {
  sessions: ChatSessionView[];
  activeId: string | null;
  onDelete: (id: string) => void;
  fundType: 'personal' | 'joint' | undefined;
  onPick: () => void;
}) {
  const grouped = useMemo(() => groupByDate(sessions), [sessions]);
  return (
    <div className="flex-1 overflow-y-auto px-2 py-2">
      {sessions.length === 0 && (
        <div className="px-3 py-6 text-center text-xs text-stone-400">
          {fundType === 'joint'
            ? 'Chưa có cuộc trò chuyện chung nào.'
            : 'Chưa có cuộc trò chuyện nào.'}
        </div>
      )}
      {grouped.map(({ label, items }) => (
        <div key={label} className="mb-3">
          <h4 className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
            {label}
          </h4>
          <ul className="space-y-0.5">
            {items.map((s) => (
              <SessionItemDrawer
                key={s.id}
                session={s}
                active={s.id === activeId}
                onDelete={() => onDelete(s.id)}
                onPick={onPick}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function SessionItemDrawer({
  session,
  active,
  onDelete,
  onPick,
}: {
  session: ChatSessionView;
  active: boolean;
  onDelete: () => void;
  onPick: () => void;
}) {
  const router = useRouter();
  return (
    <li>
      <div
        className={`group flex items-center gap-1 rounded-lg pr-1 ${
          active ? 'bg-emerald-50' : 'hover:bg-stone-100'
        }`}
      >
        <button
          onClick={() => { router.replace(`/chat?session=${session.id}`); onPick(); }}
          className="flex-1 truncate px-3 py-2 text-left text-xs"
          title={session.title}
        >
          <div
            className={`truncate ${
              active ? 'font-medium text-emerald-900' : 'text-stone-700'
            }`}
          >
            {session.title}
          </div>
          <div className="text-[10px] text-stone-400">
            {session.messageCount} tin nhắn ·{' '}
            {formatRelative(new Date(session.lastMessageAt))}
          </div>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label="Xoá hội thoại"
          className="hidden rounded p-1 text-stone-400 transition-colors hover:bg-rose-50 hover:text-rose-600 group-hover:block"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"
            />
          </svg>
        </button>
      </div>
    </li>
  );
}

// ─── Chat header ──────────────────────────────────────────────────────

function ChatHeader({
  fund,
  session,
  onHistoryOpen,
}: {
  fund: FundView | undefined;
  session: ChatSessionView | null | undefined;
  onHistoryOpen: () => void;
}) {
  if (!fund) {
    return (
      <div className="flex items-center justify-between border-b border-stone-200 bg-white px-3 py-3 sm:px-4 lg:px-6">
        <div>
          <h2 className="text-sm font-semibold text-stone-800">Chat</h2>
          <p className="text-[11px] text-stone-500">
            Chọn một quỹ ở sidebar trái để bắt đầu
          </p>
        </div>
        <button
          type="button"
          onClick={onHistoryOpen}
          className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50 lg:hidden"
        >
          <span>Lịch sử</span>
        </button>
      </div>
    );
  }

  const icon = pickFundIcon(fund);
  return (
    <div className="flex items-center justify-between border-b border-stone-200 bg-white px-3 py-3 sm:px-4 lg:px-6">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-800">
          <span>{icon}</span>
          {session?.title ?? `${fund.name} — Cuộc trò chuyện mới`}
        </h2>
        <p className="text-[11px] text-stone-500">
          <span className="hidden sm:inline">{fund.name} · Parser default fund = {fund.name}</span>
          {fund.type === 'joint' && <span className="hidden sm:inline"> · cả vợ chồng cùng thấy</span>}
        </p>
      </div>
      <button
        type="button"
        onClick={onHistoryOpen}
        className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50 lg:hidden"
      >
        <span>Lịch sử</span>
      </button>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────

function EmptyState({
  onSuggest,
  userName,
  fund,
}: {
  onSuggest: (s: string) => void;
  userName: string;
  fund: FundView | undefined;
}) {
  const suggestions = !fund
    ? []
    : SUGGESTIONS_BY_FUND[fund.type] ?? SUGGESTIONS_BY_FUND.personal;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-3xl">
        💬
      </div>
      <div>
        <h3 className="text-base font-semibold text-stone-800">
          Chào {userName}!
        </h3>
        <p className="mt-1 max-w-md text-sm text-stone-500">
          {fund
            ? `Gõ giao dịch — Parser sẽ log vào ${fund.name}.`
            : 'Chọn một quỹ ở sidebar trái để bắt đầu.'}
        </p>
      </div>
      {suggestions.length > 0 && (
        <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
          <div className="flex gap-2 whitespace-nowrap">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => onSuggest(s)}
                className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-left text-xs text-stone-700 transition-all hover:border-emerald-200 hover:bg-emerald-50"
              >
                <span className="block font-mono">{s}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Message bubbles ──────────────────────────────────────────────────

function MessageBubble({
  msg,
  showAuthor,
  currentUserId,
}: {
  msg: PendingMessage;
  showAuthor: boolean;
  currentUserId: string;
}) {
  if (msg.role === 'system') {
    return (
      <div
        className={`rounded-lg px-3 py-2 text-sm ${
          msg.error
            ? 'border border-rose-200 bg-rose-50 text-rose-800'
            : 'bg-stone-100 text-stone-600'
        }`}
      >
        {msg.text}
      </div>
    );
  }
  const isUser = msg.role === 'user';
  const isMine = msg.author?.id === currentUserId;
  // In joint chat, show messages from the OTHER spouse on the LEFT (like SMS)
  const alignRight = isUser && isMine;
  return (
    <div className={`flex ${alignRight ? 'justify-end' : 'justify-start'}`}>
      <div className="flex max-w-[85%] flex-col gap-1 lg:max-w-[70%]">
        {showAuthor && msg.author && (
          <div
            className={`text-[10px] font-medium uppercase tracking-wide text-stone-400 ${
              alignRight ? 'text-right' : 'text-left'
            }`}
          >
            {isUser ? msg.author.name : `🤖 ${msg.author.name} hỏi`}
          </div>
        )}
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm ${
            alignRight
              ? 'bg-emerald-700 text-white shadow-sm shadow-emerald-700/10'
              : isUser
                ? 'bg-amber-100 text-amber-950'
                : 'bg-white text-stone-900 shadow-sm ring-1 ring-stone-200'
          }`}
        >
          {msg.text && <div className="whitespace-pre-wrap">{msg.text}</div>}
          {msg.actions && msg.actions.length > 0 && (
            <div className={`space-y-1.5 ${msg.text ? 'mt-2' : ''}`}>
              {msg.actions.map((a, i) => (
                <ActionCard key={i} action={a} />
              ))}
            </div>
          )}
          {!isUser && msg.usage && (
            <div className="mt-2 text-[10px] text-stone-400">
              {msg.usage.inputTokens} in · {msg.usage.outputTokens} out tokens
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionCard({ action }: { action: ParseAction }) {
  if (action.kind === 'logged') {
    const isExpense = action.amount < 0;
    return (
      <div
        className={`rounded-md border px-3 py-2 text-xs ${
          isExpense
            ? 'border-rose-200 bg-rose-50 text-rose-900'
            : 'border-emerald-200 bg-emerald-50 text-emerald-900'
        }`}
      >
        <div className="font-mono font-semibold tabular-nums">
          {formatVND(action.amount, true)}
        </div>
        <div className="mt-0.5 text-[11px] opacity-80">
          {action.fundName}
          {action.categoryName ? ` • ${action.categoryName}` : ''} · Số dư mới{' '}
          <span className="font-mono tabular-nums">
            {formatVND(action.balance)}
          </span>
        </div>
      </div>
    );
  }
  if (action.kind === 'updated') {
    const isExpense = action.amount < 0;
    return (
      <div
        className={`rounded-md border px-3 py-2 text-xs ${
          isExpense
            ? 'border-amber-200 bg-amber-50 text-amber-900'
            : 'border-sky-200 bg-sky-50 text-sky-900'
        }`}
      >
        <div className="flex items-center gap-1.5 font-semibold">
          🔧 <span>Đã sửa</span>
        </div>
        <div className="font-mono font-semibold tabular-nums">
          {formatVND(action.amount, true)}
        </div>
        <div className="mt-0.5 text-[11px] opacity-80">
          {action.fundName}
          {action.categoryName ? ` • ${action.categoryName}` : ''}
        </div>
      </div>
    );
  }
  if (action.kind === 'deleted') {
    return (
      <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-700">
        🗑️ Đã xoá giao dịch
      </div>
    );
  }
  if (action.kind === 'clarify') {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        ❓ {action.question}
      </div>
    );
  }
  if (action.kind === 'category_created') {
    return (
      <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-700">
        <span className="font-medium">✨ Đã tạo category: {action.name}</span>
        <span>
          {action.parentName ? ` (thuộc ${action.parentName})` : ' (danh mục cha)'}
        </span>
        <span className="text-stone-500">
          {' '}— {action.isEssential ? 'thiết yếu' : 'không thiết yếu'}
        </span>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
      ⚠️ {action.message}
    </div>
  );
}

// ─── Date helpers ─────────────────────────────────────────────────────

function groupByDate(sessions: ChatSessionView[]) {
  const today = startOfDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const last7 = new Date(today);
  last7.setDate(today.getDate() - 7);
  const last30 = new Date(today);
  last30.setDate(today.getDate() - 30);

  const buckets: Record<string, ChatSessionView[]> = {
    'Hôm nay': [],
    'Hôm qua': [],
    '7 ngày trước': [],
    '30 ngày trước': [],
    'Cũ hơn': [],
  };
  for (const s of sessions) {
    const t = new Date(s.lastMessageAt);
    if (t >= today) buckets['Hôm nay'].push(s);
    else if (t >= yesterday) buckets['Hôm qua'].push(s);
    else if (t >= last7) buckets['7 ngày trước'].push(s);
    else if (t >= last30) buckets['30 ngày trước'].push(s);
    else buckets['Cũ hơn'].push(s);
  }
  return Object.entries(buckets)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function formatRelative(d: Date): string {
  const diffMin = Math.round((Date.now() - +d) / 60000);
  if (diffMin < 1) return 'vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH} giờ trước`;
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}
