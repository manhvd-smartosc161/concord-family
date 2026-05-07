'use client';

import { Card } from '@/components/ui';
import { useFcmRegistration } from '../hooks';

function detectIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua);
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // @ts-expect-error iOS Safari only
    window.navigator.standalone === true
  );
}

export function EnablePushBanner() {
  const { permission, busy, enable } = useFcmRegistration();
  if (permission === 'unsupported' || permission === 'granted') return null;

  const ios = detectIos();
  const standalone = isStandalone();
  const needHomeScreen = ios && !standalone;

  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="text-2xl">🔔</span>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-stone-900">
            Bật thông báo đẩy
          </h3>
          {needHomeScreen ? (
            <p className="mt-1 text-xs text-stone-600">
              Để nhận thông báo trên iPhone, bấm <strong>Share</strong> →{' '}
              <strong>Add to Home Screen</strong>, sau đó mở Concord từ icon
              trên màn hình chính.
            </p>
          ) : permission === 'denied' ? (
            <p className="mt-1 text-xs text-stone-600">
              Bạn đã chặn thông báo. Vào cài đặt trình duyệt để bật lại.
            </p>
          ) : (
            <>
              <p className="mt-1 text-xs text-stone-600">
                Concord sẽ nhắc bạn các ngày quan trọng (sinh nhật, giỗ, kỷ niệm)
                qua điện thoại.
              </p>
              <button
                type="button"
                onClick={enable}
                disabled={busy}
                className="mt-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy ? 'Đang xin quyền...' : 'Bật thông báo'}
              </button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
