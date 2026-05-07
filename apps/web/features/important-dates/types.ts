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

export type AiDateKind =
  | 'lunar'
  | 'national'
  | 'international'
  | 'religious'
  | 'other';

export type AgendaItemKind = ImportantDateType | AiDateKind;
export type AgendaItemSource = 'user' | 'ai';

export interface AgendaItem {
  occursOn: string;
  daysUntil: number;
  source: AgendaItemSource;
  kind: AgendaItemKind;
  name: string;
  isLunar: boolean;
  notes: string | null;
  sourceId: string | null;
  remindDaysBefore: number[];
}

export interface UpcomingView {
  items: AgendaItem[];
  aiGeneratedAt: string | null;
}

export interface YearAgendaView {
  year: number;
  items: AgendaItem[];
  aiGeneratedAt: string | null;
}
