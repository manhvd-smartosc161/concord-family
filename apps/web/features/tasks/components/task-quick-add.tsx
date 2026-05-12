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
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
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
      className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-2.5 ring-1 ring-emerald-100"
    >
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('title_placeholder')}
        className="w-full bg-transparent text-sm font-medium text-stone-800 placeholder-stone-400 focus:outline-none"
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
                  ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300'
                  : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
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
            className="rounded px-2 py-0.5 text-xs text-stone-400 hover:bg-stone-100"
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
