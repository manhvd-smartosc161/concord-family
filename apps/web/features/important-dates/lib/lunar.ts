import { Solar } from 'lunar-javascript';

export interface LunarInfo {
  day: number;
  month: number;
  year: number;
  isFirstDay: boolean;
  isFullMoon: boolean;
}

export function lunarOf(date: Date): LunarInfo {
  const solar = Solar.fromYmd(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
  );
  const lunar = solar.getLunar();
  const day = lunar.getDay();
  const month = lunar.getMonth();
  return {
    day,
    month,
    year: lunar.getYear(),
    isFirstDay: day === 1,
    isFullMoon: day === 15,
  };
}

export function formatLunarShort(info: LunarInfo): string {
  return `${info.day}/${info.month}`;
}
