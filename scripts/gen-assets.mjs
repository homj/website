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
// Render the み once at high resolution, trim to its exact ink bounds, then
// resize + center-composite per size so it's perfectly centered on every icon
// (dominant-baseline alone mis-centers CJK glyphs in the rasterizer).
const glyphSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="${JP}" font-size="400" font-weight="500" fill="${ICON_FG}">み</text></svg>`;
const glyph = await sharp(Buffer.from(glyphSvg)).png().trim().toBuffer();

const icon = async (file, size) => {
  const box = Math.round(size * 0.6); // fit the glyph in a padded, centered box
  const g = await sharp(glyph).resize({ width: box, height: box, fit: 'inside' }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: ICON_BG } })
    .composite([{ input: g, gravity: 'center' }])
    .png()
    .toFile(outPath(file));
};

await Promise.all([
  icon('apple-touch-icon.png', 180),
  icon('icon-192.png', 192),
  icon('icon-512.png', 512),
  icon('favicon-32.png', 32),
]);

// ── OG image (1200x630) ──────────────────────────────────────────────────────
const fontDir = new URL('../node_modules/@fontsource/inter/files/', import.meta.url);
const inter = async (w) => readFile(new URL(`inter-latin-${w}-normal.woff`, fontDir));

const dots = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs>
    <pattern id="d" width="40" height="40" patternUnits="userSpaceOnUse">
      <circle cx="20" cy="20" r="2.6" fill="#6FA28F" fill-opacity="0.3"/>
    </pattern>
  </defs>
  <rect width="1200" height="630" fill="#FBFAF8"/>
  <rect width="1200" height="630" fill="url(#d)"/>
</svg>`;

const text = (children) => ({ type: 'div', props: children });
const og = text({
  style: { display: 'flex', flexDirection: 'column', justifyContent: 'center', width: '1200px', height: '630px', padding: '0 90px' },
  children: [
    text({ style: { fontFamily: 'Inter', fontWeight: 700, fontSize: '96px', letterSpacing: '-2px', color: '#16161A', lineHeight: 1 }, children: 'Johannes Homeier' }),
    text({ style: { fontFamily: 'Inter', fontWeight: 400, fontSize: '52px', color: '#9A9AA2', marginTop: '16px' }, children: 'Product Engineer & Tech Lead' }),
  ],
});

const textSvg = await satori(og, {
  width: 1200, height: 630,
  fonts: [
    { name: 'Inter', data: await inter(700), weight: 700, style: 'normal' },
    { name: 'Inter', data: await inter(400), weight: 400, style: 'normal' },
  ],
});

const bgPng = await sharp(Buffer.from(dots)).png().toBuffer();
const textPng = await sharp(Buffer.from(textSvg)).png().toBuffer();
await sharp(bgPng).composite([{ input: textPng, left: 0, top: 0 }]).png().toFile(outPath('og.png'));

console.log('Generated og.png + favicons in public/');
