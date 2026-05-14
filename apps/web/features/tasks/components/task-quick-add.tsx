'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { CreateTaskInput, TaskAssignee } from '../types';

interface Props {
  onAdd: (input: CreateTaskInput) => Promise<void>;
}

export function TaskQuickAdd({ onAdd }: Props) {
  const t = useTranslations('tasks');
  const tCommon = useTranslations('common');

  const ASSIGNEES: { value: TaskAssignee; label: string }[] = [
    { value: 'both',    label: `👫 ${t('assignee_both')}` },
    { value: 'husband', label: `👨 ${t('assignee_husband')}` },
    { value: 'wife',    label: `👩 ${t('assignee_wife')}` },
  ];

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState<TaskAssignee>('both');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleOpen() {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    await onAdd({ title: title.trim(), assignee });
    setTitle('');
    setLoading(false);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setOpen(false); setTitle(''); }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        {t('add_task')}...
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/40 p-2.5 ring-1 ring-emerald-100 dark:ring-emerald-900"
    >
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('title_placeholder')}
        className="w-full bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
        disabled={loading}
      />
      <div className="mt-2 flex items-center gap-2">
        <div className="flex gap-1">
          {ASSIGNEES.map((a) => (
            <button
              key={a.value}
              type="button"
              onClick={() => setAssignee(a.value)}
              className={`rounded px-1.5 py-0.5 text-xs transition-colors ${
                assignee === a.value
                  ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-300 dark:ring-emerald-900'
                  : 'bg-muted text-muted-foreground hover:bg-muted'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-1.5">
          <button
            type="button"
            onClick={() => { setOpen(false); setTitle(''); }}
            className="rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
          >
            {tCommon('cancel')}
          </button>
          <button
            type="submit"
            disabled={loading || !title.trim()}
            className="rounded bg-emerald-600 px-2.5 py-0.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            {loading ? '...' : t('add_button')}
          </button>
        </div>
      </div>
    </form>
  );
}
