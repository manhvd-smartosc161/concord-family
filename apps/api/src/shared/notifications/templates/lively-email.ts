export interface LivelyEmailInput {
  icon: string;
  kindLabel: string;
  name: string;
  occursOn: string;
  isLunar: boolean;
  notes: string | null;
  daysBefore: number;
  message: string;
}

export function buildLivelyEmail(input: LivelyEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const dayPhrase =
    input.daysBefore === 0
      ? 'Hôm nay là'
      : input.daysBefore > 0
        ? `Còn ${input.daysBefore} ngày nữa là`
        : `Cách đây ${Math.abs(input.daysBefore)} ngày là`;
  const subject = `${input.icon} ${dayPhrase} ${input.name}`;
  const dateVi = formatDateVi(input.occursOn);
  const lunarBadge = input.isLunar ? ' (theo lịch âm)' : '';

  const text = [
    subject,
    '',
    input.message,
    '',
    `📅 ${dateVi}${lunarBadge}`,
    `🔖 ${input.kindLabel}`,
    input.notes ? `📝 ${input.notes}` : null,
    '',
    '— Concord, couple finance agent',
  ]
    .filter((s) => s !== null)
    .join('\n');

  const html = `<!doctype html>
<html lang="vi">
  <body style="margin:0;padding:0;background:#fafaf9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1c1917;">
    <div style="max-width:560px;margin:0 auto;padding:24px 16px;">
      <div style="background:linear-gradient(135deg,#10b981 0%,#0ea5e9 100%);border-radius:16px 16px 0 0;padding:28px 24px;color:#ffffff;">
        <div style="font-size:32px;line-height:1;margin-bottom:8px;">${escape(input.icon)}</div>
        <div style="font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;opacity:0.85;">
          ${escape(input.kindLabel)}
        </div>
        <h1 style="margin:6px 0 0;font-size:22px;line-height:1.3;font-weight:600;">
          ${escape(dayPhrase)} ${escape(input.name)}
        </h1>
      </div>
      <div style="background:#ffffff;border-radius:0 0 16px 16px;border:1px solid #e7e5e4;border-top:none;padding:24px;">
        <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#292524;font-style:italic;border-left:3px solid #10b981;padding-left:14px;">
          ${escape(input.message)}
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;color:#57534e;">
          <tr>
            <td style="padding:8px 0;width:24px;vertical-align:top;">📅</td>
            <td style="padding:8px 0;">
              <strong style="color:#1c1917;">${escape(dateVi)}</strong>${escape(lunarBadge)}
            </td>
          </tr>
          ${
            input.notes
              ? `<tr>
            <td style="padding:8px 0;vertical-align:top;">📝</td>
            <td style="padding:8px 0;">${escape(input.notes)}</td>
          </tr>`
              : ''
          }
        </table>
      </div>
      <p style="text-align:center;margin:16px 0 0;font-size:11px;color:#a8a29e;">
        Concord · couple finance agent
      </p>
    </div>
  </body>
</html>`;

  return { subject, html, text };
}

function formatDateVi(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  const weekday = d.toLocaleDateString('vi-VN', {
    weekday: 'long',
    timeZone: 'UTC',
  });
  const dmY = d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return `${capitalize(weekday)}, ${dmY}`;
}

function capitalize(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
