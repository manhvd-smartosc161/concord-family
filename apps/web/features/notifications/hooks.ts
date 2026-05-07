'use client';

import { useCallback, useEffect, useState } from 'react';
import { registerDeviceToken } from './api';
import { onForegroundMessage, requestFcmToken } from './firebase';
import type { DevicePlatform } from './types';

type Permission = 'default' | 'granted' | 'denied' | 'unsupported';

function detectPlatform(): DevicePlatform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent.toLowerCase();
  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      // @ts-expect-error iOS Safari only
      window.navigator.standalone === true);
  if (/iphone|ipad|ipod/.test(ua) && isStandalone) return 'ios_pwa';
  if (/android/.test(ua)) return 'android';
  return 'desktop';
}

export function useFcmRegistration() {
  const [permission, setPermission] = useState<Permission>('default');
  const [registered, setRegistered] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof Notification === 'undefined') {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (permission !== 'granted' || registered) return;
    let cancelled = false;
    void (async () => {
      const token = await requestFcmToken();
      if (cancelled || !token) return;
      try {
        await registerDeviceToken({ token, platform: detectPlatform() });
        setRegistered(true);
      } catch (err) {
        console.error('register device token failed', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [permission, registered]);

  useEffect(() => {
    if (permission !== 'granted') return;
    const unsub = onForegroundMessage((msg) => {
      if (typeof window !== 'undefined' && Notification.permission === 'granted') {
        new Notification(msg.title ?? 'Concord', { body: msg.body });
      }
    });
    return unsub;
  }, [permission]);

  const enable = useCallback(async () => {
    if (typeof Notification === 'undefined') return;
    setBusy(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
    } finally {
      setBusy(false);
    }
  }, []);

  return { permission, registered, busy, enable };
}
