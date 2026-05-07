export interface GoalView {
  id: string;
  type: 'save' | 'spend_under';
  period: 'month' | 'year';
  scope: 'couple' | 'personal';
  targetAmount: number;
  startDate: string;
  deadline: string;
  currentProgress: number;
  projection: number;
  paceStatus: 'ahead' | 'on_track' | 'behind';
  daysElapsed: number;
  daysTotal: number;
  daysRemaining: number;
}
