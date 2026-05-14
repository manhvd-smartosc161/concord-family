'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
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
import { createImportantDate } from '@/features/important-dates/api';
import { useAuthedLayout } from '../layout';
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

const SUGGESTIONS_BY_MODE: Record<'private' | 'public', string[]> = {
  private: [
    'vừa đổ xăng 200k',
    'cà phê Highland 65k',
    'lương về 25 triệu',
    'mua sách 250k',
  ],
  public: [
    'mua sữa Bin 350k',
    'tiền điện tháng 5 1.2tr',
    'ăn cơm cả nhà 800k',
    'học phí Bin 5 triệu',
  ],
};

type Theme = {
  accent: string;
  accentSoft: string;
  accentText: string;
  accentBorder: string;
  accentBorderSoft: string;
  ring: string;
  icon: string;
  bubbleAgent: string;
  borderStyle: string;
  composerBorder: string;
  chatBg: string;
};

const THEMES: Record<'private' | 'public', Theme> = {
  private: {
    accent: 'bg-slate-700',
    accentSoft: 'bg-slate-50',
    accentText: 'text-slate-700',
    accentBorder: 'border-slate-400',
    accentBorderSoft: 'border-slate-300',
    ring: 'focus-within:ring-2 focus-within:ring-slate-200/60 focus-within:border-slate-400',
    icon: '🔒',
    bubbleAgent: 'bg-card ring-1 ring-dashed ring-slate-300',
    borderStyle: 'border-dashed',
    composerBorder: 'border-dashed border-slate-300',
    chatBg: '',
  },
  public: {
    accent: 'bg-emerald-700',
    accentSoft: 'bg-emerald-50',
    accentText: 'text-emerald-700',
    accentBorder: 'border-emerald-300',
    accentBorderSoft: 'border-emerald-200',
    ring: 'focus-within:ring-2 focus-within:ring-emerald-200/60 focus-within:border-emerald-300',
    icon: '🏠',
    bubbleAgent: 'bg-card ring-1 ring-border',
    borderStyle: 'border-solid',
    composerBorder: 'border-solid border-emerald-200',
    chatBg: '',
  },
};

type ImportantDateConfirmState =
  | { kind: 'confirmed'; id: string; loggedAt: string }
  | { kind: 'dismissed' };

