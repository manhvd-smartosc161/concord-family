export type ImportantDateType =
  | 'birthday'
  | 'death_anniversary'
  | 'anniversary'
  | 'other';

export interface ImportantDateView {
  id: string;
  name: string;
  type: ImportantDateType;
  date: string;
  isLunar: boolean;
  remindDaysBefore: number[];
  notes: string | null;
  createdById: string;
  nextOccurrence: string;
  daysUntilNext: number;
}

export interface CreateImportantDatePayload {
  name: string;
  type: ImportantDateType;
  date: string;
  isLunar: boolean;
  remindDaysBefore: number[];
  notes?: string;
}

export type UpdateImportantDatePayload = Partial<CreateImportantDatePayload>;
