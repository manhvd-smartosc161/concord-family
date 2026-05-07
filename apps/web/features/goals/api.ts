import { apiFetch } from '@/lib/api-client';
import type { GoalView } from './types';

export function listGoals(): Promise<GoalView[]> {
  return apiFetch<GoalView[]>('/api/goals');
}

export function updateYearlySavingsGoal(
  targetAmount: number,
): Promise<GoalView> {
  return apiFetch<GoalView>('/api/goals/yearly-savings', {
    method: 'PUT',
    body: JSON.stringify({ targetAmount }),
  });
}
