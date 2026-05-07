import { Lunar, Solar } from 'lunar-javascript';
import type { ImportantDate } from '../entities/important-date.entity';

export function lunarToSolarThisYear(
  lunarMonth: number,
  lunarDay: number,
  gregorianYear: number,
): { month: number; day: number } {
  const lunar = Lunar.fromYmd(gregorianYear, lunarMonth, lunarDay);
  const solar = lunar.getSolar();
  return { month: solar.getMonth(), day: solar.getDay() };
}

export function resolveOccurrenceForYear(
  entry: Pick<ImportantDate, 'date' | 'isLunar'>,
  year: number,
): Date {
  const stored = new Date(entry.date);
  const m = stored.getUTCMonth() + 1;
  const d = stored.getUTCDate();
  if (entry.isLunar) {
    const s = lunarToSolarThisYear(m, d, year);
    return new Date(Date.UTC(year, s.month - 1, s.day));
  }
  return new Date(Date.UTC(year, m - 1, d));
}

export function daysBetweenUtc(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / 86_400_000);
}

export function lunarOf(date: Date): { year: number; month: number; day: number } {
  const solar = Solar.fromYmd(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  );
  const lunar = solar.getLunar();
  return {
    year: lunar.getYear(),
    month: lunar.getMonth(),
    day: lunar.getDay(),
  };
}

export function addDaysUtc(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export function todayInTimezone(timeZone: string): Date {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(now);
  const y = Number(parts.find((p) => p.type === 'year')?.value);
  const m = Number(parts.find((p) => p.type === 'month')?.value);
  const d = Number(parts.find((p) => p.type === 'day')?.value);
  return new Date(Date.UTC(y, m - 1, d));
}
