export function getFinancialMonthRange(
  year: number,
  month: number,
  cutoffDay: number,
): { start: Date; end: Date } {
  const offset = cutoffDay > 1 ? 1 : 0;
  const start = new Date(Date.UTC(year, month - 1 - offset, cutoffDay));
  const end = new Date(Date.UTC(year, month - offset, cutoffDay));
  return { start, end };
}

export function getCurrentFinancialMonth(
  today: Date,
  cutoffDay: number,
): { year: number; month: number } {
  const d = today.getUTCDate();
  const m = today.getUTCMonth() + 1;
  const y = today.getUTCFullYear();
  if (cutoffDay === 1) return { year: y, month: m };
  if (d < cutoffDay) return { year: y, month: m };
  if (m === 12) return { year: y + 1, month: 1 };
  return { year: y, month: m + 1 };
}
