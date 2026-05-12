'use client';

import { useState } from 'react';
import type { CreateTaskInput, TaskAssignee, TaskCategory } from '../types';

interface Props {
  onAdd: (input: CreateTaskInput) => Promise<void>;
}

const CATEGORIES: { value: TaskCategory; label: string }[] = [
  { value: 'shopping', label: '🛒 Mua sắm' },
  { value: 'chores', label: '🏠 Việc nhà' },
  { value: 'finance', label: '💰 Tài chính' },
  { value: 'goal', label: '🎯 Mục tiêu' },
];

const ASSIGNEES: { value: TaskAssignee; label: string }[] = [
  { value: 'both', label: '👫 Cả hai' },
  { value: 'husband', label: '👨 Chồng' },
  { value: 'wife', label: '👩 Vợ' },
];

export function TaskQuickAdd({ onAdd }: Props) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TaskCategory>('shopping');
  const [assignee, setAssignee] = useState<TaskAssignee>('both');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    await onAdd({ title: title.trim(), category, assignee });
    setTitle('');
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-stone-300 bg-stone-50 p-3">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Thêm task..."
        className="min-w-0 flex-1 rounded border border-stone-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400"
        disabled={loading}
      />
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value as TaskCategory)}
        className="rounded border border-stone-200 bg-white px-2 py-1.5 text-sm focus:outline-none"
        disabled={loading}
      >
        {CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>{c.label}</option>
        ))}
      </select>
      <select
        value={assignee}
        onChange={(e) => setAssignee(e.target.value as TaskAssignee)}
        className="rounded border border-stone-200 bg-white px-2 py-1.5 text-sm focus:outline-none"
        disabled={loading}
      >
        {ASSIGNEES.map((a) => (
          <option key={a.value} value={a.value}>{a.label}</option>
        ))}
      </select>
      <button
        type="submit"
        disabled={loading || !title.trim()}
        className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
      >
        + Thêm
      </button>
    </form>
  );
}