function loadImportantDateState(
  msgId: string,
  actIdx: number,
): ImportantDateConfirmState | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(`concord_imp_date_${msgId}_${actIdx}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ImportantDateConfirmState;
  } catch {
    return null;
  }
}

function saveImportantDateState(
  msgId: string,
  actIdx: number,
  state: ImportantDateConfirmState,
): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    `concord_imp_date_${msgId}_${actIdx}`,
    JSON.stringify(state),
  );
}

function rehydrateAction(
  msgId: string,
  actIdx: number,
  action: ParseAction,
): ParseAction {
  if (action.kind !== 'important_date_proposed') return action;
  const state = loadImportantDateState(msgId, actIdx);
  if (!state) return action;
  if (state.kind === 'confirmed') {
    return {
      kind: 'important_date_logged',
      id: state.id,
      name: action.name,
      date: action.date,
      type: action.type,
    };
  }
  return { kind: 'important_date_dismissed' };
}

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatInner />
    </Suspense>
  );
}

function ChatInner() {
  const t = useTranslations('chat');
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionIdFromUrl = searchParams.get('session');

  const { user, reloadFunds } = useAuthedLayout();
  const [sessions, setSessions] = useState<ChatSessionView[]>([]);
  const [messages, setMessages] = useState<PendingMessage[]>([]);
  const mutateAction = useCallback(
    (msgId: string, actIdx: number, next: ParseAction) => {
      setMessages((ms) =>
        ms.map((m) =>
          m.id !== msgId
            ? m
            : {
                ...m,
                actions: m.actions?.map((a, i) => (i === actIdx ? next : a)),
              },
        ),
      );
    },
    [],
  );
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const [activeMode, setActiveMode] = useState<'private' | 'public'>('private');
  const [sessionDrawerOpen, setSessionDrawerOpen] = useState(false);

  const theme = THEMES[activeMode];

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

  useEffect(() => {
    if (!sessionIdFromUrl) return;
    const sess = sessions.find((s) => s.id === sessionIdFromUrl);
    if (sess) setActiveMode(sess.visibility);
  }, [sessionIdFromUrl, sessions]);

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
              actions: m.actions
                ? m.actions.map((a, idx) => rehydrateAction(m.id, idx, a))
                : undefined,
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

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, isLoading]);

  useEffect(() => {
    if (!isLoading) composerRef.current?.focus();
  }, [isLoading]);

  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  async function submit(text: string) {
    if (!text.trim() || isLoading) return;
    const trimmed = text.trim();

    let sid = sessionIdFromUrl;
    if (!sid) {
      try {
        const newSession = await createChatSession(activeMode);
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

  function handleModeChange(mode: 'private' | 'public') {
    setActiveMode(mode);
    if (sessionIdFromUrl) {
      router.replace('/chat');
      setMessages([]);
    }
  }

  async function handleDeleteSession(id: string) {
    if (!confirm(t('delete_session_confirm'))) return;
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

  const filteredSessions = sessions.filter((s) => s.visibility === activeMode);
  const currentSession = sessionIdFromUrl
    ? sessions.find((s) => s.id === sessionIdFromUrl)
    : null;

  return (
    <div className="relative flex h-full min-h-0 flex-col lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="hidden h-full min-h-0 flex-col border-r border-border bg-card lg:flex">
        <VisibilityToggle mode={activeMode} onChange={handleModeChange} />

        <div className="border-b border-border p-3">
          <button
            onClick={handleNewChat}
            className={`flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${theme.accentBorderSoft} ${theme.accentSoft} ${theme.accentText} hover:brightness-95`}
          >
            <span className="text-base leading-none">+</span> {t('new_chat')}
          </button>
        </div>

        <SessionList
          sessions={filteredSessions}
          activeId={sessionIdFromUrl}
          onDelete={handleDeleteSession}
          theme={theme}
        />
      </aside>

      <div
        className="relative flex min-h-0 flex-1 flex-col transition-colors duration-200"
        style={{
          backgroundColor: activeMode === 'private'
            ? 'var(--chat-private-bg)'
            : 'var(--chat-public-bg)',
        }}
      >
        <ChatHeader
          mode={activeMode}
          session={currentSession}
          onHistoryOpen={() => setSessionDrawerOpen(true)}
          onNewChat={handleNewChat}
          onModeChange={handleModeChange}
        />

        <div ref={scrollRef} className="relative flex-1 overflow-y-auto px-3 py-6 sm:px-4 lg:px-6">
          <div className="mx-auto max-w-3xl space-y-4">
            {loadingMessages && (
              <div className="text-center text-sm text-muted-foreground">
                Đang tải lịch sử…
              </div>
            )}
            {!loadingMessages && messages.length === 0 && (
              <EmptyState
                onSuggest={submit}
                userName={user.name}
                mode={activeMode}
                theme={theme}
              />
            )}
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                msg={m}
                showAuthor={activeMode === 'public'}
                currentUserId={user.id}
                onMutate={mutateAction}
                theme={theme}
              />
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="inline-flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-500" />
                </span>
                {t('thinking')}
              </div>
            )}
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(input);
          }}
          className="border-t border-border bg-card px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4 lg:px-6"
        >
          <div className="mx-auto max-w-4xl">
            <div className={`rounded-2xl border bg-muted px-3 py-2 transition-colors focus-within:bg-background sm:px-4 sm:py-3 ${theme.composerBorder} ${theme.ring}`}>
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
                  placeholder={t('placeholder')}
                  className="min-h-[36px] w-full resize-none border-0 bg-transparent text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-0 sm:min-h-[44px]"
                  style={{ maxHeight: '200px' }}
                  disabled={isLoading || loadingMessages}
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  aria-label={t('send')}
                  title={`${t('send')} (Enter)`}
                  className={`flex h-9 shrink-0 items-center justify-center rounded-full px-3 text-white shadow-sm transition-all active:scale-95 sm:px-4 ${theme.accent} hover:brightness-110 disabled:cursor-not-allowed disabled:bg-muted`}
                >
                  <span className="hidden text-sm sm:inline">{t('send')}</span>
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
              <span className="mt-1 hidden text-[11px] text-muted-foreground sm:block">
                {t('shift_enter_newline')}
              </span>
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span>{theme.icon}</span>
              {activeMode === 'private' ? t('private_desc') : t('public_desc')}
            </p>
          </div>
        </form>
      </div>

      <MobileDrawer
        open={sessionDrawerOpen}
        onClose={() => setSessionDrawerOpen(false)}
        widthClass="w-[280px]"
      >
        <div className="flex h-full flex-col bg-card">
          <VisibilityToggle
            mode={activeMode}
            onChange={(m) => { handleModeChange(m); setSessionDrawerOpen(false); }}
          />
          <div className="border-b border-border p-3">
            <button
              onClick={() => { handleNewChat(); setSessionDrawerOpen(false); }}
              className={`flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${theme.accentBorderSoft} ${theme.accentSoft} ${theme.accentText} hover:brightness-95`}
            >
              <span className="text-base leading-none">+</span> {t('new_chat')}
            </button>
          </div>
          <SessionListDrawer
            sessions={filteredSessions}
            activeId={sessionIdFromUrl}
            onDelete={handleDeleteSession}
            onPick={() => setSessionDrawerOpen(false)}
            theme={theme}
          />
        </div>
      </MobileDrawer>
    </div>
  );
}

function VisibilityToggle({
  mode,
  onChange,
}: {
  mode: 'private' | 'public';
  onChange: (m: 'private' | 'public') => void;
}) {
  const t = useTranslations('chat');
  return (
    <div className="border-b border-border p-3">
      <div className="flex rounded-xl bg-muted p-0.5">
        <button
          onClick={() => onChange('private')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
            mode === 'private'
              ? 'bg-card text-slate-700 shadow-sm ring-1 ring-slate-200'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <span>🔒</span>
          <span>{t('mode_private')}</span>
        </button>
        <button
          onClick={() => onChange('public')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
            mode === 'public'
              ? 'bg-card text-emerald-700 shadow-sm ring-1 ring-emerald-200'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <span>🏠</span>
          <span>{t('mode_public')}</span>
        </button>
      </div>
    </div>
  );
}

function SessionList({
  sessions,
  activeId,
  onDelete,
  theme,
}: {
  sessions: ChatSessionView[];
  activeId: string | null;
  onDelete: (id: string) => void;
  theme: Theme;
}) {
  const t = useTranslations('chat');
  const groupLabels = useMemo<GroupLabels>(() => ({
    today: t('group_today'), yesterday: t('group_yesterday'),
    last7: t('group_7days'), last30: t('group_30days'), older: t('group_older'),
  }), [t]);
  const grouped = useMemo(() => groupByDate(sessions, groupLabels), [sessions, groupLabels]);
  return (
    <div className="flex-1 overflow-y-auto px-2 py-2">
      {sessions.length === 0 && (
        <div className="px-3 py-6 text-center text-xs text-muted-foreground">
          {t('no_conversations')}
        </div>
      )}
      {grouped.map(({ label, items }) => (
        <div key={label} className="mb-3">
          <h4 className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </h4>
          <ul className="space-y-0.5">
            {items.map((s) => (
              <SessionItem
                key={s.id}
                session={s}
                active={s.id === activeId}
                onDelete={() => onDelete(s.id)}
                theme={theme}
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
  theme,
}: {
  session: ChatSessionView;
  active: boolean;
  onDelete: () => void;
  theme: Theme;
}) {
  const t = useTranslations('chat');
  const locale = useLocale();
  const relLabels: RelativeLabels = useMemo(() => ({
    justNow: t('relative_just_now'),
    minutesAgo: (n) => t('relative_minutes', { n }),
    hoursAgo: (n) => t('relative_hours', { n }),
    locale,
  }), [t, locale]);
  const router = useRouter();
  return (
    <li>
      <div
        className={`group flex items-center gap-1 rounded-lg pr-1 ${
          active ? theme.accentSoft : 'hover:bg-muted'
        }`}
      >
        <button
          onClick={() => router.replace(`/chat?session=${session.id}`)}
          className="flex-1 truncate px-3 py-2 text-left text-xs"
          title={session.title}
        >
          <div className={`truncate ${active ? `font-medium ${theme.accentText}` : 'text-foreground'}`}>
            {session.title}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {t('message_count', { count: session.messageCount })} ·{' '}
            {formatRelative(new Date(session.lastMessageAt), relLabels)}
          </div>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          aria-label="Delete conversation"
          className="hidden rounded p-1 text-muted-foreground transition-colors hover:bg-rose-50 hover:text-rose-600 group-hover:block"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
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
  onPick,
  theme,
}: {
  sessions: ChatSessionView[];
  activeId: string | null;
  onDelete: (id: string) => void;
  onPick: () => void;
  theme: Theme;
}) {
  const t = useTranslations('chat');
  const groupLabels = useMemo<GroupLabels>(() => ({
    today: t('group_today'), yesterday: t('group_yesterday'),
    last7: t('group_7days'), last30: t('group_30days'), older: t('group_older'),
  }), [t]);
  const grouped = useMemo(() => groupByDate(sessions, groupLabels), [sessions, groupLabels]);
  return (
    <div className="flex-1 overflow-y-auto px-2 py-2">
      {sessions.length === 0 && (
        <div className="px-3 py-6 text-center text-xs text-muted-foreground">
          {t('no_conversations')}
        </div>
      )}
      {grouped.map(({ label, items }) => (
        <div key={label} className="mb-3">
          <h4 className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
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
                theme={theme}
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
  theme,
}: {
  session: ChatSessionView;
  active: boolean;
  onDelete: () => void;
  onPick: () => void;
  theme: Theme;
}) {
  const t = useTranslations('chat');
  const locale = useLocale();
  const relLabels: RelativeLabels = useMemo(() => ({
    justNow: t('relative_just_now'),
    minutesAgo: (n) => t('relative_minutes', { n }),
    hoursAgo: (n) => t('relative_hours', { n }),
    locale,
  }), [t, locale]);
  const router = useRouter();
  return (
    <li>
      <div
        className={`group flex items-center gap-1 rounded-lg pr-1 ${
          active ? theme.accentSoft : 'hover:bg-muted'
        }`}
      >
        <button
          onClick={() => { router.replace(`/chat?session=${session.id}`); onPick(); }}
          className="flex-1 truncate px-3 py-2 text-left text-xs"
          title={session.title}
        >
          <div className={`truncate ${active ? `font-medium ${theme.accentText}` : 'text-foreground'}`}>
            {session.title}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {t('message_count', { count: session.messageCount })} ·{' '}
            {formatRelative(new Date(session.lastMessageAt), relLabels)}
          </div>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          aria-label="Delete conversation"
          className="hidden rounded p-1 text-muted-foreground transition-colors hover:bg-rose-50 hover:text-rose-600 group-hover:block"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
          </svg>
        </button>
      </div>
    </li>
  );
}

function ChatHeader({
  mode,
  session,
  onHistoryOpen,
  onNewChat,
  onModeChange,
}: {
  mode: 'private' | 'public';
  session: ChatSessionView | null | undefined;
  onHistoryOpen: () => void;
  onNewChat: () => void;
  onModeChange: (m: 'private' | 'public') => void;
}) {
  const t = useTranslations('chat');
  const theme = THEMES[mode];
  const isPrivate = mode === 'private';
  return (
    <div className="flex items-center justify-between border-b border-border bg-card px-3 py-3 sm:px-4 lg:px-6">
      <div className="flex items-center gap-3 min-w-0">
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${theme.accentBorderSoft} ${theme.accentSoft} ${theme.accentText}`}>
          <span>{theme.icon}</span>
          <span>{isPrivate ? t('mode_private') : t('mode_public')}</span>
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-foreground">
            {session?.title ?? t('new_chat')}
          </h2>
          <p className="hidden truncate text-[11px] text-muted-foreground sm:block">
            {isPrivate ? t('private_desc') : t('public_desc')}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 lg:hidden">
        <button
          type="button"
          onClick={onNewChat}
          title={t('new_chat')}
          className="rounded-lg border border-border bg-card p-1.5 text-foreground transition-colors hover:bg-muted"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => onModeChange(isPrivate ? 'public' : 'private')}
          title={isPrivate ? t('mode_public') : t('mode_private')}
          className="rounded-lg border border-border bg-muted p-1.5 text-foreground transition-colors hover:bg-muted/80"
        >
          <span className="flex h-4 w-4 items-center justify-center text-xs leading-none">
            {isPrivate ? '🏠' : '🔒'}
          </span>
        </button>
        <button
          type="button"
          onClick={onHistoryOpen}
          title={t('history')}
          className="rounded-lg border border-border bg-card p-1.5 text-foreground transition-colors hover:bg-muted"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 3" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function EmptyState({
  onSuggest,
  userName,
  mode,
  theme,
}: {
  onSuggest: (s: string) => void;
  userName: string;
  mode: 'private' | 'public';
  theme: Theme;
}) {
  const t = useTranslations('chat');
  const suggestions = SUGGESTIONS_BY_MODE[mode];
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 py-12 text-center">
      <div className={`flex h-16 w-16 items-center justify-center rounded-2xl text-3xl ${theme.accentSoft}`}>
        {theme.icon}
      </div>
      <div>
        <h3 className="text-base font-semibold text-foreground">
          {t('empty_title')} {userName}!
        </h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {t('empty_desc')}
        </p>
      </div>
      <div className="hidden flex-wrap gap-2 sm:flex">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onSuggest(s)}
            className={`rounded-xl border bg-card px-4 py-3 text-left text-xs text-foreground transition-all hover:bg-muted ${theme.accentBorderSoft}`}
          >
            <span className="block font-mono">{s}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({
  msg,
  showAuthor,
  currentUserId,
  onMutate,
  theme,
}: {
  msg: PendingMessage;
  showAuthor: boolean;
  currentUserId: string;
  onMutate: (msgId: string, actIdx: number, next: ParseAction) => void;
  theme: Theme;
}) {
  const t = useTranslations('chat');
  if (msg.role === 'system') {
    return (
      <div
        className={`rounded-lg px-3 py-2 text-sm ${
          msg.error
            ? 'border border-rose-200 bg-rose-50 text-rose-800'
            : 'bg-muted text-muted-foreground'
        }`}
      >
        {msg.text}
      </div>
    );
  }
  const isUser = msg.role === 'user';
  const isMine = msg.author?.id === currentUserId;
  const alignRight = isUser && isMine;
  return (
    <div className={`flex ${alignRight ? 'justify-end' : 'justify-start'}`}>
      <div className="flex max-w-[85%] flex-col gap-1 lg:max-w-[70%]">
        {showAuthor && msg.author && (
          <div
            className={`text-[10px] font-medium uppercase tracking-wide text-muted-foreground ${
              alignRight ? 'text-right' : 'text-left'
            }`}
          >
            {isUser ? msg.author.name : `🤖 ${msg.author.name} ${t('ai_asking')}`}
          </div>
        )}
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm ${
            alignRight
              ? `${theme.accent} text-white shadow-sm`
              : isUser
                ? 'bg-amber-100 text-amber-950'
                : theme.bubbleAgent + ' text-foreground shadow-sm'
          }`}
        >
          {msg.text && <div className="whitespace-pre-wrap">{msg.text}</div>}
          {msg.actions && msg.actions.length > 0 && (
            <div className={`space-y-1.5 ${msg.text ? 'mt-2' : ''}`}>
              {groupActionsForRender(msg.actions).map((g, gi) =>
                g.kind === 'batch' ? (
                  <ImportantDateBatchCard
                    key={`b-${gi}`}
                    items={g.items.map((it) => ({
                      action: it.action as Extract<
                        ParseAction,
                        { kind: 'important_date_proposed' }
                      >,
                      actionIndex: it.idx,
                    }))}
                    messageId={msg.id}
                    onMutate={onMutate}
                  />
                ) : (
                  <ActionCard
                    key={`s-${g.idx}`}
                    action={g.action}
                    messageId={msg.id}
                    actionIndex={g.idx}
                    onMutate={onMutate}
                  />
                ),
              )}
            </div>
          )}
          {!isUser && msg.usage && (
            <div className="mt-2 text-[10px] text-muted-foreground">
              {msg.usage.inputTokens} in · {msg.usage.outputTokens} out tokens
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionCard({
  action,
  messageId,
  actionIndex,
  onMutate,
}: {
  action: ParseAction;
  messageId: string;
  actionIndex: number;
  onMutate: (msgId: string, actIdx: number, next: ParseAction) => void;
}) {
  const t = useTranslations('chat');
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
          {action.categoryName ? ` • ${action.categoryName}` : ''} · {t('action_new_balance')}{' '}
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
          🔧 <span>{t('action_updated')}</span>
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
      <div className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-foreground">
        🗑️ {t('action_deleted')}
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
      <div className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-foreground">
        <span className="font-medium">✨ {t('action_category_created')} {action.name}</span>
        <span>
          {action.parentName
            ? ` (${t('action_category_sub', { parent: action.parentName })})`
            : ` (${t('action_category_root')})`}
        </span>
        <span className="text-muted-foreground">
          {' '}
          — {action.isEssential ? t('action_essential') : t('action_not_essential')}
        </span>
      </div>
    );
  }
  if (action.kind === 'important_date_proposed') {
    return (
      <ImportantDateProposedCard
        action={action}
        messageId={messageId}
        actionIndex={actionIndex}
        onMutate={onMutate}
      />
    );
  }
  if (action.kind === 'important_date_logged') {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
        ✅ {t('action_date_logged')} <span className="font-medium">{action.name}</span>
        <span className="ml-1 text-muted-foreground">
          — {formatImportantDate(action.date, false, t('lunar_suffix'))}
        </span>
      </div>
    );
  }
  if (action.kind === 'important_date_dismissed') {
    return (
      <div className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
        ⊘ {t('action_date_dismissed')}
      </div>
    );
  }
  if (action.kind === 'tool_error') {
    return (
      <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
        ⚠️ {action.message}
      </div>
    );
  }
  return null;
}

type GroupedActions =
  | { kind: 'single'; action: ParseAction; idx: number }
  | {
      kind: 'batch';
      items: { action: ParseAction; idx: number }[];
    };

function groupActionsForRender(actions: ParseAction[]): GroupedActions[] {
  const out: GroupedActions[] = [];
  let i = 0;
  while (i < actions.length) {
    const a = actions[i];
    if (a.kind === 'important_date_proposed') {
      const items: { action: ParseAction; idx: number }[] = [];
      while (
        i < actions.length &&
        actions[i].kind === 'important_date_proposed'
      ) {
        items.push({ action: actions[i], idx: i });
        i++;
      }
      if (items.length === 1) {
        out.push({ kind: 'single', action: items[0].action, idx: items[0].idx });
      } else {
        out.push({ kind: 'batch', items });
      }
    } else {
      out.push({ kind: 'single', action: a, idx: i });
      i++;
    }
  }
  return out;
}

function ImportantDateBatchCard({
  items,
  messageId,
  onMutate,
}: {
  items: {
    action: Extract<ParseAction, { kind: 'important_date_proposed' }>;
    actionIndex: number;
  }[];
  messageId: string;
  onMutate: (msgId: string, actIdx: number, next: ParseAction) => void;
}) {
  const t = useTranslations('chat');
  const tCommon = useTranslations('common');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    const errors: string[] = [];
    for (const { action, actionIndex } of items) {
      try {
        const created = await createImportantDate({
          name: action.name,
          type: action.type,
          date: action.date,
          isLunar: action.isLunar ?? false,
          remindDaysBefore:
            Array.isArray(action.remindDaysBefore) &&
            action.remindDaysBefore.length > 0
              ? action.remindDaysBefore
              : [0, 2],
          notes: action.notes ?? undefined,
        });
        saveImportantDateState(messageId, actionIndex, {
          kind: 'confirmed',
          id: created.id,
          loggedAt: new Date().toISOString(),
        });
        onMutate(messageId, actionIndex, {
          kind: 'important_date_logged',
          id: created.id,
          name: created.name,
          date: created.date,
          type: created.type,
        });
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Lỗi không xác định';
        errors.push(`${action.name}: ${msg}`);
      }
    }
    setSubmitting(false);
    if (errors.length > 0) setError(errors.join(' · '));
  }

  function handleDismissAll() {
    for (const { actionIndex } of items) {
      saveImportantDateState(messageId, actionIndex, { kind: 'dismissed' });
      onMutate(messageId, actionIndex, { kind: 'important_date_dismissed' });
    }
  }

  return (
    <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs text-sky-900">
      <div className="flex items-center gap-1.5 font-semibold">
        🗓 <span>Đề xuất {items.length} ngày quan trọng</span>
      </div>
      <ul className="mt-2 space-y-1.5">
        {items.map(({ action }, i) => (
          <li
            key={i}
            className="flex items-start gap-2 rounded-md bg-background/70 px-2 py-1.5"
          >
            <span className="mt-0.5 text-sm leading-none">
              {importantDateIcon(action.type)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-medium text-foreground">
                {action.name}
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {formatImportantDate(action.date, action.isLunar, t('lunar_suffix'))}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {error && (
        <div className="mt-2 text-[11px] text-rose-700">⚠️ {error}</div>
      )}
      <div className="mt-2.5 flex gap-2">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting}
          className="rounded-md bg-emerald-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {submitting
            ? tCommon('saving')
            : t('confirm_all', { count: items.length })}
        </button>
        <button
          type="button"
          onClick={handleDismissAll}
          disabled={submitting}
          className="rounded-md border border-border bg-card px-3 py-1 text-[11px] text-foreground hover:bg-muted disabled:opacity-50"
        >
          Bỏ qua
        </button>
      </div>
      <div className="mt-1.5 text-[10px] italic text-muted-foreground">
        Sai chỗ nào? Reply bảo AI sửa lại.
      </div>
    </div>
  );
}

function ImportantDateProposedCard({
  action,
  messageId,
  actionIndex,
  onMutate,
}: {
  action: Extract<ParseAction, { kind: 'important_date_proposed' }>;
  messageId: string;
  actionIndex: number;
  onMutate: (msgId: string, actIdx: number, next: ParseAction) => void;
}) {
  const t = useTranslations('chat');
  const tCommon = useTranslations('common');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const safeReminders =
    Array.isArray(action.remindDaysBefore) && action.remindDaysBefore.length > 0
      ? action.remindDaysBefore
      : [0, 2];
  const icon = importantDateIcon(action.type);
  const dateLabel = formatImportantDate(action.date, action.isLunar, t('lunar_suffix'));
  const reminderLabel = formatReminderDays(safeReminders, {
    none: t('reminder_none'),
    onDay: t('reminder_on_day'),
    daysBeforeFn: (n) => t('reminder_days_before', { n }),
  });

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      const created = await createImportantDate({
        name: action.name,
        type: action.type,
        date: action.date,
        isLunar: action.isLunar ?? false,
        remindDaysBefore: safeReminders,
        notes: action.notes ?? undefined,
      });
      saveImportantDateState(messageId, actionIndex, {
        kind: 'confirmed',
        id: created.id,
        loggedAt: new Date().toISOString(),
      });
      onMutate(messageId, actionIndex, {
        kind: 'important_date_logged',
        id: created.id,
        name: created.name,
        date: created.date,
        type: created.type,
      });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Lỗi không xác định';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function handleDismiss() {
    saveImportantDateState(messageId, actionIndex, { kind: 'dismissed' });
    onMutate(messageId, actionIndex, { kind: 'important_date_dismissed' });
  }

  return (
    <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs text-sky-900">
      <div className="flex items-center gap-1.5 font-semibold">
        {icon} <span>Đề xuất ngày quan trọng</span>
      </div>
      <div className="mt-1 font-medium text-foreground">{action.name}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">
        {dateLabel}
        {action.notes ? ` · ${action.notes}` : ''}
      </div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">
        Nhắc: {reminderLabel}
      </div>
      {error && (
        <div className="mt-1.5 text-[11px] text-rose-700">⚠️ {error}</div>
      )}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting}
          className="rounded-md bg-emerald-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {submitting ? tCommon('saving') : t('confirm')}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={submitting}
          className="rounded-md border border-border bg-card px-3 py-1 text-[11px] text-foreground hover:bg-muted disabled:opacity-50"
        >
          Bỏ qua
        </button>
      </div>
    </div>
  );
}

function importantDateIcon(
  type: 'birthday' | 'death_anniversary' | 'anniversary' | 'other',
): string {
  switch (type) {
    case 'birthday':
      return '🎂';
    case 'death_anniversary':
      return '🕯';
    case 'anniversary':
      return '💑';
    default:
      return '📅';
  }
}

function formatImportantDate(iso: string, isLunar = false, lunarSuffix = '(âm)'): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  const formatted = `${parseInt(d, 10)}/${parseInt(m, 10)}/${y}`;
  return isLunar ? `${formatted} ${lunarSuffix}` : formatted;
}

function formatReminderDays(
  days: number[] | undefined | null,
  labels: { none: string; onDay: string; daysBeforeFn: (n: number) => string },
): string {
  if (!days || days.length === 0) return labels.none;
  return days.map((d) => (d === 0 ? labels.onDay : labels.daysBeforeFn(d))).join(' + ');
}

interface GroupLabels {
  today: string; yesterday: string; last7: string; last30: string; older: string;
}

function groupByDate(sessions: ChatSessionView[], labels: GroupLabels) {
  const today = startOfDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const last7 = new Date(today);
  last7.setDate(today.getDate() - 7);
  const last30 = new Date(today);
  last30.setDate(today.getDate() - 30);

  const buckets: Record<string, ChatSessionView[]> = {
    [labels.today]: [],
    [labels.yesterday]: [],
    [labels.last7]: [],
    [labels.last30]: [],
    [labels.older]: [],
  };
  for (const s of sessions) {
    const t = new Date(s.lastMessageAt);
    if (t >= today) buckets[labels.today].push(s);
    else if (t >= yesterday) buckets[labels.yesterday].push(s);
    else if (t >= last7) buckets[labels.last7].push(s);
    else if (t >= last30) buckets[labels.last30].push(s);
    else buckets[labels.older].push(s);
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

interface RelativeLabels {
  justNow: string;
  minutesAgo: (n: number) => string;
  hoursAgo: (n: number) => string;
  locale: string;
}

function formatRelative(d: Date, labels: RelativeLabels): string {
  const diffMin = Math.round((Date.now() - +d) / 60000);
  if (diffMin < 1) return labels.justNow;
  if (diffMin < 60) return labels.minutesAgo(diffMin);
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return labels.hoursAgo(diffH);
  return d.toLocaleDateString(labels.locale === 'en' ? 'en-US' : 'vi-VN', { day: '2-digit', month: '2-digit' });
}
