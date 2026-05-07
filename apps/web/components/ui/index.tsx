'use client';

import { type ReactNode } from 'react';

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between border-b border-stone-200 bg-white px-6 py-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-stone-900">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 text-xs text-stone-500">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  children,
  className = '',
  padding = 'p-5',
}: {
  children: ReactNode;
  className?: string;
  padding?: string;
}) {
  return (
    <div
      className={`rounded-xl bg-white shadow-sm ring-1 ring-stone-200/60 ${padding} ${className}`}
    >
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'default' | 'positive' | 'negative' | 'neutral';
}) {
  const valueColor = {
    default: 'text-stone-900',
    positive: 'text-emerald-700',
    negative: 'text-rose-700',
    neutral: 'text-stone-600',
  }[tone];
  return (
    <Card>
      <div className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
        {label}
      </div>
      <div
        className={`mt-1 font-mono text-2xl font-semibold tabular-nums tracking-tight ${valueColor}`}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-[11px] text-stone-400">{hint}</div>}
    </Card>
  );
}

export function ProgressBar({
  value,
  max,
  tone = 'emerald',
}: {
  value: number;
  max: number;
  tone?: 'emerald' | 'amber' | 'rose';
}) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(max, 1)) * 100));
  const fill = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
  }[tone];
  return (
    <div className="h-2 overflow-hidden rounded-full bg-stone-100">
      <div
        className={`h-full ${fill} transition-all duration-500`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'emerald' | 'amber' | 'rose' | 'neutral';
}) {
  const cls = {
    emerald: 'bg-emerald-100 text-emerald-800',
    amber: 'bg-amber-100 text-amber-800',
    rose: 'bg-rose-100 text-rose-800',
    neutral: 'bg-stone-100 text-stone-700',
  }[tone];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <div className="text-3xl">{icon}</div>
      <div className="text-sm font-medium text-stone-700">{title}</div>
      {description && (
        <div className="max-w-md text-xs text-stone-500">{description}</div>
      )}
    </div>
  );
}

export function Skeleton({
  className = 'h-6 w-full',
}: {
  className?: string;
}) {
  return <div className={`animate-pulse rounded-md bg-stone-100 ${className}`} />;
}
