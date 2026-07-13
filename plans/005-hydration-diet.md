# Plan 005: Hydrate only what's interactive — shrink the home page's single client:load island and delete dead client code

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 762e2c2..HEAD -- src/components/ src/pages/index.astro`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED
- **Depends on**: plans/001-verification-baseline.md; STRONGLY recommended
  after plans/002-astro-security-upgrade.md (restructure islands once, on the
  current framework)
- **Category**: perf / tech-debt
- **Planned at**: commit `762e2c2`, 2026-07-12

## Why this matters

The entire home page is one React island: `index.astro` mounts
`<HomeMain client:load />`, which renders **everything** — intro paragraphs,
projects, experience bios, the personal section, and the contact form. All of
that prose ships twice (HTML + the JS to rehydrate it) and hydrates on load,
though only three things on the page are interactive: the Experience
accordion + row-highlight, the Contact form, and the theme toggle. The bundle
also carries provably dead code: a `DotField` canvas animation and three
other hero variants that can never render (the hero style is hardcoded to
`'whitespace'`), a `Rail` sidebar that is permanently hidden by CSS, and
React `Nav`/`Footer` components that duplicate the `.astro` ones actually in
use. For a site whose owner's pitch is performance-conscious product
engineering, time-to-interactive and shipped bytes are part of the brand.

## Current state

Files and the facts you need (verify each excerpt before editing):

- `src/pages/index.astro:13` — `<HomeMain client:load />` inside
  `<div class="site"><Nav /><main>…</main><Footer /></div>`.
- `src/components/HomeMain.tsx` — 8 lines; just re-exports
  `<Home heroStyle="whitespace" />`.
- `src/components/sections.tsx` (476 lines) — exports:
  - `DotField` (lines 6–87): canvas + rAF + MutationObserver + global
    pointermove listener. **Dead**: only reachable via `Hero style="dots"`.
  - `Hero` (95–125): five style branches; the site only ever passes
    `'whitespace'`, which renders `<div className="hero-space" aria-hidden="true" />`.
  - `Greeting`, `Signature` (132–158): static output (CSS picks the daypart
    variant; no hooks).
  - `Rail` (162–177): **always rendered, never visible** — `.home-rail` is
    `display: none` unless `<html data-layout="sidebar">`, and Layout.astro
    hardcodes `data-layout="stacked"`.
  - `Personal` (181–206), `Projects` (210–227): static content; `Projects`
    uses `RowList` (hover highlight = JS).
  - `Experience` (231–290): `useState` accordion — genuinely interactive.
  - `Contact` (299–438): form state + lazy Friendly Captcha — genuinely
    interactive.
  - `Home` (446–475): composes all of the above.
- `src/components/ui.tsx` (335 lines) — exports `Icon`, `Ext`, `SOCIALS`,
  `useTheme`, `ThemeMenu`, `Nav`, `RowList`, `ExpRow`, `ProjRow`, `Footer`.
  - `Nav` (158–169) and `Footer` (320–335): **dead** — the site uses
    `Nav.astro`/`Footer.astro`. `SOCIALS` (53–57) is duplicated in
    `Footer.astro:2-6`.
  - `Ext` (43–51): currently unused by any caller — confirm with
    `grep -rn '<Ext' src/` before deleting.
  - `RowList` (177–243): imperative highlight; used by `Projects` and
    `Experience`.
- `src/components/ThemeToggle.tsx` — separate `client:only="react"` island in
  `Nav.astro`; NOT in scope to change.
- Astro fact the restructure relies on: a framework component rendered
  **without** a `client:` directive is server-rendered to plain HTML with
  zero client JS. So the split can keep the React components as-is and just
  move the `client:` boundary — no .astro rewrite needed.

## Commands you will need

| Purpose   | Command          | Expected on success |
|-----------|------------------|---------------------|
| Install   | `npm install`    | exit 0              |
| Typecheck | `npm run check`  | 0 errors            |
| Tests     | `npm run test`   | all pass            |
| Build     | `npm run build`  | exit 0              |
| Dev       | `npm run dev`    | serves localhost:4321 |

## Scope

**In scope** (the only files you should modify/delete/create):
- `src/pages/index.astro`
- `src/components/HomeMain.tsx` (likely deleted)
- `src/components/sections.tsx`
- `src/components/ui.tsx`
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- `src/components/ThemeToggle.tsx` / `Nav.astro` / `Footer.astro` /
  `Email.astro` — the theme island stays React (a vanilla rewrite is a
  deferred follow-up, see maintenance notes).
- ALL CSS files — this plan removes no CSS. Unused-CSS cleanup is a separate
  decision recorded in plans/README.md (the owner may still want the design
  variants). The markup you keep must keep its class names so styling is
  unchanged.
- `src/pages/api/contact.ts` and its tests.
- The rendered CONTENT: every visible word, link, and section order must
  survive identically.

## Git workflow

- Branch: `advisor/005-hydration-diet`
- Commit per step (deletions separate from the island split — reviewable).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Delete dead client code

1. In `sections.tsx`: delete `DotField` and the `Hero` component entirely;
   in `Home`, replace `<Hero style={heroStyle || 'whitespace'} />` with
   `<div className="hero-space" aria-hidden="true" />` and drop the
   `heroStyle` prop/`HomeProps` plumbing. Delete `Rail` and its usage.
2. In `ui.tsx`: delete the `Nav` and `Footer` components. Run
   `grep -rn '<Ext' src/` — if no matches, delete `Ext` too. Keep `SOCIALS`
   ONLY if something in `src/` still imports it after the deletions
   (`grep -rn 'SOCIALS' src/`); if only `Footer.astro`'s own local copy
   remains, delete the ui.tsx export.
3. `grep -rn 'hero-dots\|DotField\|home-rail' src/components/` → no matches.

**Verify**: `npm run check` → 0 errors; `npm run dev` + open `/` — page looks
identical (hero whitespace block still present via the static div).

### Step 2: Move the hydration boundary

1. In `sections.tsx`, export two composition components in place of `Home`:
   - `HomeStatic` — everything ABOVE the interactive sections: the
     `page wrap` / `home` / `home-main` divs, sr-only h1, intro paragraphs
     with `Greeting`/`Signature`, the hero-space div… **stopping before
     `<Projects />`**.
   - Keep `Projects`, `Experience`, `Contact` exported as they are.
2. Rework `src/pages/index.astro` to compose the page with the SAME DOM
   structure and class nesting as today's `Home` output (the wrapper divs
   move into index.astro or HomeStatic — your choice, but the rendered tree
   must match: `.page.wrap > .home > .home-main > [h1, .measure.intro,
   .hero-space, sections]`):

   ```astro
   <Layout jsonLd={homeJsonLd}>
     <div class="site">
       <Nav />
       <main>
         <HomeStatic />            <!-- no client: directive → zero JS -->
         <!-- inside the same .home-main container: -->
         <Work client:visible />   <!-- Projects + Experience, one island -->
         <Personal />              <!-- no directive → zero JS -->
         <Contact client:visible />
       </main>
       <Footer />
     </div>
   </Layout>
   ```

   Notes:
   - `Projects` + `Experience` share the RowList highlight pattern; wrap them
     in one small `Work` component (new, in sections.tsx) so they ship as one
     island. `Personal` is pure static — render it with no directive.
   - Getting the wrappers right matters more than the exact file layout:
     compare `npm run dev` DOM against the pre-change DOM (save
     `curl -s localhost:4321/ > /tmp/before.html` BEFORE starting step 2,
     and diff the body structure after).
   - `client:visible` is correct for below-the-fold sections; if the
     Experience section sits in the initial viewport on desktop, prefer
     `client:load` for `Work` and note it.
3. Delete `HomeMain.tsx` and the now-unused `Home` composition if nothing
   imports them.

**Verify**: `npm run check` → 0; `npm run test` → pass; visual + behavior
check in `npm run dev`: accordion toggles, row highlight follows hover,
contact form reveals email field on Continue, theme toggle still works,
greeting variant renders.

### Step 3: Confirm the payload actually shrank

```
npm run build
grep -c 'astro-island' .vercel/output/static/index.html
```

Expected: exactly **3** islands on the home page (ThemeToggle, Work,
Contact) — down from 2 mega-islands (HomeMain + ThemeToggle), with the new
ones far smaller. Then:

```
grep -rln 'hero-dots\|getContext' .vercel/output/static/_astro/*.js | wc -l   # expect 0 (no canvas code shipped)
du -sh dist 2>/dev/null || du -sh .vercel/output/static/_astro
```

Record the before/after total of `_astro/*.js` bytes in your report (build
once on the pre-change commit if you didn't capture it).

**Verify**: island count = 3; canvas grep = 0; JS bytes decreased.

## Test plan

- Plan-001's suite must pass unmodified (`npm run test`).
- No new unit tests required; the deliverable gates are the island count,
  the dead-code greps, and the DOM-structure diff from step 2.
- Manual checklist (run in `npm run dev`, record each): accordion
  open/close on all five rows; hover highlight on projects AND experience;
  contact happy path up to the captcha message with no sitekey configured;
  keyboard Tab order unchanged through the page.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run check`, `npm run test`, `npm run build` all exit 0
- [ ] `grep -c 'astro-island' .vercel/output/static/index.html` → 3
- [ ] `grep -rn 'DotField\|heroStyle\|home-rail' src/` → no matches
- [ ] `grep -rn 'export function Nav\|export function Footer' src/components/ui.tsx` → no matches
- [ ] Every visible string from the old page appears in the new built HTML
      (spot-check: 'Good morning', 'siteboard', 'Infineon', 'Leave me a note')
- [ ] No CSS file modified (`git diff --stat -- src/styles/` empty)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The DOM-structure diff in step 2 shows the wrapper nesting can't be
  reproduced without changing CSS — do not edit CSS; report the mismatch.
- Hydration warnings appear in the browser console after the split.
- The RowList highlight breaks when Projects and Experience are hydrated
  together (offsetParent assumptions — see the comment at
  `src/styles/site.css:258-261`); report rather than restyling.
- `client:visible` causes a visible flash/layout shift on the accordion.
- Anything tempts you to "also" remove now-unused CSS — out of scope.

## Maintenance notes

- Deferred follow-ups, in order of value: (1) replace the React ThemeToggle
  island with a ~40-line vanilla inline script (removes React entirely from
  /imprint and /privacy); (2) unused-CSS cleanup once the owner decides
  whether the design variants (moods/palettes/sidebar) have a future — see
  the direction findings in plans/README.md; (3) full CSP (plan 003
  deferred it partly because of inline scripts this plan doesn't touch).
- Reviewers: diff the built index.html body against the previous deploy's —
  content and class structure should be identical modulo island wrappers.
- If a future section needs interactivity, prefer a new small island over
  re-growing a page-wide one.
