import { apiFetch } from '@/lib/api-client';
import type { CategoryView } from './types';

export function listCategories(): Promise<CategoryView[]> {
  return apiFetch<CategoryView[]>('/api/categories');
}
