import { Lunar, Solar } from 'lunar-javascript';
import type { ImportantDate } from '../entities/important-date.entity';
import type {
  AiDateItem,
  AiDateKind,
} from '../entities/yearly-ai-cache.entity';

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

export function lunarOf(date: Date): {
  year: number;
  month: number;
  day: number;
} {
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

interface AgendaSpec {
  name: string;
  kind: AiDateKind;
  notes: string | null;
  remindDaysBefore: number[];
}

interface LunarAgendaSpec extends AgendaSpec {
  lunarMonth: number;
  lunarDay: number;
}

interface SolarAgendaSpec extends AgendaSpec {
  solarMonth: number;
  solarDay: number;
}

const LUNAR_FIXED: LunarAgendaSpec[] = [
  {
    lunarMonth: 1,
    lunarDay: 1,
    name: 'Tết Nguyên Đán',
    kind: 'lunar',
    notes: 'Mùng 1 Tết âm lịch',
    remindDaysBefore: [7, 3, 0],
  },
  {
    lunarMonth: 3,
    lunarDay: 10,
    name: 'Giỗ Tổ Hùng Vương',
    kind: 'national',
    notes: '10/3 âm lịch',
    remindDaysBefore: [3, 0],
  },
  {
    lunarMonth: 5,
    lunarDay: 5,
    name: 'Tết Đoan Ngọ',
    kind: 'lunar',
    notes: 'Mùng 5 tháng 5 âm',
    remindDaysBefore: [3, 0],
  },
  {
    lunarMonth: 7,
    lunarDay: 15,
    name: 'Vu Lan',
    kind: 'religious',
    notes: 'Rằm tháng 7 âm',
    remindDaysBefore: [2, 0],
  },
  {
    lunarMonth: 8,
    lunarDay: 15,
    name: 'Tết Trung Thu',
    kind: 'lunar',
    notes: 'Rằm tháng 8 âm',
    remindDaysBefore: [3, 0],
  },
  {
    lunarMonth: 12,
    lunarDay: 23,
    name: 'Ông Công Ông Táo',
    kind: 'lunar',
    notes: '23 tháng Chạp âm',
    remindDaysBefore: [2, 0],
  },
];

const SOLAR_FIXED: SolarAgendaSpec[] = [
  {
    solarMonth: 1,
    solarDay: 1,
    name: 'Tết Dương lịch',
    kind: 'national',
    notes: null,
    remindDaysBefore: [1, 0],
  },
  {
    solarMonth: 3,
    solarDay: 8,
    name: '8/3 - Quốc tế phụ nữ',
    kind: 'international',
    notes: null,
    remindDaysBefore: [1, 0],
  },
  {
    solarMonth: 4,
    solarDay: 30,
    name: 'Giải phóng miền Nam',
    kind: 'national',
    notes: null,
    remindDaysBefore: [3, 0],
  },
  {
    solarMonth: 5,
    solarDay: 1,
    name: 'Quốc tế lao động',
    kind: 'national',
    notes: null,
    remindDaysBefore: [3, 0],
  },
  {
    solarMonth: 6,
    solarDay: 1,
    name: 'Quốc tế thiếu nhi',
    kind: 'international',
    notes: null,
    remindDaysBefore: [1, 0],
  },
  {
    solarMonth: 9,
    solarDay: 2,
    name: 'Quốc khánh',
    kind: 'national',
    notes: null,
    remindDaysBefore: [3, 0],
  },
  {
    solarMonth: 10,
    solarDay: 20,
    name: 'Phụ nữ Việt Nam',
    kind: 'international',
    notes: null,
    remindDaysBefore: [1, 0],
  },
  {
    solarMonth: 11,
    solarDay: 20,
    name: 'Nhà giáo Việt Nam',
    kind: 'international',
    notes: null,
    remindDaysBefore: [1, 0],
  },
  {
    solarMonth: 12,
    solarDay: 24,
    name: 'Đêm Giáng Sinh',
    kind: 'religious',
    notes: null,
    remindDaysBefore: [1, 0],
  },
  {
    solarMonth: 12,
    solarDay: 25,
    name: 'Giáng Sinh',
    kind: 'religious',
    notes: null,
    remindDaysBefore: [1, 0],
  },
];

const LUNAR_SPECIAL_KEYS = new Set(
  LUNAR_FIXED.map((s) => `${s.lunarMonth}-${s.lunarDay}`),
);

function lunarToSolarIso(
  lunarYear: number,
  lunarMonth: number,
  lunarDay: number,
): string {
  const lunar = Lunar.fromYmd(lunarYear, lunarMonth, lunarDay);
  const solar = lunar.getSolar();
  const y = solar.getYear();
  const m = String(solar.getMonth()).padStart(2, '0');
  const d = String(solar.getDay()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function pushIfYearMatches(
  out: AiDateItem[],
  iso: string,
  targetYear: number,
  spec: AgendaSpec,
): void {
  if (!iso.startsWith(`${targetYear}-`)) return;
  out.push({
    date: iso,
    name: spec.name,
    kind: spec.kind,
    notes: spec.notes,
    remindDaysBefore: spec.remindDaysBefore,
  });
}

export function buildYearlyAgenda(year: number): AiDateItem[] {
  const out: AiDateItem[] = [];

  for (const lunarYear of [year - 1, year]) {
    for (let m = 1; m <= 12; m++) {
      for (const day of [1, 15]) {
        if (LUNAR_SPECIAL_KEYS.has(`${m}-${day}`)) continue;
        const iso = lunarToSolarIso(lunarYear, m, day);
        const label = day === 1 ? `Mùng 1 tháng ${m} âm` : `Rằm tháng ${m} âm`;
        pushIfYearMatches(out, iso, year, {
          name: label,
          kind: 'lunar',
          notes: null,
          remindDaysBefore: [2, 0],
        });
      }
    }

    for (const spec of LUNAR_FIXED) {
      const iso = lunarToSolarIso(lunarYear, spec.lunarMonth, spec.lunarDay);
      pushIfYearMatches(out, iso, year, spec);
    }
  }

  for (const spec of SOLAR_FIXED) {
    const m = String(spec.solarMonth).padStart(2, '0');
    const d = String(spec.solarDay).padStart(2, '0');
    out.push({
      date: `${year}-${m}-${d}`,
      name: spec.name,
      kind: spec.kind,
      notes: spec.notes,
      remindDaysBefore: spec.remindDaysBefore,
    });
  }

  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}
