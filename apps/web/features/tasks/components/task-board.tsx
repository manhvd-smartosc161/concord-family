'use client';

import { useCallback, useEffect, useState } from 'react';
import { createTask, deleteTask, listTasks, updateTask } from '../api';
import type { CreateTaskInput, Task, TaskAssignee, TaskStatus, UpdateTaskInput } from '../types';
import { TaskCard } from './task-card';
import { TaskQuickAdd } from './task-quick-add';

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'todo', label: 'Todo' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'done', label: 'Done' },
];

const SWIM_LANES: { assignee: TaskAssignee; label: string }[] = [
  { assignee: 'both', label: '👫 Cả hai' },
  { assignee: 'husband', label: '👨 Chồng' },
  { assignee: 'wife', label: '👩 Vợ' },
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

export function TaskBoard() {
  const [currentWeek, setCurrentWeek] = useState(() => getISOWeek(new Date()));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

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
    const task = await createTask(input);
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

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-stone-800">Weekly Board</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentWeek((w) => addWeeks(w, -1))}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
          >
            ←
          </button>
          <span className="min-w-[90px] text-center text-sm font-medium text-stone-700">
            {currentWeek}
          </span>
          <button
            type="button"
            onClick={() => setCurrentWeek((w) => addWeeks(w, 1))}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
          >
            →
          </button>
        </div>
      </div>

      <TaskQuickAdd onAdd={handleAdd} />

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-stone-400">
          Đang tải...
        </div>
      ) : (
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse">
            <thead>
              <tr>
                <th className="w-28 border border-stone-200 bg-stone-50 p-2 text-left text-xs font-semibold text-stone-500" />
                {COLUMNS.map((col) => (
                  <th
                    key={col.status}
                    className="border border-stone-200 bg-stone-50 p-2 text-center text-xs font-semibold uppercase tracking-wide text-stone-500"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SWIM_LANES.map((lane) => (
                <tr key={lane.assignee}>
                  <td className="border border-stone-200 bg-stone-50 p-3 text-sm font-medium text-stone-600 align-top">
                    {lane.label}
                  </td>
                  {COLUMNS.map((col) => {
                    const cells = tasks.filter(
                      (t) => t.assignee === lane.assignee && t.status === col.status,
                    );
                    return (
                      <td
                        key={col.status}
                        className="min-h-[80px] border border-stone-200 p-2 align-top"
                      >
                        <div className="flex flex-col gap-2">
                          {cells.map((task) => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              onUpdate={handleUpdate}
                              onDelete={handleDelete}
                            />
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
