'use client';

import type { FundView } from '../types';

export function FundFilterTabs({
  funds,
  value,
  onChange,
}: {
  funds: FundView[];
  value: string;
  onChange: (v: string) => void;
}) {
  const tabs: Array<
    { id: string; label: string; icon: string; disabled?: boolean }
  > = funds.map((f) => ({
    id: f.id,
    label: f.name.replace('Quỹ ', ''),
    icon: f.accessLevel === 'private' ? '🔒' : f.type === 'joint' ? '🤝' : '💰',
    disabled: f.accessLevel === 'private',
  }));
  return (
    <div className="flex flex-wrap gap-1">
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            onClick={() => !t.disabled && onChange(t.id)}
            disabled={t.disabled}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              active
                ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                : t.disabled
                  ? 'cursor-not-allowed border-border bg-muted text-muted-foreground/40'
                  : 'border-border bg-card text-foreground hover:bg-muted'
            }`}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        );
      })}
    </div>
  );
}
