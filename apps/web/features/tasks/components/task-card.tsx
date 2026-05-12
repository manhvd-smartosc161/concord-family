'use client';

import { useState } from 'react';
import type { Task, TaskStatus, UpdateTaskInput } from '../types';

const CATEGORY_CONFIG = {
  shopping: { label: 'Mua sắm', color: 'bg-blue-100 text-blue-700' },
  chores: { label: 'Việc nhà', color: 'bg-orange-100 text-orange-700' },
  finance: { label: 'Tài chính', color: 'bg-green-100 text-green-700' },
  goal: { label: 'Mục tiêu', color: 'bg-purple-100 text-purple-700' },
} as const;

const NEXT_STATUS: Record<TaskStatus, TaskStatus | null> = {
  todo: 'in_progress',
  in_progress: 'done',
  done: null,
};

const NEXT_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: '▶ Bắt đầu',
  in_progress: '✓ Xong',
  done: '',
};

interface Props {
  task: Task;
  onUpdate: (id: string, input: UpdateTaskInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function TaskCard({ task, onUpdate, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editNote, setEditNote] = useState(task.note ?? '');
  const [saving, setSaving] = useState(false);

  const cat = CATEGORY_CONFIG[task.category];
  const nextStatus = NEXT_STATUS[task.status];

  async function handleStatusAdvance() {
    if (!nextStatus) return;
    setSaving(true);
    await onUpdate(task.id, { status: nextStatus });
    setSaving(false);
  }

  async function handleNoteSave() {
    setSaving(true);
    await onUpdate(task.id, { note: editNote || null });
    setSaving(false);
    setExpanded(false);
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          className="flex-1 text-left"
          onClick={() => setExpanded((v) => !v)}
        >
          <p className={`text-sm font-medium text-stone-800 ${task.status === 'done' ? 'line-through opacity-50' : ''}`}>
            {task.title}
          </p>
        </button>
        <button
          type="button"
          onClick={() => onDelete(task.id)}
          className="shrink-0 text-xs text-stone-300 hover:text-red-400"
          aria-label="Xóa"
        >
          ✕
        </button>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cat.color}`}>
          {cat.label}
        </span>
        {nextStatus && (
          <button
            type="button"
            disabled={saving}
            onClick={handleStatusAdvance}
            className="ml-auto rounded px-2 py-0.5 text-[10px] font-medium text-stone-500 hover:bg-stone-100 disabled:opacity-50"
          >
            {NEXT_STATUS_LABEL[task.status]}
          </button>
        )}
      </div>

      {expanded && (
        <div className="mt-2 border-t border-stone-100 pt-2">
          <textarea
            className="w-full rounded border border-stone-200 p-2 text-xs text-stone-700 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            rows={2}
            placeholder="Ghi chú..."
            value={editNote}
            onChange={(e) => setEditNote(e.target.value)}
          />
          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setExpanded(false); setEditNote(task.note ?? ''); }}
              className="text-xs text-stone-400 hover:text-stone-600"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleNoteSave}
              className="rounded bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Lưu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
