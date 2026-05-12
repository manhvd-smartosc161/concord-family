'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { familyMembers } from '@/features/auth/api';
import type { AuthUser } from '@/features/auth/types';
import { createTask, deleteTask, listTasks, updateTask } from '../api';
import type { CreateTaskInput, Task, TaskAssignee, TaskStatus, UpdateTaskInput } from '../types';
import { TaskCard } from './task-card';
import { TaskQuickAdd } from './task-quick-add';

function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function parseWeek(weekYear: string): Date {
  const [year, wPart] = weekYear.split('-W');
  const week = parseInt(wPart, 10);
  const jan4 = new Date(parseInt(year, 10), 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() || 7) - 1));
  const result = new Date(startOfWeek1);
  result.setDate(startOfWeek1.getDate() + (week - 1) * 7);
  return result;
}

function addWeeks(weekYear: string, delta: number): string {
  const d = parseWeek(weekYear);
  d.setDate(d.getDate() + delta * 7);
  return getISOWeek(d);
}

function formatWeekLabel(weekYear: string, locale: string): string {
  const d = parseWeek(weekYear);
  const end = new Date(d);
  end.setDate(d.getDate() + 6);
  const fmt = (dt: Date) => dt.toLocaleDateString(locale === 'en' ? 'en-US' : 'vi-VN', { day: 'numeric', month: 'short' });
  return `${fmt(d)} – ${fmt(end)}`;
}

