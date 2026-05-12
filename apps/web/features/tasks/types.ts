export type TaskCategory = 'shopping' | 'chores' | 'finance' | 'goal';
export type TaskAssignee = 'husband' | 'wife' | 'both';
export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Task {
  id: string;
  familyId: string;
  createdBy: string;
  title: string;
  category: TaskCategory;
  assignee: TaskAssignee;
  status: TaskStatus;
  weekYear: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  category: TaskCategory;
  assignee: TaskAssignee;
  note?: string;
}

export interface UpdateTaskInput {
  title?: string;
  category?: TaskCategory;
  assignee?: TaskAssignee;
  status?: TaskStatus;
  note?: string | null;
}
