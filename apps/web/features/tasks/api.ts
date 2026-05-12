import { apiFetch } from '@/lib/api-client';
import type { CreateTaskInput, Task, UpdateTaskInput } from './types';

export function listTasks(week?: string): Promise<Task[]> {
  const query = week ? `?week=${week}` : '';
  return apiFetch<Task[]>(`/api/tasks${query}`);
}

export function createTask(input: CreateTaskInput): Promise<Task> {
  return apiFetch<Task>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateTask(id: string, input: UpdateTaskInput): Promise<Task> {
  return apiFetch<Task>(`/api/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteTask(id: string): Promise<void> {
  return apiFetch<void>(`/api/tasks/${id}`, { method: 'DELETE' });
}
