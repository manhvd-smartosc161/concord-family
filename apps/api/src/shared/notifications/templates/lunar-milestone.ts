export interface LunarMilestoneInput {
  kind: 'mung1' | 'ram';
  target: Date;
  lunarMonth: number;
  daysBefore: number;
}

export function buildLunarMilestoneEmail(
  input: LunarMilestoneInput,
): { subject: string; html: string; text: string } {
  const { kind, target, lunarMonth, daysBefore } = input;
  const label = kind === 'mung1' ? 'mùng 1' : 'rằm';
  const dayPhrase =
    daysBefore === 0
      ? 'Hôm nay'
      : daysBefore === 1
        ? 'Mai'
        : `Còn ${daysBefore} ngày nữa`;
  const targetVi = target.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const subject = `🌙 ${dayPhrase} là ${label} tháng ${lunarMonth} âm`;
  const body = `${dayPhrase} là ${label} tháng ${lunarMonth} âm lịch (dương: ${targetVi}). Chuẩn bị hương hoa, lễ vật nhé.`;
  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1c1917;">
  <h1 style="font-size:20px;margin:0 0 12px;color:#0c0a09;">${escape(subject)}</h1>
  <p style="font-size:14px;line-height:1.6;color:#44403c;">${escape(body)}</p>
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
