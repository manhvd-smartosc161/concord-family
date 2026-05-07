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

export type MonthItemKind =
  | ImportantDateType
  | 'lunar_mung1'
  | 'lunar_ram';

export interface MonthItem {
  occursOn: string;
  daysUntil: number;
  kind: MonthItemKind;
  name: string;
  isLunar: boolean;
  notes: string | null;
  sourceId: string | null;
  remindDaysBefore: number[];
  lunarMonth: number | null;
}

export interface MonthListView {
  year: number;
  month: number;
  items: MonthItem[];
}