export function TaskBoard() {
  const t = useTranslations('tasks');
  const locale = useLocale();
  const STATUSES: { status: TaskStatus; label: string; dot: string; badgeBg: string; badgeText: string }[] = [
    { status: 'todo',        label: t('status_todo'),        dot: 'bg-stone-300',   badgeBg: 'bg-stone-100',   badgeText: 'text-stone-500'   },
    { status: 'in_progress', label: t('status_in_progress'), dot: 'bg-amber-400',   badgeBg: 'bg-amber-100',   badgeText: 'text-amber-700'   },
    { status: 'done',        label: t('status_done'),        dot: 'bg-emerald-500', badgeBg: 'bg-emerald-100', badgeText: 'text-emerald-700' },
  ];
  const [currentWeek, setCurrentWeek] = useState(() => getISOWeek(new Date()));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileStatus, setMobileStatus] = useState<TaskStatus>('todo');
  const [members, setMembers] = useState<AuthUser[]>([]);
  const isCurrentWeek = currentWeek === getISOWeek(new Date());

  const reload = useCallback(async (week: string) => {
    setLoading(true);
    try {
      const data = await listTasks(week);
      setTasks(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(currentWeek); }, [currentWeek, reload]);
  useEffect(() => { void familyMembers().then(setMembers); }, []);

  async function handleAdd(input: CreateTaskInput) {
    const task = await createTask({ ...input, weekYear: currentWeek });
    setTasks((prev) => [...prev, task]);
  }

  async function handleUpdate(id: string, input: UpdateTaskInput) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...input } : t)));
    const updated = await updateTask(id, input);
    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
  }

  async function handleDelete(id: string) {
    await deleteTask(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  const totalDone = tasks.filter((t) => t.status === 'done').length;
  const totalAll = tasks.length;
  const progress = totalAll > 0 ? Math.round((totalDone / totalAll) * 100) : 0;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-stone-50">

      {/* ── Header ── */}
      <div className="shrink-0 border-b border-stone-200 bg-white px-4 py-3 lg:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-stone-900">{t('this_week')}</h1>
            <p className="text-xs text-stone-400">{formatWeekLabel(currentWeek, locale)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentWeek((w) => addWeeks(w, -1))}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <span className="min-w-[60px] text-center text-xs font-medium tabular-nums text-stone-500">
              {currentWeek}
            </span>
            <button
              type="button"
              onClick={() => setCurrentWeek((w) => addWeeks(w, 1))}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {!isCurrentWeek && (
              <button
                type="button"
                onClick={() => setCurrentWeek(getISOWeek(new Date()))}
                className="ml-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs text-stone-500 transition-colors hover:bg-stone-50 hover:text-stone-700"
              >
                {t('today')}
              </button>
            )}
          </div>
        </div>

        {totalAll > 0 && (
          <div className="mt-2.5 flex items-center gap-2.5">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="shrink-0 text-[11px] tabular-nums text-stone-400">
              {totalDone}/{totalAll} {t('status_done')}
            </span>
          </div>
        )}
      </div>

      {/* ── Quick add ── */}
      <div className="shrink-0 border-b border-stone-200 bg-white px-4 py-2 lg:px-6">
        <TaskQuickAdd onAdd={handleAdd} />
      </div>

      {loading ? (
        <div className="flex-1 p-4 lg:p-6">
          <div className="flex gap-4">
            {[1,2,3].map(i => (
              <div key={i} className="flex-1">
                <div className="mb-3 h-5 w-20 animate-pulse rounded bg-stone-200" />
                {[1,2].map(j => <div key={j} className="mb-2 h-16 animate-pulse rounded-xl bg-stone-200/60" />)}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* ── MOBILE: tabs ── */}
          <div className="flex min-h-0 flex-1 flex-col lg:hidden">
            <div className="flex shrink-0 border-b border-stone-200 bg-white">
              {STATUSES.map((s) => {
                const count = tasks.filter((t) => t.status === s.status).length;
                const active = mobileStatus === s.status;
                return (
                  <button
                    key={s.status}
                    type="button"
                    onClick={() => setMobileStatus(s.status)}
                    className={`relative flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
                      active ? 'text-stone-800' : 'text-stone-400 hover:text-stone-600'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                    {s.label}
                    {count > 0 && (
                      <span className={`rounded-full px-1.5 py-px text-[10px] font-semibold ${
                        active ? 'bg-stone-800 text-white' : `${s.badgeBg} ${s.badgeText}`
                      }`}>
                        {count}
                      </span>
                    )}
                    {active && (
                      <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-emerald-500" />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <div className="flex flex-col gap-2">
                {tasks
                  .filter((t) => t.status === mobileStatus)
                  .map((task) => (
                    <TaskCard key={task.id} task={task} members={members} onUpdate={handleUpdate} onDelete={handleDelete} />
                  ))}
                {tasks.filter((t) => t.status === mobileStatus).length === 0 && (
                  <div className="rounded-xl border border-dashed border-stone-200 py-8 text-center text-sm text-stone-300">
                    {t('no_tasks_col')}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── DESKTOP: 3 columns by status ── */}
          <div className="hidden min-h-0 flex-1 lg:flex">
            {STATUSES.map((s, idx) => {
              const col = tasks.filter((t) => t.status === s.status);
              return (
                <div
                  key={s.status}
                  className={`flex min-h-0 flex-1 flex-col ${idx < STATUSES.length - 1 ? 'border-r border-stone-200' : ''}`}
                >
                  {/* Column header */}
                  <div className="flex shrink-0 items-center gap-2 px-4 py-3">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
                    <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">{s.label}</span>
                    {col.length > 0 && (
                      <span className={`ml-auto rounded-full px-1.5 py-px text-[10px] font-semibold ${s.badgeBg} ${s.badgeText}`}>
                        {col.length}
                      </span>
                    )}
                  </div>

                  <div className="h-px shrink-0 bg-stone-100" />

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto p-3">
                    <div className="flex flex-col gap-2">
                      {col.map((task) => (
                        <TaskCard key={task.id} task={task} members={members} onUpdate={handleUpdate} onDelete={handleDelete} />
                      ))}
                      {col.length === 0 && (
                        <div className="mt-4 rounded-xl border border-dashed border-stone-200 py-8 text-center text-sm text-stone-300">
                          {t('no_tasks_col')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
