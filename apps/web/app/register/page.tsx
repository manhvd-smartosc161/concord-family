'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ApiError, setToken } from '@/lib/api-client';
import { register } from '@/features/auth/api';
import { useAuth } from '@/features/auth/hooks';
import { BrandPanel } from '@/features/auth/components/brand-panel';
import { LocaleToggle } from '@/components/layout/locale-toggle';
import type { UserGender } from '@/features/auth/types';

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterInner />
    </Suspense>
  );
}

function RegisterInner() {
  const t = useTranslations('auth');
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next');
  const { state: auth } = useAuth(false);

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
      setError(t('register_pw_too_short'));
      return;
    }
    if (password !== confirm) {
      setError(t('pw_mismatch'));
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
            : t('register_failed');
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen lg:grid lg:grid-cols-[1.05fr_1fr] xl:grid-cols-[1.2fr_1fr]">
      <BrandPanel />

      <MobileBackdrop />

      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <LocaleToggle />
      </div>

      <div className="relative flex min-h-screen flex-col px-5 pb-10 pt-10 sm:px-8 lg:min-h-0 lg:items-center lg:justify-center lg:bg-background lg:px-6 lg:py-10">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-6 flex flex-col items-center lg:hidden">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-700 text-lg font-bold text-white shadow-lg shadow-emerald-700/25">
              C
            </div>
            <div className="mt-3 text-center">
              <div className="text-base font-semibold tracking-tight text-foreground">
                Concord
              </div>
              <div className="mt-0.5 text-[12px] text-muted-foreground">
                {t('brand_eyebrow')}
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-card/90 p-6 shadow-[0_20px_40px_-20px_rgba(15,42,30,0.15)] ring-1 ring-border/60 backdrop-blur-sm sm:p-7 lg:rounded-2xl lg:bg-transparent lg:p-0 lg:shadow-none lg:ring-0 lg:backdrop-blur-none">
            <div className="lg:text-left">
              <h1 className="text-xl font-semibold tracking-tight text-foreground lg:text-2xl">
                {t('register_title')}
              </h1>
              <p className="mt-1 hidden text-sm text-muted-foreground lg:block">
                {t('brand_subhead')}
              </p>
            </div>

            <form onSubmit={onSubmit} className="mt-6 space-y-4 lg:mt-8">
              <Field label={t('email')}>
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

              <Field label={t('name')}>
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

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={`${t('password')} (≥ 8)`}>
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

                <Field label={t('confirm_password')}>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    className={inputClass}
                    disabled={submitting}
                  />
                </Field>
              </div>

              <Field label={t('gender')}>
                <div className="flex gap-2">
                  <GenderRadio
                    value="male"
                    current={gender}
                    onChange={setGender}
                    label={t('male')}
                  />
                  <GenderRadio
                    value="female"
                    current={gender}
                    onChange={setGender}
                    label={t('female')}
                  />
                </div>
              </Field>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={t('birthdate_optional')}>
                  <DateInput
                    value={birthdate}
                    onChange={setBirthdate}
                    placeholder={t('date_hint')}
                    disabled={submitting}
                  />
                </Field>

                <Field label={t('wedding_date_optional')}>
                  <DateInput
                    value={weddingDate}
                    onChange={setWeddingDate}
                    placeholder={t('date_hint')}
                    disabled={submitting}
                  />
                </Field>
              </div>

              {error && (
                <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-xs text-rose-800 dark:text-rose-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-medium text-white shadow-sm shadow-emerald-700/20 transition-all hover:bg-emerald-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none lg:rounded-lg lg:py-2.5"
              >
                {submitting ? t('register_submitting') : t('register_link')}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t('already_account')}{' '}
            <Link
              href="/login"
              className="font-medium text-emerald-700 hover:underline"
            >
              {t('login_link')}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

function MobileBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden lg:hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/70 dark:from-emerald-950/20 via-background to-amber-50/40 dark:to-amber-950/20" />
      <div className="absolute -left-32 -top-32 h-72 w-72 rounded-full bg-emerald-200/50 dark:bg-emerald-900/20 blur-3xl" />
      <div className="absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-amber-200/40 dark:bg-amber-900/20 blur-3xl" />
    </div>
  );
}

const inputClass =
  'w-full rounded-xl border border-input bg-background px-4 py-3 text-sm transition-colors placeholder:text-muted-foreground focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900 lg:rounded-lg lg:px-3.5 lg:py-2.5';

function DateInput({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  function openPicker() {
    if (disabled) return;
    const el = ref.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') {
      el.showPicker();
    } else {
      el.focus();
      el.click();
    }
  }
  const formatted = value
    ? new Date(`${value}T00:00:00`).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '';
  return (
    <button
      type="button"
      onClick={openPicker}
      disabled={disabled}
      className={`relative flex w-full items-center justify-between rounded-xl border border-input bg-background px-4 py-3 text-left text-sm transition-colors hover:border-emerald-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900 disabled:cursor-not-allowed disabled:opacity-60 lg:rounded-lg lg:px-3.5 lg:py-2.5 ${
        formatted ? 'text-foreground' : 'text-muted-foreground'
      }`}
    >
      <span>{formatted || placeholder}</span>
      <svg
        className="h-4 w-4 text-muted-foreground"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
      <input
        ref={ref}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        tabIndex={-1}
        aria-hidden
      />
    </button>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
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
      className={`flex-1 rounded-xl border px-3 py-2.5 text-sm transition-colors lg:rounded-lg lg:py-2 ${
        active
          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 font-medium text-emerald-900 dark:text-emerald-300'
          : 'border-border bg-background text-muted-foreground hover:border-emerald-200 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/60'
      }`}
    >
      {label}
    </button>
  );
}
