'use client';

import { useEffect, useState } from 'react';
import { ApiError } from '@/lib/api-client';
import { changePassword } from '@/features/auth/api';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ChangePasswordModal({ open, onClose }: Props) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setCurrent('');
      setNext('');
      setConfirm('');
      setError(null);
      setSuccess(false);
      setSubmitting(false);
    }
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (next !== confirm) {
      setError('Mật khẩu mới và xác nhận không khớp');
      return;
    }
    if (next.length < 6) {
      setError('Mật khẩu mới tối thiểu 6 ký tự');
      return;
    }
    if (current === next) {
      setError('Mật khẩu mới phải khác mật khẩu hiện tại');
      return;
    }

    setSubmitting(true);
    try {
      await changePassword(current, next);
      setSuccess(true);
      setTimeout(onClose, 1500);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Đổi mật khẩu thất bại';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Đóng"
        onClick={onClose}
        className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
      />

      {/* Panel */}
      <div className="relative w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl shadow-stone-900/20 sm:p-6">
        <div className="mb-1 flex items-start justify-between">
          <h3 className="text-base font-semibold text-stone-900">
            Đổi mật khẩu
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <p className="mb-5 text-xs text-stone-500">
          Sau khi đổi, mật khẩu cũ ngưng hoạt động ngay.
        </p>

        {success ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            ✅ Đã đổi mật khẩu thành công.
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <PasswordField
              label="Mật khẩu hiện tại"
              value={current}
              onChange={setCurrent}
              autoFocus
              disabled={submitting}
            />
            <PasswordField
              label="Mật khẩu mới"
              value={next}
              onChange={setNext}
              hint="Tối thiểu 6 ký tự"
              disabled={submitting}
            />
            <PasswordField
              label="Xác nhận mật khẩu mới"
              value={confirm}
              onChange={setConfirm}
              disabled={submitting}
            />

            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                {error}
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end sm:gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="w-full rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm text-stone-700 transition-colors hover:bg-stone-50 sm:w-auto"
              >
                Huỷ
              </button>
              <button
                type="submit"
                disabled={submitting || !current || !next || !confirm}
                className="w-full rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-emerald-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-stone-300 sm:w-auto"
              >
                {submitting ? 'Đang đổi…' : 'Đổi mật khẩu'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  hint,
  autoFocus,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-stone-700">
        {label}
      </label>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        autoFocus={autoFocus}
        disabled={disabled}
        className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm transition-colors focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
      />
      {hint && <p className="mt-1 text-[11px] text-stone-400">{hint}</p>}
    </div>
  );
}
