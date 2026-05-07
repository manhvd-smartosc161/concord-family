'use client';

const PRESETS: { value: number; label: string }[] = [
  { value: 0, label: 'Hôm đó' },
  { value: 1, label: '1 ngày trước' },
  { value: 3, label: '3 ngày' },
  { value: 7, label: '1 tuần' },
  { value: 14, label: '2 tuần' },
  { value: 30, label: '1 tháng' },
];

export function ReminderChips({
  value,
  onChange,
}: {
  value: number[];
  onChange: (next: number[]) => void;
}) {
  const set = new Set(value);
  function toggle(v: number) {
    if (set.has(v)) {
      onChange(value.filter((x) => x !== v));
    } else {
      onChange([...value, v].sort((a, b) => a - b));
    }
  }
  return (
    <div className="flex flex-wrap gap-2">
      {PRESETS.map((p) => {
        const active = set.has(p.value);
        return (
          <button
            key={p.value}
            type="button"
            onClick={() => toggle(p.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors ${
              active
                ? 'bg-emerald-600 text-white ring-emerald-600'
                : 'bg-white text-stone-700 ring-stone-300 hover:bg-stone-50'
            }`}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
