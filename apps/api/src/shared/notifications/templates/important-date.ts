import type {
  ImportantDate,
  ImportantDateType,
} from '../../../modules/important-dates/entities/important-date.entity';

const ICONS: Record<ImportantDateType, string> = {
  birthday: '🎂',
  death_anniversary: '🕯️',
  anniversary: '💍',
  other: '📌',
};

const TYPE_LABEL: Record<ImportantDateType, string> = {
  birthday: 'sinh nhật',
  death_anniversary: 'ngày giỗ',
  anniversary: 'kỷ niệm',
  other: 'sự kiện',
};

export function buildTitle(entry: ImportantDate, daysBefore: number): string {
  const icon = ICONS[entry.type];
  if (daysBefore === 0) return `${icon} Hôm nay là ${entry.name}`;
  if (daysBefore > 0) return `${icon} Còn ${daysBefore} ngày nữa là ${entry.name}`;
  return `${icon} Cách đây ${Math.abs(daysBefore)} ngày là ${entry.name}`;
}

export function buildBody(entry: ImportantDate, daysBefore: number): string {
  const label = TYPE_LABEL[entry.type];
  const lunarSuffix = entry.isLunar ? ' (theo lịch âm)' : '';
  const note = entry.notes ? `\n${entry.notes}` : '';
  if (daysBefore === 0) {
    return `Đừng quên ${label} hôm nay${lunarSuffix}.${note}`;
  }
  if (daysBefore > 0) {
    return `Còn ${daysBefore} ngày nữa là ${label}${lunarSuffix}.${note}`;
  }
  return `Cách đây ${Math.abs(daysBefore)} ngày là ${label}${lunarSuffix}.${note}`;
}

export function buildEmail(
  entry: ImportantDate,
  daysBefore: number,
): { subject: string; html: string; text: string } {
  const subject = buildTitle(entry, daysBefore);
  const body = buildBody(entry, daysBefore);
  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1c1917;">
  <h1 style="font-size:20px;margin:0 0 12px;color:#0c0a09;">${escape(subject)}</h1>
  <p style="font-size:14px;line-height:1.6;color:#44403c;white-space:pre-line;">${escape(body)}</p>
  <hr style="border:none;border-top:1px solid #e7e5e4;margin:24px 0;" />
  <p style="font-size:12px;color:#a8a29e;">Concord — couple finance agent</p>
</div>`.trim();
  const text = `${subject}\n\n${body}`;
  return { subject, html, text };
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
