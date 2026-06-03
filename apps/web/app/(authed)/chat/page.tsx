'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ApiError } from '@/lib/api-client';
import { formatVND } from '@/lib/format';
import { renderBold } from '@/features/chat/lib/render-bold';
import {
  createChatSession,
  deleteChatSession,
  listChatMessages,
  listChatSessions,
  sendChat,
} from '@/features/chat/api';
import type { ChatSessionView, ParseAction } from '@/features/chat/types';
import { createImportantDate } from '@/features/important-dates/api';
import { createTransaction } from '@/features/transactions/api';
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
  imagePreviews?: string[];
}

interface PendingImage {
  id: string;
  dataUrl: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  base64: string;
}

const MAX_IMAGES = 4;
const MAX_INPUT_BYTES = 25 * 1024 * 1024;
const RESIZE_MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

function loadImageBitmap(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Không đọc được ảnh (định dạng có thể không hỗ trợ).'));
    };
    img.src = url;
  });
}

async function readImageFile(file: File): Promise<PendingImage> {
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('Ảnh quá lớn (tối đa 25MB).');
  }
  const isGif = file.type === 'image/gif';
  if (isGif) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Không đọc được ảnh.'));
      reader.readAsDataURL(file);
    });
    const base64 = dataUrl.split(',')[1] ?? '';
    return {
      id: crypto.randomUUID(),
      dataUrl,
      mediaType: 'image/gif',
      base64,
    };
  }

  const img = await loadImageBitmap(file);
  const { width: srcW, height: srcH } = img;
  const scale = Math.min(
    1,
    RESIZE_MAX_DIMENSION / Math.max(srcW, srcH),
  );
  const dstW = Math.round(srcW * scale);
  const dstH = Math.round(srcH * scale);
  const canvas = document.createElement('canvas');
  canvas.width = dstW;
  canvas.height = dstH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Không xử lý được ảnh trên thiết bị này.');
  ctx.drawImage(img, 0, 0, dstW, dstH);
  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  const base64 = dataUrl.split(',')[1] ?? '';
  return {
    id: crypto.randomUUID(),
    dataUrl,
    mediaType: 'image/jpeg',
    base64,
  };
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
    accentSoft: 'bg-slate-50 dark:bg-slate-900/40',
    accentText: 'text-slate-700 dark:text-slate-300',
    accentBorder: 'border-slate-400 dark:border-slate-700',
    accentBorderSoft: 'border-slate-300 dark:border-slate-700',
    ring: 'focus-within:ring-2 focus-within:ring-slate-200/60 dark:focus-within:ring-slate-800 focus-within:border-slate-400 dark:focus-within:border-slate-600',
    icon: '🔒',
    bubbleAgent: 'bg-card ring-1 ring-dashed ring-slate-300 dark:ring-slate-700',
    borderStyle: 'border-dashed',
    composerBorder: 'border-solid border-slate-200 dark:border-slate-800',
    chatBg: '',
  },
  public: {
    accent: 'bg-emerald-700',
    accentSoft: 'bg-emerald-50 dark:bg-emerald-950/40',
    accentText: 'text-emerald-700',
    accentBorder: 'border-emerald-300 dark:border-emerald-900',
    accentBorderSoft: 'border-emerald-200 dark:border-emerald-900',
    ring: 'focus-within:ring-2 focus-within:ring-emerald-200/60 dark:focus-within:ring-emerald-900 focus-within:border-emerald-300 dark:focus-within:border-emerald-900',
    icon: '🏠',
    bubbleAgent: 'bg-card ring-1 ring-border',
    borderStyle: 'border-solid',
    composerBorder: 'border-solid border-emerald-200 dark:border-emerald-900',
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
  if (action.kind === 'important_date_proposed') {
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
  if (
    action.kind === 'transaction_proposed' ||
    action.kind === 'transaction_needs_note'
  ) {
    const state = loadTxnProposalState(msgId, actIdx);
    if (!state) return action;
    if (state.kind === 'confirmed') {
      return {
        kind: 'transaction_proposal_logged',
        id: state.id,
        fundName: state.fundName,
        amount: state.amount,
        categoryName: state.categoryName,
        balance: state.balance,
      };
    }
    return { kind: 'transaction_proposal_dismissed' };
  }
  return action;
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
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [activeMode, setActiveMode] = useState<'private' | 'public'>('private');
  const [sessionDrawerOpen, setSessionDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
    if (isLoading) return;
    const trimmed = text.trim();
    const imagesToSend = pendingImages;
    if (!trimmed && imagesToSend.length === 0) return;

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
    setPendingImages([]);
    setImageError(null);
    setMessages((m) => [
      ...m,
      {
        id: crypto.randomUUID(),
        role: 'user',
        text: trimmed || (imagesToSend.length > 0 ? `📸 ${imagesToSend.length} ảnh` : ''),
        author: { id: user.id, name: user.name },
        imagePreviews:
          imagesToSend.length > 0
            ? imagesToSend.map((img) => img.dataUrl)
            : undefined,
      },
    ]);
    setIsLoading(true);

    try {
      const res = await sendChat(
        trimmed,
        sid,
        imagesToSend.length > 0
          ? imagesToSend.map((img) => ({
              mediaType: img.mediaType,
              data: img.base64,
            }))
          : undefined,
      );
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
            a.kind === 'logged' ||
            a.kind === 'updated' ||
            a.kind === 'deleted' ||
            a.kind === 'debt_opened' ||
            a.kind === 'debt_payment_recorded',
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

  async function handlePickImages(files: FileList | null) {
    if (!files || files.length === 0) return;
    const slots = MAX_IMAGES - pendingImages.length;
    if (slots <= 0) {
      setImageError(`Tối đa ${MAX_IMAGES} ảnh mỗi lần gửi.`);
      return;
    }
    const arr = Array.from(files).slice(0, slots);
    const next: PendingImage[] = [];
    setImageError(null);
    for (const f of arr) {
      try {
        next.push(await readImageFile(f));
      } catch (err) {
        setImageError((err as Error).message);
        break;
      }
    }
    if (next.length > 0) setPendingImages((prev) => [...prev, ...next]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removePendingImage(id: string) {
    setPendingImages((prev) => prev.filter((p) => p.id !== id));
    setImageError(null);
  }

  function hasImageInDrag(e: React.DragEvent): boolean {
    const types = e.dataTransfer?.types;
    if (!types) return false;
    for (let i = 0; i < types.length; i++) {
      if (types[i] === 'Files') return true;
    }
    return false;
  }

  function handleDragEnter(e: React.DragEvent) {
    if (!hasImageInDrag(e)) return;
    e.preventDefault();
    dragCounter.current += 1;
    setIsDragging(true);
  }

  function handleDragOver(e: React.DragEvent) {
    if (!hasImageInDrag(e)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!hasImageInDrag(e)) return;
    e.preventDefault();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    const imageFiles = Array.from(files).filter((f) =>
      f.type.startsWith('image/'),
    );
    if (imageFiles.length === 0) {
      setImageError('Chỉ chấp nhận file ảnh.');
      return;
    }
    const dt = new DataTransfer();
    for (const f of imageFiles) dt.items.add(f);
    void handlePickImages(dt.files);
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
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </aside>

      <div
        className="relative flex min-h-0 flex-1 flex-col transition-colors duration-200"
        style={{
          backgroundColor: activeMode === 'private'
            ? 'var(--chat-private-bg)'
            : 'var(--chat-public-bg)',
        }}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="pointer-events-none absolute inset-3 z-30 flex items-center justify-center rounded-2xl border-2 border-dashed border-emerald-400 bg-emerald-50/85 backdrop-blur-sm dark:border-emerald-500 dark:bg-emerald-950/70">
            <div className="flex flex-col items-center gap-2 text-emerald-700 dark:text-emerald-300">
              <svg
                className="h-10 w-10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <circle cx="9" cy="11" r="2" />
                <path d="M21 17l-5-5-9 9" />
              </svg>
              <span className="text-sm font-medium">
                {t('drop_to_upload')}
              </span>
            </div>
          </div>
        )}
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
              {pendingImages.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {pendingImages.map((img) => (
                    <div
                      key={img.id}
                      className="group relative h-16 w-16 overflow-hidden rounded-lg border border-border bg-card"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.dataUrl}
                        alt="preview"
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removePendingImage(img.id)}
                        aria-label="Xoá ảnh"
                        className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-foreground/70 text-[10px] font-bold text-white hover:bg-foreground"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {imageError && (
                <p className="mb-1 text-[11px] text-rose-600 dark:text-rose-400">
                  ⚠️ {imageError}
                </p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => void handlePickImages(e.target.files)}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => void handlePickImages(e.target.files)}
              />
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
                className="block min-h-[24px] w-full resize-none border-0 bg-transparent text-sm leading-6 placeholder:text-muted-foreground focus:outline-none focus:ring-0"
                style={{ maxHeight: '200px' }}
                disabled={isLoading || loadingMessages}
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setPickerOpen((v) => !v)}
                      disabled={isLoading || pendingImages.length >= MAX_IMAGES}
                      aria-label={t('attach_image')}
                      aria-expanded={pickerOpen}
                      title={t('attach_image')}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-background hover:text-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200/60 dark:focus:ring-emerald-900 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                    >
                      <svg
                        className="h-[18px] w-[18px]"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="5" width="18" height="14" rx="2" />
                        <circle cx="9" cy="11" r="2" />
                        <path d="M21 17l-5-5-9 9" />
                      </svg>
                    </button>
                    {pickerOpen && (
                      <>
                        <button
                          type="button"
                          aria-label="close"
                          onClick={() => setPickerOpen(false)}
                          className="fixed inset-0 z-10 cursor-default"
                        />
                        <div
                          role="menu"
                          className="absolute bottom-full left-0 z-20 mb-2 w-44 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
                        >
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setPickerOpen(false);
                              cameraInputRef.current?.click();
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                          >
                            <svg
                              className="h-4 w-4 text-emerald-600"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={1.8}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                              <circle cx="12" cy="13" r="4" />
                            </svg>
                            {t('picker_camera')}
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setPickerOpen(false);
                              fileInputRef.current?.click();
                            }}
                            className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                          >
                            <svg
                              className="h-4 w-4 text-emerald-600"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={1.8}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <rect x="3" y="5" width="18" height="14" rx="2" />
                              <circle cx="9" cy="11" r="2" />
                              <path d="M21 17l-5-5-9 9" />
                            </svg>
                            {t('picker_gallery')}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  <span className="hidden text-[11px] text-muted-foreground sm:inline">
                    {t('shift_enter_newline')}
                  </span>
                </div>
                <button
                  type="submit"
                  disabled={
                    isLoading ||
                    (!input.trim() && pendingImages.length === 0)
                  }
                  aria-label={t('send')}
                  title={`${t('send')} (Enter)`}
                  className={`flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full px-3.5 text-sm font-medium text-white shadow-sm transition-all active:scale-95 ${theme.accent} hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-emerald-200/60 dark:focus:ring-emerald-900 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100`}
                >
                  <span className="hidden sm:inline">{t('send')}</span>
                  <svg
                    className="h-3.5 w-3.5"
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
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
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
              ? 'bg-card text-slate-700 dark:text-slate-300 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700'
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
  searchQuery,
  onSearchChange,
}: {
  sessions: ChatSessionView[];
  activeId: string | null;
  onDelete: (id: string) => void;
  theme: Theme;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}) {
  const t = useTranslations('chat');
  const groupLabels = useMemo<GroupLabels>(() => ({
    today: t('group_today'), yesterday: t('group_yesterday'),
    last7: t('group_7days'), last30: t('group_30days'), older: t('group_older'),
  }), [t]);
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, searchQuery]);
  const grouped = useMemo(() => groupByDate(filtered, groupLabels), [filtered, groupLabels]);
  const isSearching = searchQuery.trim().length > 0;
  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div className="px-3 pb-2 pt-2">
        <SearchBox value={searchQuery} onChange={onSearchChange} placeholder={t('search_placeholder')} />
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {sessions.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            {t('no_conversations')}
          </div>
        )}
        {sessions.length > 0 && filtered.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            {t('no_search_results')}
          </div>
        )}
        {grouped.map(({ label, items }) => (
          <SessionGroup
            key={label}
            label={label}
            items={items}
            activeId={activeId}
            onDelete={onDelete}
            theme={theme}
            forceExpanded={isSearching}
          />
        ))}
      </div>
    </div>
  );
}

