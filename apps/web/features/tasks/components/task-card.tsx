'use client';

import { useState } from 'react';
import { UserAvatar } from '@/features/auth/components/user-avatar';
import type { AuthUser } from '@/features/auth/types';
import type { Task, TaskStatus, UpdateTaskInput } from '../types';

const CATEGORY_CONFIG = {
  shopping: { label: 'Mua sắm', accent: 'bg-sky-500',     pill: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200' },
  chores:   { label: 'Việc nhà', accent: 'bg-amber-400',   pill: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' },
  finance:  { label: 'Tài chính', accent: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
  goal:     { label: 'Mục tiêu', accent: 'bg-violet-500',  pill: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200' },
} as const;

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
  const [expanded, setExpanded] = useState(false);
  const [editNote, setEditNote] = useState(task.note ?? '');
  const [saving, setSaving] = useState(false);

  const cat = CATEGORY_CONFIG[task.category];
  const nextStatus = NEXT_STATUS[task.status];
  const isDone = task.status === 'done';

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
    <div className={`group relative flex gap-0 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-stone-100 transition-all hover:shadow-md hover:ring-stone-200 ${isDone ? 'opacity-60' : ''}`}>
      <div className={`w-[3px] shrink-0 self-stretch ${cat.accent}`} />

      <div className="min-w-0 flex-1 p-3">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            className="flex-1 text-left"
            onClick={() => setExpanded((v) => !v)}
          >
            <p className="text-sm font-medium leading-snug text-stone-800"
              style={isDone ? { textDecoration: 'line-through', textDecorationThickness: '1.5px' } : undefined}>
              {task.title}
            </p>
            {task.note && !expanded && (
              <p className="mt-0.5 truncate text-xs text-stone-400">{task.note}</p>
            )}
          </button>
          <button
            type="button"
            onClick={() => onDelete(task.id)}
            className="shrink-0 rounded p-0.5 text-stone-300 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-50 hover:text-red-400"
            aria-label="Xóa"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M9 3L3 9M3 3l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="mt-2 flex items-center gap-1.5">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${cat.pill}`}>
            {cat.label}
          </span>
          {task.assignee === 'both' ? (
            <div className="flex -space-x-1.5">
              {members.map((m) => (
                <div key={m.id} className="rounded-full ring-2 ring-white">
                  <UserAvatar user={m} size={28} />
                </div>
              ))}
            </div>
          ) : (
            (() => {
              const m = members.find((u) => u.role === task.assignee);
              return m ? <UserAvatar user={m} size={28} /> : null;
            })()
          )}

          {nextStatus && (
            <button
              type="button"
              disabled={saving}
              onClick={handleStatusAdvance}
              className="ml-auto flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-0.5 text-[10px] font-medium text-stone-600 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-40"
            >
              {task.status === 'todo' ? (
                <>
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"><polygon points="2,1 7,4 2,7"/></svg>
                  Bắt đầu
                </>
              ) : (
                <>
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 4l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Xong
                </>
              )}
            </button>
          )}

          {isDone && (
            <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-600">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Hoàn thành
            </span>
          )}
        </div>

        {expanded && (
          <div className="mt-2.5 border-t border-stone-100 pt-2.5">
            <textarea
              className="w-full resize-none rounded-lg border border-stone-200 bg-stone-50 p-2 text-xs text-stone-700 placeholder-stone-400 focus:border-emerald-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
              rows={2}
              placeholder="Ghi chú..."
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
            />
            <div className="mt-1.5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setExpanded(false); setEditNote(task.note ?? ''); }}
                className="rounded-lg px-2.5 py-1 text-xs text-stone-400 hover:bg-stone-100 hover:text-stone-600"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleNoteSave}
                className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
              >
                Lưu
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
