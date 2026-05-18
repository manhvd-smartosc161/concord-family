'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { UserAvatar } from '@/features/auth/components/user-avatar';
import type { AuthUser } from '@/features/auth/types';
import type { Task, TaskCategory, TaskStatus, UpdateTaskInput } from '../types';

const CATEGORY_CONFIG: Record<TaskCategory, { bar: string; chip: string }> = {
  shopping:  { bar: 'bg-sky-400',     chip: 'bg-sky-50/80 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400' },
  chores:    { bar: 'bg-amber-400',   chip: 'bg-amber-50/80 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400' },
  finance:   { bar: 'bg-emerald-500', chip: 'bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400' },
  goal:      { bar: 'bg-violet-500',  chip: 'bg-violet-50/80 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400' },
  cooking:   { bar: 'bg-orange-400',  chip: 'bg-orange-50/80 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400' },
  health:    { bar: 'bg-rose-400',    chip: 'bg-rose-50/80 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400' },
  kids:      { bar: 'bg-pink-400',    chip: 'bg-pink-50/80 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400' },
  transport: { bar: 'bg-slate-400',   chip: 'bg-slate-50/80 dark:bg-slate-950/40 text-slate-600 dark:text-slate-400' },
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
  onOpenDetail: (task: Task) => void;
}

export function TaskCard({ task, members, onUpdate, onOpenDetail }: Props) {
  const t = useTranslations('tasks');

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

  const [saving, setSaving] = useState(false);

  const cat = CATEGORY_CONFIG[task.category];
  const nextStatus = NEXT_STATUS[task.status];
  const isDone = task.status === 'done';
  const catEntry = CATEGORIES.find((c) => c.value === task.category);
  const assigneeAvatars = task.assignee === 'both'
    ? members
    : members.filter((m) => m.role === task.assignee);

  async function handleStatusAdvance(e: React.MouseEvent) {
    e.stopPropagation();
    if (!nextStatus) return;
    setSaving(true);
    await onUpdate(task.id, { status: nextStatus });
    setSaving(false);
  }

  return (
    <div
      className={`overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-border/80 transition-shadow hover:shadow-md cursor-pointer ${isDone ? 'opacity-55' : ''}`}
      onClick={() => onOpenDetail(task)}
    >
      <div className="flex gap-0">
        <div className={`w-1 shrink-0 rounded-l-2xl ${cat.bar}`} />

        <div className="min-w-0 flex-1 px-3.5 py-3">
          <div className="flex items-start gap-1.5">
            <p className={`flex-1 min-w-0 text-sm font-medium leading-snug text-foreground ${isDone ? 'line-through decoration-muted-foreground decoration-[1.5px]' : ''}`}>
              {task.title}
            </p>
          </div>



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
                  <div key={m.id} className="rounded-full ring-[1.5px] ring-card">
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
                    ? 'bg-muted text-muted-foreground hover:bg-amber-50 dark:hover:bg-amber-900/60 hover:text-amber-600'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
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
    </div>
  );
}
