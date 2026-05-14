export type ParseAction =
  | {
      kind: 'logged';
      id: string;
      fundName: string;
      amount: number;
      categoryName: string | null;
      balance: number;
    }
  | {
      kind: 'updated';
      id: string;
      fundName: string;
      amount: number;
      categoryName: string | null;
    }
  | { kind: 'deleted'; id: string }
  | { kind: 'clarify'; question: string }
  | {
      kind: 'category_created';
      name: string;
      isEssential: boolean;
      parentName: string | null;
    }
  | { kind: 'tool_error'; toolName: string; message: string }
  | {
      kind: 'important_date_proposed';
      name: string;
      type: 'birthday' | 'death_anniversary' | 'anniversary' | 'other';
      date: string;
      isLunar: boolean;
      remindDaysBefore: number[];
      notes: string | null;
    }
  | {
      kind: 'important_date_logged';
      id: string;
      name: string;
      date: string;
      type: 'birthday' | 'death_anniversary' | 'anniversary' | 'other';
    }
  | { kind: 'important_date_dismissed' };

export interface ChatResponse {
  reply: string;
  actions: ParseAction[];
  stopReason: string | null;
  usage: { inputTokens: number; outputTokens: number };
  sessionId: string;
  userMessageId: string;
  agentMessageId: string;
}

export interface ChatSessionView {
  id: string;
  title: string;
  createdAt: string;
  lastMessageAt: string;
  messageCount: number;
  visibility: 'private' | 'public';
}

export interface ChatMessageView {
  id: string;
  role: 'user' | 'agent';
  text: string;
  actions: ParseAction[] | null;
  usage: { inputTokens: number; outputTokens: number } | null;
  author: { id: string; name: string };
  createdAt: string;
}
