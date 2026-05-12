'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { UserAvatar } from '@/features/auth/components/user-avatar';
import type { AuthUser } from '@/features/auth/types';
import type { Task, TaskAssignee, TaskCategory, TaskStatus, UpdateTaskInput } from '../types';

const CATEGORY_CONFIG: Record<TaskCategory, { bar: string; chip: string }> = {
  shopping:  { bar: 'bg-sky-400',     chip: 'bg-sky-50/80 text-sky-600' },
  chores:    { bar: 'bg-amber-400',   chip: 'bg-amber-50/80 text-amber-600' },
  finance:   { bar: 'bg-emerald-500', chip: 'bg-emerald-50/80 text-emerald-700' },
  goal:      { bar: 'bg-violet-500',  chip: 'bg-violet-50/80 text-violet-600' },
  cooking:   { bar: 'bg-orange-400',  chip: 'bg-orange-50/80 text-orange-600' },
  health:    { bar: 'bg-rose-400',    chip: 'bg-rose-50/80 text-rose-600' },
  kids:      { bar: 'bg-pink-400',    chip: 'bg-pink-50/80 text-pink-600' },
  transport: { bar: 'bg-slate-400',   chip: 'bg-slate-50/80 text-slate-600' },
};

const NEXT_STATUS: Record<TaskStatus, TaskStatus | null> = {
  todo: 'in_progress',
  in_progress: 'done',
  done: null,
};

