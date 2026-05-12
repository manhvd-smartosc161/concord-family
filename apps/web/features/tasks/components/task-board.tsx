'use client';

import { useCallback, useEffect, useState } from 'react';
import { createTask, deleteTask, listTasks, updateTask } from '../api';
import type { CreateTaskInput, Task, TaskAssignee, TaskStatus, UpdateTaskInput } from '../types';
import { TaskCard } from './task-card';
import { TaskQuickAdd } from './task-quick-add';

const STATUSES: { status: TaskStatus; label: string; dot: string }[] = [
  { status: 'todo',        label: 'Cần làm',  dot: 'bg-stone-300' },
  { status: 'in_progress', label: 'Đang làm', dot: 'bg-amber-400' },
  { status: 'done',        label: 'Xong',     dot: 'bg-emerald-500' },
];

const LANES: { assignee: TaskAssignee; label: string; icon: string }[] = [
  { assignee: 'both',    label: 'Cả hai', icon: '👫' },
  { assignee: 'husband', label: 'Chồng',  icon: '👨' },
  { assignee: 'wife',    label: 'Vợ',     icon: '👩' },
];

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

function formatWeekLabel(weekYear: string): string {
  const d = parseWeek(weekYear);
  const end = new Date(d);
  end.setDate(d.getDate() + 6);
  const fmt = (dt: Date) => dt.toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' });
  return `${fmt(d)} – ${fmt(end)}`;
}

export function TaskBoard() {
  const [currentWeek, setCurrentWeek] = useState(() => getISOWeek(new Date()));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileStatus, setMobileStatus] = useState<TaskStatus>('todo');
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

  async function handleAdd(input: CreateTaskInput) {
    const task = await createTask({ ...input, weekYear: currentWeek });
    setTasks((prev) => [...prev, task]);
  }

  async function handleUpdate(id: string, input: UpdateTaskInput) {
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
            <h1 className="text-base font-bold text-stone-900">Weekly Board</h1>
            <p className="text-xs text-stone-400">{formatWeekLabel(currentWeek)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentWeek((w) => addWeeks(w, -1))}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <span className="min-w-[60px] text-center text-xs font-semibold tabular-nums text-stone-600">
              {currentWeek}
            </span>
            <button
              type="button"
              onClick={() => setCurrentWeek((w) => addWeeks(w, 1))}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {!isCurrentWeek && (
              <button
                type="button"
                onClick={() => setCurrentWeek(getISOWeek(new Date()))}
                className="ml-1 rounded-lg border border-stone-200 px-2 py-1 text-xs text-stone-500 hover:bg-stone-100"
              >
                Hôm nay
              </button>
            )}
          </div>
        </div>

        {totalAll > 0 && (
          <div className="mt-2 flex items-center gap-2.5">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="shrink-0 text-[11px] font-medium tabular-nums text-stone-400">
              {totalDone}/{totalAll} xong
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
          <div className="grid h-48 animate-pulse gap-3 lg:grid-cols-3">
            {[1,2,3].map(i => <div key={i} className="rounded-2xl bg-stone-200/50" />)}
          </div>
        </div>
      ) : (
        <>
          {/* ── MOBILE: status tabs + list ── */}
          <div className="flex min-h-0 flex-1 flex-col lg:hidden">
            {/* Status tabs */}
            <div className="flex shrink-0 gap-0 border-b border-stone-200 bg-white">
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
                        active ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-500'
                      }`}>
                        {count}
                      </span>
                    )}
                    {active && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-stone-800" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Mobile task list — grouped by lane */}
            <div className="flex-1 overflow-y-auto p-3">
              {LANES.map((lane) => {
                const laneTasks = tasks.filter(
                  (t) => t.assignee === lane.assignee && t.status === mobileStatus,
                );
                return (
                  <div key={lane.assignee} className="mb-4">
                    <div className="mb-2 flex items-center gap-1.5">
                      <span className="text-base leading-none">{lane.icon}</span>
                      <span className="text-xs font-semibold text-stone-500">{lane.label}</span>
                      {laneTasks.length > 0 && (
                        <span className="rounded-full bg-stone-200 px-1.5 py-px text-[10px] font-semibold text-stone-500">
                          {laneTasks.length}
                        </span>
                      )}
                    </div>
                    {laneTasks.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-stone-200 py-3 text-center text-xs text-stone-300">
                        Trống
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {laneTasks.map((task) => (
                          <TaskCard key={task.id} task={task} onUpdate={handleUpdate} onDelete={handleDelete} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── DESKTOP: kanban matrix ── */}
          <div className="hidden min-h-0 flex-1 overflow-auto p-5 lg:block xl:p-6">
            <div className="grid h-full grid-cols-[96px_1fr_1fr_1fr] grid-rows-[auto_1fr_1fr_1fr] gap-2">

              {/* Corner */}
              <div />

              {/* Column headers */}
              {STATUSES.map((s) => {
                const count = tasks.filter((t) => t.status === s.status).length;
                return (
                  <div key={s.status} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-stone-100">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
                    <span className="text-xs font-semibold uppercase tracking-wide text-stone-600">{s.label}</span>
                    {count > 0 && (
                      <span className="ml-auto rounded-full bg-stone-100 px-1.5 py-px text-[10px] font-semibold text-stone-500">
                        {count}
                      </span>
                    )}
                  </div>
                );
              })}

              {/* Lane rows */}
              {LANES.map((lane, laneIdx) => (
                <>
                  {/* Lane header */}
                  <div
                    key={`label-${lane.assignee}`}
                    className={`flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-3 ${
                      laneIdx % 2 === 0 ? 'bg-stone-100/80' : 'bg-white ring-1 ring-stone-100'
                    }`}
                  >
                    <span className="text-2xl leading-none">{lane.icon}</span>
                    <span className="text-center text-[11px] font-semibold text-stone-500">{lane.label}</span>
                  </div>

                  {/* Status cells */}
                  {STATUSES.map((s) => {
                    const cells = tasks.filter(
                      (t) => t.assignee === lane.assignee && t.status === s.status,
                    );
                    return (
                      <div
                        key={`${lane.assignee}-${s.status}`}
                        className={`overflow-y-auto rounded-xl p-2 ${
                          laneIdx % 2 === 0 ? 'bg-stone-50' : 'bg-stone-50/50'
                        }`}
                      >
                        <div className="flex flex-col gap-2">
                          {cells.map((task) => (
                            <TaskCard key={task.id} task={task} onUpdate={handleUpdate} onDelete={handleDelete} />
                          ))}
                          {cells.length === 0 && (
                            <div className="flex h-8 items-center justify-center rounded-lg border border-dashed border-stone-200">
                              <span className="text-[10px] text-stone-300">—</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
