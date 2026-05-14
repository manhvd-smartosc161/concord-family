'use client';

import { useTranslations } from 'next-intl';

export function BrandPanel() {
  const t = useTranslations('auth');
  return (
    <div className="relative hidden overflow-hidden bg-gradient-to-br from-emerald-700 via-emerald-800 to-emerald-900 lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
      <Decor />

      <div className="relative z-10 flex items-center gap-3">
        <BrandLogo />
        <div>
          <div className="text-base font-semibold text-white">Concord</div>
          <div className="text-[11px] uppercase tracking-widest text-emerald-200/70">
            {t('brand_eyebrow')}
          </div>
        </div>
      </div>

      <div className="relative z-10 max-w-md">
        <h2 className="whitespace-pre-line text-4xl font-semibold leading-tight tracking-tight text-white xl:text-5xl">
          {t('brand_headline')}
        </h2>
        <p className="mt-5 text-sm leading-relaxed text-emerald-100/80 xl:text-base">
          {t('brand_subhead')}
        </p>

        <ul className="mt-8 space-y-3">
          <Bullet>{t('brand_bullet_1')}</Bullet>
          <Bullet>{t('brand_bullet_2')}</Bullet>
          <Bullet>{t('brand_bullet_3')}</Bullet>
        </ul>
      </div>

      <div className="relative z-10 flex items-end justify-between gap-4">
        <GoalCard />
      </div>
    </div>
  );
}

function BrandLogo() {
  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-lg font-bold text-white ring-1 ring-white/20 backdrop-blur">
      C
    </div>
  );
}

function Decor() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-emerald-500/30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -left-32 h-[28rem] w-[28rem] rounded-full bg-amber-300/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }}
      />
    </>
  );
}

function GoalCard() {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/[0.07] p-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="flex -space-x-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-emerald-600 text-xs font-semibold text-white">
            A
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-amber-500 text-xs font-semibold text-white">
            E
          </div>
        </div>
        <div className="text-xs text-emerald-50/90">
          <div className="font-medium">100M VND</div>
          <div className="text-[11px] text-emerald-200/70">
            yearly goal · on track
          </div>
        </div>
      </div>
      <div className="mt-3 h-1.5 w-44 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-emerald-300 to-amber-300" />
      </div>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-sm text-emerald-50/90">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
        <svg
          className="h-3 w-3 text-emerald-200"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12l5 5L20 7" />
        </svg>
      </span>
      <span>{children}</span>
    </li>
  );
}

