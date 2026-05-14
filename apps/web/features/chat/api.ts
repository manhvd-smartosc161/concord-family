import { apiFetch } from '@/lib/api-client';
import type {
  ChatMessageView,
  ChatResponse,
  ChatSessionView,
} from './types';

export function sendChat(
  message: string,
  sessionId: string,
): Promise<ChatResponse> {
  return apiFetch<ChatResponse>('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message, sessionId }),
  });
}

export function listChatSessions(): Promise<ChatSessionView[]> {
  return apiFetch<ChatSessionView[]>('/api/chat/sessions');
}

export function createChatSession(
  visibility: 'private' | 'public',
  title?: string,
): Promise<ChatSessionView> {
  return apiFetch<ChatSessionView>('/api/chat/sessions', {
    method: 'POST',
    body: JSON.stringify(title ? { visibility, title } : { visibility }),
  });
}

export function listChatMessages(sessionId: string): Promise<ChatMessageView[]> {
  return apiFetch<ChatMessageView[]>(`/api/chat/sessions/${sessionId}/messages`);
}

export async function deleteChatSession(sessionId: string): Promise<void> {
  await apiFetch<void>(`/api/chat/sessions/${sessionId}`, { method: 'DELETE' });
}
