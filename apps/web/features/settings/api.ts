import { apiFetch } from '@/lib/api-client';
import type { SalaryRule } from './types';

export function getSalaryRule(): Promise<SalaryRule> {
  return apiFetch<SalaryRule>('/api/salary-rules');
}

export function updateSalaryRule(
  pctToPersonal: number,
  pctToJoint: number,
  fixedAmountToJoint: number | null = null,
): Promise<SalaryRule> {
  return apiFetch<SalaryRule>('/api/salary-rules', {
    method: 'PUT',
    body: JSON.stringify({ pctToPersonal, pctToJoint, fixedAmountToJoint }),
  });
}
