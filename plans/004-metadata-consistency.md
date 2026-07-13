# Plan 004: Stop leaking the email in JSON-LD; align theme-color, manifest, sitemap; add 404; drop the unused 700 font

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 762e2c2..HEAD -- src/data/seo.ts src/layouts/Layout.astro public/site.webmanifest public/sitemap.xml src/pages/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (independent of 001–003; if plan 002 landed first the
  build-output path in step 5 is unchanged)
- **Category**: bug
- **Planned at**: commit `762e2c2`, 2026-07-12

## Why this matters

Four small inconsistencies, one of which defeats a deliberate feature:

1. The repo went out of its way to make the email address harvester-safe —
   `src/components/Email.astro` renders it as obfuscated fragments and the
   commit history shows "harvester-safe email" as an explicit goal (PR #2).
   But `src/data/seo.ts` puts the same address in **cleartext JSON-LD** that
   ships in the HTML source of the home page. Any harvester gets it for free.
2. `theme-color` metas and the web manifest still carry the "warm" palette
   values (`#FBF9F4`), but the site pins `data-mood="neutral"` whose
   backgrounds are `#FFFFFF` (light) / `#0C0C0E` (dark) — mobile browser
   chrome and the PWA splash tint don't match the actual page.
3. The hand-maintained `public/sitemap.xml` lists `/imprint/` and `/privacy/`
   with trailing slashes while the pages' canonical tags are generated from
   `Astro.url.pathname` — the two must agree, and today nobody has verified
   which form the build emits.
4. `Layout.astro` loads the Inter 700 weight, but no CSS rule in the repo
   ever uses a weight above 600 — a wasted font file on every page load.
   Plus: there is no `404.astro`, so visitors on a bad URL get a bare
   platform error page instead of the site's shell.

## Current state

- `src/data/seo.ts:13-37` — the `PERSON` JSON-LD object; the offending line:
  ```ts
  email: 'hello@johanneshomeier.com',
  ```
  (line 21). The same object provides name/url/jobTitle/sameAs — all fine.
- `src/layouts/Layout.astro:47-48`:
  ```html
  <meta name="theme-color" content="#FBF9F4" media="(prefers-color-scheme: light)" />
  <meta name="theme-color" content="#16161A" media="(prefers-color-scheme: dark)" />
  ```
- `src/layouts/Layout.astro:38` — the html element pins
  `data-theme="light" data-mood="neutral" ...`. The neutral palette in
  `src/styles/colors-and-type.css:56-82` defines light `--bg: #FFFFFF` and
  dark `--bg: #0C0C0E`.
- `src/layouts/Layout.astro:6-9` — font imports:
  ```js
  import '@fontsource/inter/latin-400.css';
  import '@fontsource/inter/latin-500.css';
  import '@fontsource/inter/latin-600.css';
  import '@fontsource/inter/latin-700.css';
  ```
  Verified at planning time: `grep -rn 'font-weight' src/` shows only
  `--weight-normal: 400`, `--weight-medium: 500`, `--weight-semi: 600` in use;
  nothing references 700 or `bold`. (`scripts/gen-assets.mjs:44` reads the
  700 **woff file directly from node_modules** for the OG image — that does
  not depend on this CSS import and must keep working.)
- `public/site.webmanifest` — `"background_color": "#FBF9F4"`,
  `"theme_color": "#FBF9F4"`.
- `public/sitemap.xml` — three `<url>` entries; imprint/privacy carry
  trailing slashes.
- No `src/pages/404.astro` exists. Existing page conventions to copy: see
  `src/pages/imprint.astro` — wraps content in
  `<Layout title="..." description="..."><div class="site"><Nav /><main>…</main><Footer /></div></Layout>`
  and uses the `.backlink` anchor with an inline arrow SVG for "Back".
  `Layout.astro` accepts a `noindex` prop (`Layout.astro:20,45`).

## Commands you will need

| Purpose   | Command          | Expected on success              |
|-----------|------------------|----------------------------------|
| Install   | `npm install`    | exit 0                           |
| Typecheck | `npm run check`  | 0 errors (if plan 001 landed; otherwise skip) |
| Build     | `npm run build`  | exit 0, output in `.vercel/output/static/` |

## Scope

**In scope** (the only files you should modify/create):
- `src/data/seo.ts`
- `src/layouts/Layout.astro` (theme-color lines + the latin-700 import line ONLY)
- `public/site.webmanifest`
- `public/sitemap.xml`
- `src/pages/404.astro` (create)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- `src/components/Email.astro` — the obfuscation component is correct as-is.
- `src/data/legal.ts` — the imprint legally must show a contact email; it
  stays (it's rendered via the obfuscating component).
- Adding `@astrojs/sitemap` — deferred until after plan 002 (no new
  dependencies on the old Astro major for 3 URLs).
- Making `theme-color` follow the in-page theme toggle (JS) — deferred;
  see maintenance notes.
- Any other content in `Layout.astro` (OG tags, inline scripts, JSON-LD
  rendering loop).

## Git workflow

- Branch: `advisor/004-metadata-consistency`
- Commit style: short imperative summary (match `git log`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Remove the email from JSON-LD

In `src/data/seo.ts`, delete line 21 (`email: 'hello@johanneshomeier.com',`)
from `PERSON`. Delete only that property.

**Verify**: `grep -rn 'hello@' src/ | grep -v legal.ts` → no matches.
(`src/data/legal.ts` still contains it — that one is rendered obfuscated and
is in scope for the imprint's legal requirement.)

### Step 2: Fix theme-color and manifest colors

- `Layout.astro:47-48` → light `#FFFFFF`, dark `#0C0C0E`.
- `public/site.webmanifest` → `"background_color": "#FFFFFF"`,
  `"theme_color": "#FFFFFF"`.

**Verify**: `grep -n 'FBF9F4\|16161A' src/layouts/Layout.astro public/site.webmanifest` → no matches.

### Step 3: Drop the unused 700 weight

Delete the single line `import '@fontsource/inter/latin-700.css';` from
`Layout.astro`. First re-confirm it is unused right now:

**Pre-check**: `grep -rnE 'font-weight:\s*(700|bold)|weight.*700' src/` → no
matches (if this ever matches, STOP — someone started using 700).

**Verify**: `npm run build` exits 0, and
`grep -rn 'inter-latin-700' .vercel/output/static/ --include='*.css'` → no matches.

### Step 4: Add 404.astro

Create `src/pages/404.astro` following the imprint page's structure exactly
(same Layout/Nav/Footer wrapping, same `.backlink` pattern):

```astro
---
import Layout from '../layouts/Layout.astro';
import Nav from '../components/Nav.astro';
import Footer from '../components/Footer.astro';
---

<Layout title="Not found - Johannes Homeier" description="This page does not exist." noindex>
  <div class="site">
    <Nav />
    <main>
      <div class="page wrap">
        <h1>Nothing here</h1>
        <p>This page doesn&rsquo;t exist (anymore). <a href="/">Back to the start</a>.</p>
      </div>
    </main>
    <Footer />
  </div>
</Layout>
```

**Verify**: after `npm run build`, `test -f .vercel/output/static/404.html`
→ exists (the Vercel adapter picks up `404.html` automatically).

### Step 5: Align the sitemap with the built canonicals

1. Build: `npm run build`.
2. Extract the canonical the build actually emitted:
   `grep -o '<link rel="canonical"[^>]*>' .vercel/output/static/imprint/index.html`
3. Edit `public/sitemap.xml` so the imprint/privacy `<loc>` values character-
   for-character match the canonical hrefs from step 2 (whichever slash form
   that is). The home entry stays `https://johanneshomeier.com/`.
4. Rebuild so the copied `public/` file in the output is fresh.

**Verify**:
`grep -o 'href="[^"]*"' <(grep -o '<link rel="canonical"[^>]*>' .vercel/output/static/imprint/index.html)`
and `grep imprint public/sitemap.xml` show the same URL.

## Test plan

No unit tests — these are build-output assertions, all encoded as the step
verifications above (grep gates against `.vercel/output/static/`). If plan
001 has landed, also run `npm run test` to confirm nothing else moved.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -rn 'hello@' src/data/seo.ts` → no matches
- [ ] `grep -c '#FFFFFF' public/site.webmanifest` → 2
- [ ] `grep -n 'latin-700' src/layouts/Layout.astro` → no matches
- [ ] `.vercel/output/static/404.html` exists after build
- [ ] Sitemap imprint/privacy `<loc>` values equal the built canonical hrefs
- [ ] `npm run build` exits 0 (and `npm run check` + `npm run test` if plan 001 landed)
- [ ] `git status --porcelain` shows changes ONLY in the in-scope files
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The step-3 pre-check finds a real use of weight 700.
- The build output directory is not `.vercel/output/static/` (adapter change
  from plan 002 may have altered paths — locate the static output first with
  `find .vercel -name 'index.html' -maxdepth 4`, and report if absent).
- The built canonical for `/imprint` differs from BOTH slash forms in a way
  the sitemap can't simply mirror (e.g. missing canonical entirely).
- Anything requires touching `Email.astro`, `legal.ts`, or the Layout OG
  block.

## Maintenance notes

- Schema.org consumers lose the `email` property on `Person`; contact
  discovery for humans is unaffected (imprint + contact form). If the owner
  ever wants machine-readable contact back, a `ContactPoint` with a contact
  *form* URL (not an email) is the harvest-safe pattern.
- `theme-color` still follows the OS scheme, not the manual in-page toggle.
  If that polish is wanted later, ThemeToggle would update the meta tags on
  change — deferred because it touches a React island for a cosmetic gain.
- After plan 002 lands, consider replacing the hand-maintained sitemap with
  `@astrojs/sitemap` (was deliberately not done here to avoid new deps on
  the old major).
- Reviewers: confirm the 404 page uses `noindex` and that no OG/JSON-LD
  markup moved in Layout.astro.
