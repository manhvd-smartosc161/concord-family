import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';

const OUT = '/Users/manhvd/Desktop/concord/apps/web/public';

function svgIcon(size, rounded = false) {
  const r = rounded ? size * 0.22 : 0;
  const fontSize = Math.round(size * 0.62);
  const y = Math.round(size * 0.72);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" fill="#047857"/>
  <text x="50%" y="${y}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="${fontSize}" font-weight="700" text-anchor="middle" fill="#ffffff">C</text>
</svg>`;
}

mkdirSync(OUT, { recursive: true });

writeFileSync(`${OUT}/icon.svg`, svgIcon(512, false));

const targets = [
  { size: 192, rounded: false, name: 'icon-192.png' },
  { size: 512, rounded: false, name: 'icon-512.png' },
  { size: 180, rounded: true, name: 'apple-touch-icon.png' },
  { size: 32, rounded: false, name: 'favicon-32.png' },
];

for (const t of targets) {
  const svg = Buffer.from(svgIcon(t.size, t.rounded));
  await sharp(svg).png().toFile(`${OUT}/${t.name}`);
  console.log(`wrote ${t.name}`);
}
