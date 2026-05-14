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
    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border bg-background px-3 py-3 sm:px-4 sm:py-4 lg:px-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  children,
  className = '',
  padding = 'p-3 sm:p-5',
}: {
  children: ReactNode;
  className?: string;
  padding?: string;
}) {
  return (
    <div
      className={`rounded-xl bg-card shadow-sm ring-1 ring-border/60 ${padding} ${className}`}
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
    default: 'text-foreground',
    positive: 'text-emerald-700',
    negative: 'text-rose-700',
    neutral: 'text-muted-foreground',
  }[tone];
  return (
    <Card>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1 break-words font-mono text-lg font-semibold tabular-nums tracking-tight sm:text-xl lg:text-2xl ${valueColor}`}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
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
    <div className="h-2 overflow-hidden rounded-full bg-muted">
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
  tone?: 'emerald' | 'amber' | 'rose' | 'sky' | 'neutral';
}) {
  const cls = {
    emerald: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300',
    amber: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300',
    rose: 'bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300',
    sky: 'bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-300',
    neutral: 'bg-muted text-muted-foreground',
  }[tone];
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}
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
      <div className="text-sm font-medium text-foreground">{title}</div>
      {description && (
        <div className="max-w-md text-xs text-muted-foreground">{description}</div>
      )}
    </div>
  );
}

export function Skeleton({
  className = 'h-6 w-full',
}: {
  className?: string;
}) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

export { MobileDrawer } from './mobile-drawer';