function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <svg
        className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-muted py-1.5 pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus:border-emerald-300 focus:bg-background focus:outline-none focus:ring-1 focus:ring-emerald-200/60 dark:focus:border-emerald-900 dark:focus:ring-emerald-900"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

const COLLAPSED_PER_GROUP = 3;

function SessionGroup({
  label,
  items,
  activeId,
  onDelete,
  theme,
  forceExpanded,
}: {
  label: string;
  items: ChatSessionView[];
  activeId: string | null;
  onDelete: (id: string) => void;
  theme: Theme;
  forceExpanded: boolean;
}) {
  const t = useTranslations('chat');
  const [expanded, setExpanded] = useState(false);
  const containsActive = activeId ? items.some((s) => s.id === activeId) : false;
  const showAll = forceExpanded || expanded || containsActive;
  const visible = showAll ? items : items.slice(0, COLLAPSED_PER_GROUP);
  const hiddenCount = items.length - visible.length;
  return (
    <div className="mb-3">
      <h4 className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </h4>
      <ul className="space-y-0.5">
        {visible.map((s) => (
          <SessionItem
            key={s.id}
            session={s}
            active={s.id === activeId}
            onDelete={() => onDelete(s.id)}
            theme={theme}
          />
        ))}
      </ul>
      {!forceExpanded && items.length > COLLAPSED_PER_GROUP && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 w-full rounded-md px-2 py-1 text-left text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {showAll && !containsActive
            ? t('show_less')
            : hiddenCount > 0
              ? t('show_more', { n: hiddenCount })
              : null}
        </button>
      )}
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
          className="hidden rounded p-1 text-muted-foreground transition-colors hover:bg-rose-50 dark:hover:bg-rose-900/60 hover:text-rose-600 group-hover:block"
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
  searchQuery,
  onSearchChange,
}: {
  sessions: ChatSessionView[];
  activeId: string | null;
  onDelete: (id: string) => void;
  onPick: () => void;
  theme: Theme;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}) {
  const t = useTranslations('chat');
  const groupLabels = useMemo<GroupLabels>(() => ({
    today: t('group_today'), yesterday: t('group_yesterday'),
    last7: t('group_7days'), last30: t('group_30days'), older: t('group_older'),
  }), [t]);
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, searchQuery]);
  const grouped = useMemo(() => groupByDate(filtered, groupLabels), [filtered, groupLabels]);
  const isSearching = searchQuery.trim().length > 0;
  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div className="px-3 pb-2 pt-2">
        <SearchBox value={searchQuery} onChange={onSearchChange} placeholder={t('search_placeholder')} />
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {sessions.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            {t('no_conversations')}
          </div>
        )}
        {sessions.length > 0 && filtered.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            {t('no_search_results')}
          </div>
        )}
        {grouped.map(({ label, items }) => (
          <SessionGroupDrawer
            key={label}
            label={label}
            items={items}
            activeId={activeId}
            onDelete={onDelete}
            onPick={onPick}
            theme={theme}
            forceExpanded={isSearching}
          />
        ))}
      </div>
    </div>
  );
}

