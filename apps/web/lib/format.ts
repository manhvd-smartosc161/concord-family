export function formatVND(n: number, withSign = false): string {
  const formatted = Math.abs(n).toLocaleString('vi-VN');
  if (n < 0) return `−${formatted}đ`;
  if (n === 0 || !withSign) return `${formatted}đ`;
  return `+${formatted}đ`;
}