interface Props {
  task: Task;
  members: AuthUser[];
  onUpdate: (id: string, input: UpdateTaskInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function TaskCard({ task, members, onUpdate, onDelete }: Props) {
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
  const [draftTitle, setDraftTitle] = useState(task.title);
  const [draftAssignee, setDraftAssignee] = useState<TaskAssignee>(task.assignee);
  const [draftNote, setDraftNote] = useState(task.note ?? '');
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const cat = CATEGORY_CONFIG[task.category];
  const nextStatus = NEXT_STATUS[task.status];
  const isDone = task.status === 'done';
  const catEntry = CATEGORIES.find((c) => c.value === task.category);
  const assigneeAvatars = task.assignee === 'both'
    ? members
    : members.filter((m) => m.role === task.assignee);

  function openEdit() {
    setDraftTitle(task.title);
    setDraftAssignee(task.assignee);
    setDraftNote(task.note ?? '');
    setConfirmDelete(false);
    setEditing(true);
    setTimeout(() => titleRef.current?.focus(), 30);
  }

  async function saveEdit() {
    const trimmed = draftTitle.trim();
    if (!trimmed) return;
    setSaving(true);
    await onUpdate(task.id, { title: trimmed, assignee: draftAssignee, note: draftNote || null });
    setSaving(false);
    setEditing(false);
  }

  async function handleStatusAdvance() {
    if (!nextStatus) return;
    setSaving(true);
    await onUpdate(task.id, { status: nextStatus });
    setSaving(false);
  }

  return (
    <div className={`overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-100/80 transition-shadow hover:shadow-md ${isDone ? 'opacity-55' : ''}`}>

      {editing ? (
        /* ── Edit mode ── */
        <div className="p-3 space-y-2.5">
          <input
            ref={titleRef}
            type="text"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void saveEdit(); if (e.key === 'Escape') setEditing(false); }}
            className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-medium text-stone-800 placeholder-stone-400 focus:border-emerald-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
            placeholder={t('title_placeholder')}
            disabled={saving}
          />

          <div className="flex flex-wrap gap-1.5">
            {ASSIGNEES.map((a) => (
              <button
                key={a.value}
                type="button"
                onClick={() => setDraftAssignee(a.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  draftAssignee === a.value
                    ? 'bg-emerald-100 text-emerald-700 shadow-sm ring-1 ring-emerald-200'
                    : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>

          <textarea
            className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-600 placeholder-stone-400 focus:border-emerald-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
            rows={2}
            placeholder={t('note_placeholder')}
            value={draftNote}
            onChange={(e) => setDraftNote(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg px-3 py-1.5 text-xs text-stone-400 hover:bg-stone-100 hover:text-stone-600"
            >
              {tCommon('cancel')}
            </button>
            <button
              type="button"
              disabled={saving || !draftTitle.trim()}
              onClick={saveEdit}
              className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-40"
            >
              {saving ? tCommon('saving') : tCommon('save')}
            </button>
          </div>
        </div>
      ) : confirmDelete ? (
        /* ── Delete confirm ── */
        <div className="flex items-center gap-3 px-4 py-3.5">
          <svg className="shrink-0 text-red-400" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 2a6 6 0 100 12A6 6 0 008 2zm0 3.5v3m0 2h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <p className="flex-1 text-xs font-medium text-stone-700 leading-snug">
            {tCommon('delete')} &ldquo;<span className="text-stone-900">{task.title}</span>&rdquo;?
          </p>
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs text-stone-400 hover:bg-stone-100 hover:text-stone-600"
          >
            {tCommon('cancel')}
          </button>
          <button
            type="button"
            onClick={() => { setConfirmDelete(false); void onDelete(task.id); }}
            className="shrink-0 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-red-600"
          >
            {tCommon('delete')}
          </button>
        </div>
      ) : (
        /* ── View mode ── */
        <div className="flex gap-0">
          {/* Color bar */}
          <div className={`w-1 shrink-0 rounded-l-2xl ${cat.bar}`} />

          <div className="min-w-0 flex-1 px-3.5 py-3">
            {/* Title + actions */}
            <div className="flex items-start gap-1.5">
              <p
                className={`flex-1 min-w-0 text-sm font-medium leading-snug text-stone-800 ${isDone ? 'line-through decoration-stone-400 decoration-[1.5px]' : ''}`}
              >
                {task.title}
              </p>
              <button
                type="button"
                onClick={openEdit}
                className="shrink-0 mt-px flex h-6 w-6 items-center justify-center rounded-md text-stone-300 transition-colors hover:bg-stone-100 hover:text-stone-500"
                aria-label={tCommon('edit')}
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M8.5 1.5l2 2-6 6H2.5v-2l6-6z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="shrink-0 mt-px flex h-6 w-6 items-center justify-center rounded-md text-stone-300 transition-colors hover:bg-red-50 hover:text-red-400"
                aria-label={tCommon('delete')}
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M9 3L3 9M3 3l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {task.note && (
              <p className="mt-0.5 truncate text-[11px] text-stone-400">{task.note}</p>
            )}

            {/* Footer: chip + avatars + action */}
            <div className="mt-2.5 flex items-center gap-2">
              {catEntry && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${cat.chip}`}>
                  <span className="text-[11px] leading-none">{catEntry.icon}</span>
                  {catEntry.label}
                </span>
              )}

              {assigneeAvatars.length > 0 && (
                <div className="flex -space-x-1.5">
                  {assigneeAvatars.map((m) => (
                    <div key={m.id} className="rounded-full ring-[1.5px] ring-white">
                      <UserAvatar user={m} size={20} />
                    </div>
                  ))}
                </div>
              )}

              {nextStatus && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleStatusAdvance}
                  className={`ml-auto flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition-all disabled:opacity-40 ${
                    task.status === 'todo'
                      ? 'bg-stone-100 text-stone-500 hover:bg-amber-50 hover:text-amber-600'
                      : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                  }`}
                >
                  {task.status === 'todo' ? (
                    <><svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"><polygon points="2,1 7,4 2,7"/></svg>{t('start')}</>
                  ) : (
                    <><svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 4l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>{t('done')}</>
                  )}
                </button>
              )}

              {isDone && (
                <span className="ml-auto flex items-center gap-1 text-[11px] font-medium text-emerald-500">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  {t('completed')}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