function SessionGroupDrawer({
  label,
  items,
  activeId,
  onDelete,
  onPick,
  theme,
  forceExpanded,
}: {
  label: string;
  items: ChatSessionView[];
  activeId: string | null;
  onDelete: (id: string) => void;
  onPick: () => void;
  theme: Theme;
  forceExpanded: boolean;
}) {
  const t = useTranslations('chat');
  const [expanded, setExpanded] = useState(false);
  const containsActive = activeId ? items.some((s) => s.id === activeId) : false;
  const showAll = forceExpanded || expanded || containsActive;
  const visible = showAll ? items : items.slice(0, COLLAPSED_PER_GROUP);
  const hiddenCount = items.length - visible.length;
  return (
    <div className="mb-3">
      <h4 className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </h4>
      <ul className="space-y-0.5">
        {visible.map((s) => (
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
      {!forceExpanded && items.length > COLLAPSED_PER_GROUP && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 w-full rounded-md px-2 py-1 text-left text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {showAll && !containsActive
            ? t('show_less')
            : hiddenCount > 0
              ? t('show_more', { n: hiddenCount })
              : null}
        </button>
      )}
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
          className="hidden rounded p-1 text-muted-foreground transition-colors hover:bg-rose-50 dark:hover:bg-rose-900/60 hover:text-rose-600 group-hover:block"
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
            ? 'border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300'
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
                ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-950 dark:text-amber-100'
                : theme.bubbleAgent + ' text-foreground shadow-sm'
          }`}
        >
          {msg.imagePreviews && msg.imagePreviews.length > 0 && (
            <div
              className={`mb-2 flex flex-wrap gap-1.5 ${msg.text ? '' : 'mb-0'}`}
            >
              {msg.imagePreviews.map((src, i) => (
                <a
                  key={`${msg.id}-img-${i}`}
                  href={src}
                  target="_blank"
                  rel="noreferrer"
                  className="block h-24 w-24 overflow-hidden rounded-lg ring-1 ring-white/30"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`upload-${i}`}
                    className="h-full w-full object-cover"
                  />
                </a>
              ))}
            </div>
          )}
          {msg.text && (
            <div className="whitespace-pre-wrap">
              {msg.role === 'agent' ? renderBold(msg.text) : msg.text}
            </div>
          )}
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
            ? 'border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-300'
            : 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300'
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
            ? 'border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300'
            : 'border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-300'
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
      <div className="rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-xs text-amber-900 dark:text-amber-300">
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
      <div className="rounded-md border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-xs text-emerald-900 dark:text-emerald-300">
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
  if (action.kind === 'transaction_proposed') {
    return (
      <TransactionProposedCard
        action={action}
        messageId={messageId}
        actionIndex={actionIndex}
        onMutate={onMutate}
      />
    );
  }
  if (action.kind === 'transaction_needs_note') {
    return (
      <TransactionNeedsNoteCard
        action={action}
        messageId={messageId}
        actionIndex={actionIndex}
        onMutate={onMutate}
      />
    );
  }
  if (action.kind === 'transaction_proposal_logged') {
    const isExpense = action.amount < 0;
    return (
      <div
        className={`rounded-md border px-3 py-2 text-xs ${
          isExpense
            ? 'border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-300'
            : 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300'
        }`}
      >
        <div className="flex items-center gap-1.5 font-semibold">
          ✅ <span>Đã ghi</span>
        </div>
        <div className="mt-0.5 font-mono font-semibold tabular-nums">
          {formatVND(action.amount, true)}
        </div>
        <div className="mt-0.5 text-[11px] opacity-80">
          {action.fundName}
          {action.categoryName ? ` • ${action.categoryName}` : ''} ·{' '}
          {t('action_new_balance')}{' '}
          <span className="font-mono tabular-nums">
            {formatVND(action.balance)}
          </span>
        </div>
      </div>
    );
  }
  if (action.kind === 'transaction_proposal_dismissed') {
    return (
      <div className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
        ⊘ {t('action_proposal_dismissed')}
      </div>
    );
  }
  if (action.kind === 'tool_error') {
    return (
      <div className="rounded-md border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-xs text-rose-900 dark:text-rose-300">
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
    <div className="rounded-md border border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-950/40 px-3 py-2.5 text-xs text-sky-900 dark:text-sky-300">
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
    <div className="rounded-md border border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-950/40 px-3 py-2.5 text-xs text-sky-900 dark:text-sky-300">
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

type TransactionProposalState =
  | {
      kind: 'confirmed';
      id: string;
      fundName: string;
      amount: number;
      categoryName: string | null;
      balance: number;
    }
  | { kind: 'dismissed' };

function loadTxnProposalState(
  msgId: string,
  actIdx: number,
): TransactionProposalState | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(`concord_txn_proposal_${msgId}_${actIdx}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TransactionProposalState;
  } catch {
    return null;
  }
}

function saveTxnProposalState(
  msgId: string,
  actIdx: number,
  state: TransactionProposalState,
): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    `concord_txn_proposal_${msgId}_${actIdx}`,
    JSON.stringify(state),
  );
}

