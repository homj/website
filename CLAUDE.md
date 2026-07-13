# Johannes Homeier — personal site

Astro 4 (hybrid output) + React 18 islands, deployed on Vercel.
Static pages + one serverless endpoint: `src/pages/api/contact.ts`
(Resend email + Neon Postgres + Friendly Captcha; all optional via env vars —
see `.env.example`).

## Commands
- `npm run dev` / `npm run build` / `npm run preview`
- `npm run check` — astro typecheck (must pass before commit)
- `npm run test` — vitest (must pass before commit)

## Layout
- `src/pages/` — index, imprint, privacy, api/contact
- `src/components/` — sections.tsx + ui.tsx (React islands), *.astro (static)
- `src/styles/` — colors-and-type.css (design tokens), kit.css, site.css
- `src/data/` — seo.ts (JSON-LD), legal.ts (imprint/privacy controller data)
- `scripts/gen-assets.mjs` — regenerates favicons + og.png (`node scripts/gen-assets.mjs`)
- `plans/` — advisor implementation plans; read plans/README.md before executing one

## Conventions
- 2-space indent, single quotes, semicolons; explanatory block comments above
  functions (see src/pages/api/contact.ts).
- Design tokens only — never hardcode colors in components; use the CSS
  custom properties from colors-and-type.css.
- The legal pages' prose (imprint/privacy) is lawyer-adjacent content — do not
  reword it as part of unrelated changes.
- `NOTE_MAX` in sections.tsx must stay in sync with `MAX_LEN` in contact.ts.
