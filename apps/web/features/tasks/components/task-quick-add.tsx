'use client';

import { useRef, useState } from 'react';
import type { CreateTaskInput, TaskAssignee, TaskCategory } from '../types';

interface Props {
  onAdd: (input: CreateTaskInput) => Promise<void>;
  defaultAssignee?: TaskAssignee;
}

const CATEGORIES: { value: TaskCategory; label: string; icon: string }[] = [
  { value: 'shopping', label: 'Mua sắm', icon: '🛒' },
  { value: 'chores',   label: 'Việc nhà', icon: '🏠' },
  { value: 'finance',  label: 'Tài chính', icon: '💰' },
  { value: 'goal',     label: 'Mục tiêu', icon: '🎯' },
];

const ASSIGNEES: { value: TaskAssignee; label: string }[] = [
  { value: 'both',    label: '👫 Cả hai' },
  { value: 'husband', label: '👨 Chồng' },
  { value: 'wife',    label: '👩 Vợ' },
];

export function TaskQuickAdd({ onAdd, defaultAssignee = 'both' }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TaskCategory>('shopping');
  const [assignee, setAssignee] = useState<TaskAssignee>(defaultAssignee);
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
    await onAdd({ title: title.trim(), category, assignee });
    setTitle('');
    setLoading(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false);
      setTitle('');
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="flex w-full items-center gap-2 rounded-xl border border-dashed border-stone-300 bg-stone-50/50 px-4 py-3 text-sm text-stone-400 transition-colors hover:border-emerald-300 hover:bg-emerald-50/30 hover:text-emerald-600"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        Thêm task mới...
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      className="rounded-xl border border-emerald-200 bg-white p-3 shadow-sm ring-2 ring-emerald-100"
    >
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Tên task..."
        className="w-full bg-transparent text-sm font-medium text-stone-800 placeholder-stone-400 focus:outline-none"
        disabled={loading}
      />
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
                category === c.value
                  ? 'bg-stone-800 text-white'
                  : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
              }`}
              title={c.label}
            >
              {c.icon}
            </button>
          ))}
        </div>
        <div className="h-4 w-px bg-stone-200" />
        <div className="flex gap-1">
          {ASSIGNEES.map((a) => (
            <button
              key={a.value}
              type="button"
              onClick={() => setAssignee(a.value)}
              className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
                assignee === a.value
                  ? 'bg-stone-800 text-white'
                  : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => { setOpen(false); setTitle(''); }}
            className="rounded-lg px-2.5 py-1 text-xs text-stone-400 hover:bg-stone-100"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={loading || !title.trim()}
            className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            {loading ? '...' : 'Thêm'}
          </button>
        </div>
      </div>
    </form>
  );
}