function TransactionProposedCard({
  action,
  messageId,
  actionIndex,
  onMutate,
}: {
  action: Extract<ParseAction, { kind: 'transaction_proposed' }>;
  messageId: string;
  actionIndex: number;
  onMutate: (msgId: string, actIdx: number, next: ParseAction) => void;
}) {
  const t = useTranslations('chat');
  const tCommon = useTranslations('common');
  const { reloadFunds } = useAuthedLayout();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isExpense = action.amount < 0;

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      const view = await createTransaction({
        fundName: action.fundName,
        amount: action.amount,
        categoryName: action.categoryName ?? undefined,
        note: action.note ?? undefined,
        date: action.date ?? undefined,
      });
      const next: ParseAction = {
        kind: 'transaction_proposal_logged',
        id: view.id,
        fundName: view.fund.name,
        amount: view.amount,
        categoryName: view.category?.name ?? null,
        balance: 0,
      };
      saveTxnProposalState(messageId, actionIndex, {
        kind: 'confirmed',
        id: view.id,
        fundName: view.fund.name,
        amount: view.amount,
        categoryName: view.category?.name ?? null,
        balance: 0,
      });
      onMutate(messageId, actionIndex, next);
      void reloadFunds();
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
    saveTxnProposalState(messageId, actionIndex, { kind: 'dismissed' });
    onMutate(messageId, actionIndex, { kind: 'transaction_proposal_dismissed' });
  }

  return (
    <div
      className={`rounded-md border px-3 py-2.5 text-xs ${
        isExpense
          ? 'border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/30'
          : 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/30'
      } text-foreground`}
    >
      <div
        className={`flex items-center gap-1.5 font-semibold ${
          isExpense
            ? 'text-rose-900 dark:text-rose-300'
            : 'text-emerald-900 dark:text-emerald-300'
        }`}
      >
        📸 <span>Đề xuất giao dịch từ ảnh</span>
      </div>
      <div className="mt-1.5 font-mono text-sm font-semibold tabular-nums">
        {formatVND(action.amount, true)}
      </div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">
        {action.fundName}
        {action.categoryName ? ` • ${action.categoryName}` : ''}
        {action.note ? ` • ${action.note}` : ''}
      </div>
      {action.sourceHint && (
        <div className="mt-0.5 text-[10px] italic text-muted-foreground">
          từ {action.sourceHint}
        </div>
      )}
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
          {submitting ? tCommon('saving') : t('confirm_log')}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={submitting}
          className="rounded-md border border-border bg-card px-3 py-1 text-[11px] text-foreground hover:bg-muted disabled:opacity-50"
        >
          {t('dismiss')}
        </button>
      </div>
    </div>
  );
}

