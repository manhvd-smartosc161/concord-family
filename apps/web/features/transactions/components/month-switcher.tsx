'use client';

export function MonthSwitcher({
  year,
  month,
  onShift,
  isCurrent,
}: {
  year: number;
  month: number;
  onShift: (delta: number) => void;
  isCurrent: boolean;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white p-1 sm:p-0.5">
      <button
        onClick={() => onShift(-1)}
        className="flex h-8 w-8 items-center justify-center rounded-md text-stone-600 transition-colors hover:bg-stone-100"
        aria-label="Tháng trước"
      >
        <Chevron dir="left" />
      </button>
      <div className="min-w-[100px] px-2 py-1 text-center text-xs font-medium text-stone-800 sm:min-w-[120px] sm:px-3 sm:py-1 sm:text-sm">
        Tháng {month}/{year}
      </div>
      <button
        onClick={() => onShift(1)}
        disabled={isCurrent}
        className="flex h-8 w-8 items-center justify-center rounded-md text-stone-600 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-30"
        aria-label="Tháng sau"
      >
        <Chevron dir="right" />
      </button>
    </div>
  );
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
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
        d={dir === 'left' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'}
      />
    </svg>
  );
}
