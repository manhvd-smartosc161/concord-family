'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { UserAvatar } from '@/features/auth/components/user-avatar';
import type { AuthUser } from '@/features/auth/types';
import type { Task, TaskAssignee, TaskCategory, TaskStatus, UpdateTaskInput } from '../types';

const CATEGORY_CONFIG: Record<TaskCategory, { bar: string; chip: string }> = {
  shopping:  { bar: 'bg-sky-400',     chip: 'bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400' },
  chores:    { bar: 'bg-amber-400',   chip: 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400' },
  finance:   { bar: 'bg-emerald-500', chip: 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400' },
  goal:      { bar: 'bg-violet-500',  chip: 'bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400' },
  cooking:   { bar: 'bg-orange-400',  chip: 'bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400' },
  health:    { bar: 'bg-rose-400',    chip: 'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400' },
  kids:      { bar: 'bg-pink-400',    chip: 'bg-pink-100 dark:bg-pink-950/40 text-pink-700 dark:text-pink-400' },
  transport: { bar: 'bg-slate-400',   chip: 'bg-slate-100 dark:bg-slate-950/40 text-slate-700 dark:text-slate-400' },
};

const NEXT_STATUS: Record<TaskStatus, TaskStatus | null> = {
  todo: 'in_progress',
  in_progress: 'done',
  done: null,
};

interface Props {
  open: boolean;
  task: Task | null;
  members: AuthUser[];
  onClose: () => void;
  onUpdate: (id: string, input: UpdateTaskInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function TaskDetailModal({ open, task, members, onClose, onUpdate, onDelete }: Props) {
  const t = useTranslations('tasks');
  const tCommon = useTranslations('common');

  const CATEGORIES: { value: TaskCategory; icon: string; label: string }[] = [
    { value: 'shopping',  icon: '🛒', label: t('category_shopping') },
    { value: 'chores',    icon: '🏠', label: t('category_chores') },
    { value: 'finance',   icon: '💰', label: t('category_finance') },
    { value: 'goal',      icon: '🎯', label: t('category_goal') },
    { value: 'cooking',   icon: '🍳', label: t('category_cooking') },
    { value: 'health',    icon: '🏥', label: t('category_health') },
    { value: 'kids',      icon: '👶', label: t('category_kids') },
    { value: 'transport', icon: '🚗', label: t('category_transport') },
  ];

  const ASSIGNEES: { value: TaskAssignee; label: string }[] = [
    { value: 'both',    label: `👫 ${t('assignee_both')}` },
    { value: 'husband', label: `👨 ${t('assignee_husband')}` },
    { value: 'wife',    label: `👩 ${t('assignee_wife')}` },
  ];

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftNote, setDraftNote] = useState('');
  const [draftAssignee, setDraftAssignee] = useState<TaskAssignee>('both');
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && task) {
      setDraftTitle(task.title);
      setDraftDescription(task.description ?? '');
      setDraftNote(task.note ?? '');
      setDraftAssignee(task.assignee);
      setEditing(false);
      setConfirmDelete(false);
    }
  }, [open, task]);

  useEffect(() => {
    if (editing) setTimeout(() => titleRef.current?.focus(), 30);
  }, [editing]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (editing) setEditing(false);
        else onClose();
      }
    }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, editing, onClose]);

  if (!open || !task) return null;

  const cat = CATEGORY_CONFIG[task.category];
  const catEntry = CATEGORIES.find((c) => c.value === task.category);
  const nextStatus = NEXT_STATUS[task.status];
  const isDone = task.status === 'done';
  const assigneeAvatars = task.assignee === 'both'
    ? members
    : members.filter((m) => m.role === task.assignee);

  const STATUS_STYLE: Record<TaskStatus, string> = {
    todo: 'bg-muted text-muted-foreground',
    in_progress: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    done: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  };
  const STATUS_LABEL: Record<TaskStatus, string> = {
    todo: t('status_todo'),
    in_progress: t('status_in_progress'),
    done: t('status_done'),
  };

  async function handleSave() {
    if (!draftTitle.trim()) return;
    setSaving(true);
    await onUpdate(task!.id, {
      title: draftTitle.trim(),
      assignee: draftAssignee,
      description: draftDescription.trim() || null,
      note: draftNote.trim() || null,
    });
    setSaving(false);
    setEditing(false);
  }

  async function handleStatusAdvance() {
    if (!nextStatus) return;
    setSaving(true);
    await onUpdate(task!.id, { status: nextStatus });
    setSaving(false);
  }

  async function handleDelete() {
    setSaving(true);
    await onDelete(task!.id);
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => { if (!editing) onClose(); }}
      />
      <div className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-card shadow-2xl ring-1 ring-border sm:rounded-2xl">
        {/* Color bar top */}
        <div className={`h-1 w-full ${cat.bar}`} />

        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-4 pb-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cat.chip}`}>
            {catEntry?.icon} {catEntry?.label}
          </span>
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[task.status]}`}>
            {STATUS_LABEL[task.status]}
          </span>
          <div className="ml-auto flex items-center gap-1">
            {!editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={tCommon('edit')}
              >
                <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
                  <path d="M8.5 1.5l2 2-6 6H2.5v-2l6-6z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={tCommon('close')}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M11 3L3 11M3 3l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 pb-2 pt-1">
          {editing ? (
            <div className="space-y-3">
              <input
                ref={titleRef}
                type="text"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleSave(); }}
                placeholder={t('title_placeholder')}
                className="w-full rounded-xl border border-input bg-muted px-3 py-2.5 text-sm font-semibold text-foreground placeholder:font-normal placeholder:text-muted-foreground focus:border-emerald-300 focus:bg-background focus:outline-none focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900"
                disabled={saving}
              />
              <textarea
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
                placeholder={t('description_placeholder')}
                rows={4}
                className="w-full resize-none rounded-xl border border-input bg-muted px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-emerald-300 focus:bg-background focus:outline-none focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900"
                disabled={saving}
              />
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t('assignee_label')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {ASSIGNEES.map((a) => (
                    <button
                      key={a.value}
                      type="button"
                      onClick={() => setDraftAssignee(a.value)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                        draftAssignee === a.value
                          ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-200 dark:ring-emerald-900'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                value={draftNote}
                onChange={(e) => setDraftNote(e.target.value)}
                placeholder={t('note_placeholder')}
                rows={2}
                className="w-full resize-none rounded-xl border border-input bg-muted px-3 py-2 text-xs text-muted-foreground placeholder:text-muted-foreground focus:border-emerald-300 focus:bg-background focus:outline-none focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900"
                disabled={saving}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <h2 className={`text-base font-semibold leading-snug text-foreground ${isDone ? 'line-through decoration-muted-foreground decoration-[1.5px]' : ''}`}>
                {task.title}
              </h2>
              {task.description ? (
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{task.description}</p>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="text-xs text-muted-foreground/50 hover:text-muted-foreground"
                >
                  + {t('description_placeholder')}
                </button>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                {assigneeAvatars.map((m) => (
                  <div key={m.id} className="flex items-center gap-1.5">
                    <UserAvatar user={m} size={20} />
                    <span className="text-xs text-muted-foreground">{m.name}</span>
                  </div>
                ))}
              </div>
              {task.note && (
                <div className="rounded-lg bg-muted px-3 py-2 text-xs italic text-muted-foreground">
                  {task.note}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t border-border px-5 py-3">
          {confirmDelete ? (
            <>
              <span className="flex-1 text-xs text-muted-foreground">{tCommon('delete')} &ldquo;{task.title}&rdquo;?</span>
              <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted">
                {tCommon('cancel')}
              </button>
              <button type="button" onClick={handleDelete} disabled={saving} className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-40">
                {tCommon('delete')}
              </button>
            </>
          ) : editing ? (
            <>
              <button type="button" onClick={() => setEditing(false)} className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted">
                {tCommon('cancel')}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !draftTitle.trim()}
                className="ml-auto rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
              >
                {saving ? tCommon('saving') : tCommon('save')}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/50 hover:bg-red-50 dark:hover:bg-red-900/60 hover:text-red-400"
                aria-label={tCommon('delete')}
              >
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <path d="M2 3.5h10M5 3.5V2h4v1.5M5.5 6v5M8.5 6v5M3 3.5l.7 8.5h6.6l.7-8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              {nextStatus && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleStatusAdvance}
                  className={`ml-auto flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all disabled:opacity-40 ${
                    task.status === 'todo'
                      ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200'
                      : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200'
                  }`}
                >
                  {task.status === 'todo' ? (
                    <><svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"><polygon points="2,1 7,4 2,7"/></svg>{t('start')}</>
                  ) : (
                    <><svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>{t('done')}</>
                  )}
                </button>
              )}
              {isDone && (
                <span className="ml-auto flex items-center gap-1 text-xs font-medium text-emerald-500">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  {t('completed')}
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