function TransactionNeedsNoteCard({
  action,
  messageId,
  actionIndex,
  onMutate,
}: {
  action: Extract<ParseAction, { kind: 'transaction_needs_note' }>;
  messageId: string;
  actionIndex: number;
  onMutate: (msgId: string, actIdx: number, next: ParseAction) => void;
}) {
  const t = useTranslations('chat');
  const tCommon = useTranslations('common');
  const { reloadFunds } = useAuthedLayout();
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isExpense = action.amount < 0;
  const suggestions = isExpense
    ? ['Ăn trưa', 'Cà phê', 'Gửi xe', 'Đi chợ', 'Xăng']
    : ['Lương', 'Thưởng', 'Hoàn tiền'];

  async function handleConfirm() {
    const trimmed = note.trim();
    if (!trimmed) {
      setError(t('note_required'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const finalNote = action.counterparty
        ? `${trimmed} (${action.counterparty})`
        : trimmed;
      const view = await createTransaction({
        fundName: action.fundName,
        amount: action.amount,
        categoryName: action.categoryName ?? undefined,
        note: finalNote,
        date: action.date ?? undefined,
      });
      const next: ParseAction = {
        kind: 'transaction_proposal_logged',
        id: view.id,
        fundName: view.fund.name,
        amount: view.amount,
        categoryName: view.category?.name ?? null,
        balance: 0,
      };
      saveTxnProposalState(messageId, actionIndex, {
        kind: 'confirmed',
        id: view.id,
        fundName: view.fund.name,
        amount: view.amount,
        categoryName: view.category?.name ?? null,
        balance: 0,
      });
      onMutate(messageId, actionIndex, next);
      void reloadFunds();
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
    saveTxnProposalState(messageId, actionIndex, { kind: 'dismissed' });
    onMutate(messageId, actionIndex, { kind: 'transaction_proposal_dismissed' });
  }

  return (
    <div className="rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50/70 dark:bg-amber-950/30 px-3 py-2.5 text-xs text-foreground">
      <div className="flex items-center gap-1.5 font-semibold text-amber-900 dark:text-amber-300">
        ❓ <span>{t('needs_note_title')}</span>
      </div>
      <div className="mt-1.5 font-mono text-sm font-semibold tabular-nums">
        {formatVND(action.amount, true)}
      </div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">
        {action.fundName}
        {action.counterparty ? ` • với ${action.counterparty}` : ''}
        {action.sourceHint ? ` • ${action.sourceHint}` : ''}
      </div>
      <div className="mt-2">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void handleConfirm();
            }
          }}
          placeholder={t('needs_note_placeholder')}
          disabled={submitting}
          autoFocus
          className="w-full rounded-md border border-amber-200 dark:border-amber-800 bg-card px-2.5 py-1.5 text-[12px] text-foreground placeholder:text-muted-foreground focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-300/60 dark:focus:ring-amber-700 disabled:opacity-60"
        />
        <div className="mt-1.5 flex flex-wrap gap-1">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setNote(s)}
              disabled={submitting}
              className="rounded-full border border-amber-200 dark:border-amber-800 bg-card px-2 py-0.5 text-[10px] text-amber-900 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <div className="mt-1.5 text-[11px] text-rose-700">⚠️ {error}</div>
      )}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting || !note.trim()}
          className="rounded-md bg-emerald-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? tCommon('saving') : t('confirm_log')}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={submitting}
          className="rounded-md border border-border bg-card px-3 py-1 text-[11px] text-foreground hover:bg-muted disabled:opacity-50"
        >
          {t('dismiss')}
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
