'use client';

import { useCallback, useEffect, useState } from 'react';
import { createTask, deleteTask, listTasks, updateTask } from '../api';
import type { CreateTaskInput, Task, TaskAssignee, TaskStatus, UpdateTaskInput } from '../types';
import { TaskCard } from './task-card';
import { TaskQuickAdd } from './task-quick-add';

const STATUSES: { status: TaskStatus; label: string }[] = [
  { status: 'todo',        label: 'Cần làm' },
  { status: 'in_progress', label: 'Đang làm' },
  { status: 'done',        label: 'Xong' },
];

const LANES: { assignee: TaskAssignee; label: string; icon: string }[] = [
  { assignee: 'both',    label: 'Cả hai',  icon: '👫' },
  { assignee: 'husband', label: 'Chồng',   icon: '👨' },
  { assignee: 'wife',    label: 'Vợ',      icon: '👩' },
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

function LaneSection({
  lane,
  tasks,
  onUpdate,
  onDelete,
  onAdd,
}: {
  lane: typeof LANES[number];
  tasks: Task[];
  onUpdate: (id: string, input: UpdateTaskInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAdd: (input: CreateTaskInput) => Promise<void>;
}) {
  const [activeStatus, setActiveStatus] = useState<TaskStatus>('todo');

  const counts = STATUSES.reduce(
    (acc, s) => ({ ...acc, [s.status]: tasks.filter((t) => t.status === s.status).length }),
    {} as Record<TaskStatus, number>,
  );

  const visible = tasks.filter((t) => t.status === activeStatus);

  return (
    <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/60 px-4 py-3">
        <span className="text-xl leading-none">{lane.icon}</span>
        <span className="text-sm font-semibold text-stone-700">{lane.label}</span>
        <span className="ml-auto text-xs text-stone-400">{tasks.length} task</span>
      </div>

      <div className="flex gap-1 border-b border-stone-100 px-3 pt-2.5 pb-0">
        {STATUSES.map((s) => (
          <button
            key={s.status}
            type="button"
            onClick={() => setActiveStatus(s.status)}
            className={`relative flex items-center gap-1.5 rounded-t-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              activeStatus === s.status
                ? 'bg-white text-stone-800 shadow-[0_-1px_0_0_inset] shadow-stone-200 after:absolute after:bottom-[-1px] after:left-0 after:right-0 after:h-px after:bg-white'
                : 'text-stone-400 hover:text-stone-600'
            }`}
          >
            {s.label}
            {counts[s.status] > 0 && (
              <span className={`rounded-full px-1.5 py-px text-[10px] font-semibold leading-none ${
                activeStatus === s.status
                  ? s.status === 'done' ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-600'
                  : 'bg-stone-100 text-stone-400'
              }`}>
                {counts[s.status]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="min-h-[80px] p-3">
        {visible.length === 0 ? (
          <div className="flex h-16 items-center justify-center text-xs text-stone-300">
            {activeStatus === 'done' ? 'Chưa có gì hoàn thành' : 'Trống'}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {visible.map((task) => (
              <TaskCard key={task.id} task={task} onUpdate={onUpdate} onDelete={onDelete} />
            ))}
          </div>
        )}
      </div>

      {activeStatus === 'todo' && (
        <div className="border-t border-stone-100 p-3">
          <TaskQuickAdd onAdd={onAdd} defaultAssignee={lane.assignee} />
        </div>
      )}
    </section>
  );
}

export function TaskBoard() {
  const [currentWeek, setCurrentWeek] = useState(() => getISOWeek(new Date()));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    void reload(currentWeek);
  }, [currentWeek, reload]);

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
    <div className="flex h-full flex-col overflow-auto bg-stone-50">
      <div className="sticky top-0 z-10 border-b border-stone-200 bg-white/90 px-4 py-3 backdrop-blur-sm lg:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-stone-900">Tuần này</h1>
            <p className="text-xs text-stone-400">{formatWeekLabel(currentWeek)}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentWeek((w) => addWeeks(w, -1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <span className="min-w-[64px] text-center text-xs font-semibold tabular-nums text-stone-600">
              {currentWeek}
            </span>
            <button
              type="button"
              onClick={() => setCurrentWeek((w) => addWeeks(w, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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
          <div className="mt-2.5 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="shrink-0 text-xs font-medium tabular-nums text-stone-500">
              {totalDone}/{totalAll}
            </span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex flex-1 flex-col gap-3 p-4 lg:p-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-stone-200/60" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3 p-4 lg:p-6">
          {LANES.map((lane) => (
            <LaneSection
              key={lane.assignee}
              lane={lane}
              tasks={tasks.filter((t) => t.assignee === lane.assignee)}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onAdd={handleAdd}
            />
          ))}
        </div>
      )}
    </div>
  );
}
