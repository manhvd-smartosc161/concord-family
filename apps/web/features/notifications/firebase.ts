'use client';

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getMessaging,
  getToken,
  onMessage,
  type Messaging,
} from 'firebase/messaging';

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
};

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

export function initFirebase(): FirebaseApp | null {
  if (typeof window === 'undefined') return null;
  if (!config.apiKey || !config.projectId) return null;
  if (app) return app;
  app = getApps()[0] ?? initializeApp(config);
  return app;
}

export function getMessagingClient(): Messaging | null {
  const a = initFirebase();
  if (!a) return null;
  if (messaging) return messaging;
  try {
    messaging = getMessaging(a);
    return messaging;
  } catch {
    return null;
  }
}

export async function requestFcmToken(): Promise<string | null> {
  const m = getMessagingClient();
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!m || !vapidKey) return null;
  try {
    const registration = await navigator.serviceWorker.register(
      '/firebase-messaging-sw.js',
    );
    const token = await getToken(m, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });
    return token || null;
  } catch (err) {
    console.error('FCM token request failed', err);
    return null;
  }
}

export function onForegroundMessage(
  cb: (payload: { title?: string; body?: string }) => void,
): () => void {
  const m = getMessagingClient();
  if (!m) return () => {};
  const unsub = onMessage(m, (msg) => {
    cb({
      title: msg.notification?.title,
      body: msg.notification?.body,
    });
  });
  return unsub;
}
