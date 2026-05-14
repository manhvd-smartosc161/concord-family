'use client';

export function Pagination({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (p: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <button
        onClick={() => onChange(Math.max(0, page - 1))}
        disabled={page === 0}
        className="flex min-h-[44px] items-center justify-center rounded-lg border border-border bg-card px-4 text-xs text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
      >
        ← Trước
      </button>
      <span className="text-xs text-muted-foreground">
        Trang {page + 1} / {total}
      </span>
      <button
        onClick={() => onChange(Math.min(total - 1, page + 1))}
        disabled={page >= total - 1}
        className="flex min-h-[44px] items-center justify-center rounded-lg border border-border bg-card px-4 text-xs text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
      >
        Tiếp →
      </button>
    </div>
  );
}
