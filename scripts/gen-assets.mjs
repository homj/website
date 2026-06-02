// Generates the social-share image and raster favicons.
// Run with: node scripts/gen-assets.mjs
//  - Favicons: sharp rasterizes inline SVGs (the み needs a system Japanese
//    font, e.g. IPAGothic / Noto Sans JP).
//  - OG image: satori renders the text as Space Grotesk glyph outlines (no
//    system font needed), composited over a dot-grid background.
import sharp from 'sharp';
import satori from 'satori';
import { mkdir, readFile } from 'node:fs/promises';

const OUT = new URL('../public/', import.meta.url);
await mkdir(OUT, { recursive: true });
const outPath = (f) => new URL(f, OUT).pathname;

const JP = "ui-sans-serif, system-ui, 'IPAGothic', 'Noto Sans JP', sans-serif";
const ICON_BG = '#FAF9F5';
const ICON_FG = '#1B1A16';

// ── favicons ────────────────────────────────────────────────────────────────
const iconSvg = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${ICON_BG}"/>
  <text x="50%" y="55%" text-anchor="middle" dominant-baseline="central" font-family="${JP}" font-size="${Math.round(size * 0.6)}" font-weight="500" fill="${ICON_FG}">み</text>
</svg>`;

await Promise.all([
  sharp(Buffer.from(iconSvg(180))).png().toFile(outPath('apple-touch-icon.png')),
  sharp(Buffer.from(iconSvg(192))).png().toFile(outPath('icon-192.png')),
  sharp(Buffer.from(iconSvg(512))).png().toFile(outPath('icon-512.png')),
  sharp(Buffer.from(iconSvg(32))).png().toFile(outPath('favicon-32.png')),
]);

// ── OG image (1200x630) ──────────────────────────────────────────────────────
const fontDir = new URL('../node_modules/@fontsource/space-grotesk/files/', import.meta.url);
const sg = async (w) => readFile(new URL(`space-grotesk-latin-${w}-normal.woff`, fontDir));

const dots = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs>
    <pattern id="d" width="26" height="26" patternUnits="userSpaceOnUse">
      <circle cx="13" cy="13" r="1.9" fill="#6FA28F" fill-opacity="0.55"/>
    </pattern>
  </defs>
  <rect width="1200" height="630" fill="#FBFAF8"/>
  <rect width="1200" height="630" fill="url(#d)"/>
</svg>`;

const text = (children) => ({ type: 'div', props: children });
const og = text({
  style: { display: 'flex', flexDirection: 'column', justifyContent: 'center', width: '1200px', height: '630px', padding: '0 90px' },
  children: [
    text({ style: { fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: '96px', letterSpacing: '-3px', color: '#16161A', lineHeight: 1 }, children: 'Johannes Homeier' }),
    text({ style: { fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: '42px', color: '#62626A', marginTop: '14px' }, children: 'Product engineer & tech lead' }),
  ],
});

const textSvg = await satori(og, {
  width: 1200, height: 630,
  fonts: [
    { name: 'Space Grotesk', data: await sg(700), weight: 700, style: 'normal' },
    { name: 'Space Grotesk', data: await sg(500), weight: 500, style: 'normal' },
  ],
});

const bgPng = await sharp(Buffer.from(dots)).png().toBuffer();
const textPng = await sharp(Buffer.from(textSvg)).png().toBuffer();
await sharp(bgPng).composite([{ input: textPng, left: 0, top: 0 }]).png().toFile(outPath('og.png'));

console.log('Generated og.png + favicons in public/');
