'use client';

import { useRef, useState } from 'react';
import type { CreateTaskInput, TaskAssignee, TaskCategory } from '../types';

interface Props {
  onAdd: (input: CreateTaskInput) => Promise<void>;
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

export function TaskQuickAdd({ onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TaskCategory>('shopping');
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
    await onAdd({ title: title.trim(), category, assignee });
    setTitle('');
    setLoading(false);
    inputRef.current?.focus();
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
        Thêm task mới...
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-2.5 ring-1 ring-emerald-100"
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
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <div className="flex gap-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              title={c.label}
              className={`rounded px-1.5 py-0.5 text-xs transition-colors ${
                category === c.value ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
              }`}
            >
              {c.icon}
            </button>
          ))}
        </div>
        <div className="h-3.5 w-px bg-stone-200" />
        <div className="flex gap-1">
          {ASSIGNEES.map((a) => (
            <button
              key={a.value}
              type="button"
              onClick={() => setAssignee(a.value)}
              className={`rounded px-1.5 py-0.5 text-xs transition-colors ${
                assignee === a.value ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
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
            Hủy
          </button>
          <button
            type="submit"
            disabled={loading || !title.trim()}
            className="rounded bg-emerald-600 px-2.5 py-0.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            {loading ? '...' : 'Thêm'}
          </button>
        </div>
      </div>
    </form>
  );
}
