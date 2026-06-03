import { apiFetch } from '@/lib/api-client';
import type {
  ChatMessageView,
  ChatResponse,
  ChatSessionView,
} from './types';

export type ChatImagePayload = {
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  data: string;
};

export function sendChat(
  message: string,
  sessionId: string,
  images?: ChatImagePayload[],
): Promise<ChatResponse> {
  const body: Record<string, unknown> = { message, sessionId };
  if (images && images.length > 0) body.images = images;
  return apiFetch<ChatResponse>('/api/chat', {
    method: 'POST',
    body: JSON.stringify(body),
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
