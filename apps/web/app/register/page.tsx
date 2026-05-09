'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { ApiError, setToken } from '@/lib/api-client';
import { register } from '@/features/auth/api';
import { useAuth } from '@/features/auth/hooks';
import type { UserGender } from '@/features/auth/types';

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterInner />
    </Suspense>
  );
}

function RegisterInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next');
  const auth = useAuth(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState<UserGender>('male');
  const [birthdate, setBirthdate] = useState('');
  const [weddingDate, setWeddingDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (auth.status === 'authed') {
      router.replace(next ?? (auth.user.familyId ? '/dashboard' : '/family/setup'));
    }
  }, [auth, next, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError('Mật khẩu tối thiểu 8 ký tự.');
      return;
    }
    if (password !== confirm) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await register({
        email: email.trim(),
        password,
        name: name.trim(),
        gender,
        birthdate: birthdate || undefined,
      });
      setToken(res.accessToken);
      if (next) {
        router.replace(next);
      } else {
        const setupUrl = weddingDate
          ? `/family/setup?wedding=${weddingDate}`
          : '/family/setup';
        router.replace(setupUrl);
      }
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Đăng ký thất bại';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-stone-50 px-4 py-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-50 via-stone-50 to-amber-50"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -right-40 h-96 w-96 rounded-full bg-emerald-200/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-amber-200/40 blur-3xl"
      />

      <div className="relative w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-700 text-2xl font-bold text-white shadow-lg shadow-emerald-700/20">
            C
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            Tạo tài khoản Concord
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Cùng vợ/chồng quản lý tài chính chung.
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200/80 bg-white/90 p-6 shadow-xl shadow-stone-300/30 backdrop-blur sm:p-8">
          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="ban@gmail.com"
                className={inputClass}
                disabled={submitting}
              />
            </Field>

            <Field label="Mật khẩu (≥ 8 ký tự)">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className={inputClass}
                disabled={submitting}
              />
            </Field>

            <Field label="Xác nhận mật khẩu">
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className={inputClass}
                disabled={submitting}
              />
            </Field>

            <Field label="Tên hiển thị">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={80}
                placeholder="Vd: Mạnh"
                className={inputClass}
                disabled={submitting}
              />
            </Field>

            <Field label="Giới tính">
              <div className="flex gap-2">
                <GenderRadio
                  value="male"
                  current={gender}
                  onChange={setGender}
                  label="Nam"
                />
                <GenderRadio
                  value="female"
                  current={gender}
                  onChange={setGender}
                  label="Nữ"
                />
              </div>
            </Field>

            <Field label="Ngày sinh (tuỳ chọn)">
              <input
                type="date"
                value={birthdate}
                onChange={(e) => setBirthdate(e.target.value)}
                className={inputClass}
                disabled={submitting}
              />
            </Field>

            <Field label="Ngày cưới (tuỳ chọn)">
              <input
                type="date"
                value={weddingDate}
                onChange={(e) => setWeddingDate(e.target.value)}
                className={inputClass}
                disabled={submitting}
              />
              <p className="mt-1 text-[11px] text-stone-400">
                Bạn có thể nhập sau khi tạo gia đình.
              </p>
            </Field>

            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-emerald-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-stone-300"
            >
              {submitting ? 'Đang tạo…' : 'Đăng ký'}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-stone-500">
            Đã có tài khoản?{' '}
            <Link
              href="/login"
              className="font-medium text-emerald-700 hover:underline"
            >
              Đăng nhập
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

const inputClass =
  'w-full rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm transition-colors placeholder:text-stone-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100';

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-stone-700">
        {label}
      </label>
      {children}
    </div>
  );
}

function GenderRadio({
  value,
  current,
  onChange,
  label,
}: {
  value: UserGender;
  current: UserGender;
  onChange: (v: UserGender) => void;
  label: string;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
        active
          ? 'border-emerald-500 bg-emerald-50 font-medium text-emerald-900'
          : 'border-stone-200 bg-white text-stone-700 hover:border-emerald-200 hover:bg-emerald-50/50'
      }`}
    >
      {label}
    </button>
  );
}
