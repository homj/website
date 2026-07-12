# Plan 002: Upgrade Astro past the SSRF advisory (4.16 → ≥6.4.6, target 7.x) and retire Node 20

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 762e2c2..HEAD -- package.json astro.config.mjs tsconfig.json src/ .github/workflows/ci.yml`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition. (Plan 001 legitimately adds
> scripts/devDeps to package.json and a test file — that drift is expected.)

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: plans/001-verification-baseline.md
- **Category**: security / migration
- **Planned at**: commit `762e2c2`, 2026-07-12

## Why this matters

The site runs astro 4.16.19. `npm audit` flags it HIGH for
**CVE-2026-54299 / GHSA-2pvr-wf23-7pc7** ("Host header SSRF in prerendered
error page fetch"), which is **patched only in astro ≥ 6.4.6 — there is no
4.x or 5.x backport**. This site deploys server-side code (the
`/api/contact` serverless function via `output: 'hybrid'`), so the vulnerable
SSR request path is live in production, not just a dev-time concern. On top of
that, `"engines": { "node": "20.x" }` pins a Node line that reached
end-of-life on 2026-04-30 and stopped receiving security fixes. This plan
moves the stack to the current majors (astro 7.x line, minimum acceptable
6.4.6), the matching `@astrojs/vercel` and `@astrojs/react` integrations, and
Node 22.

## Current state

- `package.json` (prod deps): `astro ^4.16.0`, `@astrojs/react ^3.6.0`,
  `@astrojs/vercel ^7.8.2`, `react`/`react-dom` `^18.3.1`, `resend ^4.8.0`,
  `@neondatabase/serverless ^1.1.0`, `@fontsource/inter ^5.2.8`,
  `@friendlycaptcha/sdk ^1.0.0`, `@vercel/analytics ^2.0.1`,
  `@vercel/speed-insights ^2.0.0`. `"engines": { "node": "20.x" }`.
- `astro.config.mjs` — full current contents:

  ```js
  import { defineConfig } from 'astro/config';
  import react from '@astrojs/react';
  import vercel from '@astrojs/vercel/serverless';

  export default defineConfig({
    site: 'https://johanneshomeier.com',
    integrations: [react()],
    // hybrid keeps every page static and prerendered; only routes that opt out
    // with `export const prerender = false` (the /api/contact endpoint) run
    // server-side as Vercel serverless functions.
    output: 'hybrid',
    adapter: vercel(),
  });
  ```

- `src/pages/api/contact.ts:6` — `export const prerender = false;` (the only
  non-prerendered route; everything else is static).
- React usage is plain function components + `useState`/`useEffect`/`useRef`/
  `useCallback` (`src/components/sections.tsx`, `ui.tsx`, `ThemeToggle.tsx`) —
  no legacy APIs, no class components, no `defaultProps`.
- `src/components/Email.astro:17-19` — renders the email address as multiple
  `<span>` fragments with literal `&#64;` / `&#46;` text nodes between them,
  then a script joins `textContent`. **Whitespace between inline elements is
  load-bearing here** (see step 6 — Astro 7 changes HTML whitespace
  compression).
- `src/components/sections.tsx:151-158` — the Japanese signature uses
  `<ruby>` markup and adjacent inline text nodes; same whitespace concern.
- Known breaking changes that apply to THIS repo:
  - **Astro 5**: `output: 'hybrid'` was removed. The default `'static'` plus
    an adapter now does exactly what hybrid did: pages prerender, routes with
    `export const prerender = false` become serverless functions. Fix: delete
    the `output` line (or set `output: 'static'`) and update the comment.
  - **@astrojs/vercel ≥ 8**: the `'@astrojs/vercel/serverless'` entry point
    was removed → import from `'@astrojs/vercel'`.
  - **Astro 7**: Rust-based compiler is stricter about invalid HTML and no
    longer "corrects" it; HTML whitespace compression defaults to a JSX-style
    mode that strips whitespace between inline elements.
  - **@astrojs/react 6 / react 19**: expect `npx @astrojs/upgrade` to propose
    React 19; this repo's React code is 19-compatible as written.
- Verification harness from plan 001: `npm run check`, `npm run test`,
  `npm run build`, CI at `.github/workflows/ci.yml`.

## Commands you will need

| Purpose   | Command                                  | Expected on success                  |
|-----------|------------------------------------------|--------------------------------------|
| Upgrade   | `npx @astrojs/upgrade`                    | updates astro + integrations         |
| Install   | `npm install`                             | exit 0                               |
| Typecheck | `npm run check`                           | 0 errors                             |
| Tests     | `npm run test`                            | all pass                             |
| Build     | `npm run build`                           | exit 0                               |
| Audit     | `npm audit --audit-level=high`            | no high/critical advisories          |
| Preview   | `npm run preview` (then curl, see step 7) | serves the built site                |

## Scope

**In scope** (the only files you should modify):
- `package.json`, `package-lock.json`
- `astro.config.mjs`
- `tsconfig.json` and `src/env.d.ts` (only if `astro check`/`astro sync`
  direct it — newer Astro manages generated types differently)
- `.github/workflows/ci.yml` (node-version bump)
- `@types/react` / `@types/react-dom` versions (must match the React major)
- Minimal mechanical fixes in `src/` files that the upgrade itself forces
  (changed import paths or types) — each such fix must be traceable to a
  compiler/build error you quote in your report
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- Any behavioral change to `src/pages/api/contact.ts` (hardening is plan 003).
- Any markup/CSS/content change beyond what a build error forces.
- `resend` major bump (4→6): NOT part of this plan — its breaking changes are
  SDK-surface, unrelated to the security driver. Leave `resend ^4.8.0`.
- Vercel dashboard settings (note them in the report instead — see step 8).

## Git workflow

- Branch: `advisor/002-astro-upgrade`
- Commit per logical unit (e.g. one commit for the upgrade + config, one for
  mechanical fixes). Message style matches `git log`: short imperative summary.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Record the pre-upgrade baseline

Run `npm run check && npm run test && npm run build` on the unmodified branch
and save the output. If any of these fail BEFORE you change anything, STOP —
plan 001 has not landed or has regressed.

**Verify**: all three exit 0.

### Step 2: Run the official upgrader

```
npx @astrojs/upgrade
```

Accept the latest stable astro (7.x) and the matching `@astrojs/react` and
`@astrojs/vercel` versions it proposes. If it proposes React 19, accept and
also bump `@types/react`/`@types/react-dom` to the matching majors. Then
`npm install`.

**Verify**: `npm ls astro` shows a version ≥ 6.4.6 (target: 7.x);
`npm ls react react-dom @types/react` shows a consistent React major.

### Step 3: Fix astro.config.mjs

Apply both known changes:

```js
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://johanneshomeier.com',
  integrations: [react()],
  // Default 'static' output prerenders every page; the /api/contact route
  // opts out with `export const prerender = false` and runs as a Vercel
  // serverless function (this replaced Astro 4's `output: 'hybrid'`).
  adapter: vercel(),
});
```

**Verify**: `npm run build` proceeds past config loading (it may still fail on
later steps — that's what steps 4–6 are for).

### Step 4: Regenerate types and fix compiler-forced diffs

Run `npx astro sync`, then `npm run check`. Fix ONLY what errors point at
(e.g. `src/env.d.ts` reference lines, changed `APIRoute` generics). Keep a
list of every file you touch and why.

**Verify**: `npm run check` → 0 errors.

### Step 5: Bump Node

- `package.json`: `"engines": { "node": "22.x" }`
- `.github/workflows/ci.yml`: `node-version: 22`

**Verify**: `grep -n '"node"' package.json` → `22.x`; `grep -n 'node-version' .github/workflows/ci.yml` → `22`.

### Step 6: Build and inspect the whitespace-sensitive output

```
npm run build
```

Then inspect the built HTML (Vercel adapter output lives under
`.vercel/output/static/`):

1. `grep -o 'data-email[^<]*<span>[^<]*</span>[^<]*' .vercel/output/static/imprint/index.html | head -2`
   — the obfuscated email must still render as
   `user`&#64;`label.label` pieces with NO whitespace inserted or meaningful
   text nodes dropped. Extract the visible text of the `a[data-email]` element
   and confirm that removing whitespace yields exactly `hello@johanneshomeier.com`.
2. Confirm the Japanese signature block in `.vercel/output/static/index.html`
   still contains the `<ruby>僕<rt>ぼく</rt></ruby>` sequence intact.
3. Confirm exactly one serverless function was emitted for the contact route:
   `ls .vercel/output/functions/` → contains a `_render` or api-scoped
   function directory (record the actual name in your report).

**Verify**: all three checks pass. If check 1 or 2 shows mangled text, see
STOP conditions (compressHTML).

### Step 7: Runtime smoke test

```
npm run preview &
sleep 3
curl -s http://localhost:4321/ | grep -c 'Johannes'          # expect ≥ 1
curl -s -o /dev/null -w '%{http_code}' http://localhost:4321/imprint   # expect 200
curl -s -X POST http://localhost:4321/api/contact -H 'Content-Type: application/json' -d '{}'   # expect {"error":"Contact is not configured."} or a 400/500 JSON error — NOT a stack trace or HTML
kill %1
```

(If `astro preview` is unsupported by the Vercel adapter in the installed
major, use `npm run dev` for this smoke test instead and say so in the report.)

**Verify**: responses as annotated; the API route returns JSON.

### Step 8: Close the audit finding

```
npm audit --audit-level=high
```

**Verify**: zero high/critical advisories. (Moderate advisories in transitive
dev-time deps may remain; list them in the report.) Then run the full gate:
`npm run check && npm run test && npm run build` → all exit 0.

Report (do not perform) the deployment follow-ups for the operator:
- Set the Vercel project's Node.js version to 22 in dashboard settings.
- After the first production deploy, confirm `/api/contact` works once end-to-end.

## Test plan

No new tests. The plan-001 suite must pass unmodified — those tests pin the
contact endpoint's behavior across the framework swap. If a test fails, the
upgrade changed observable behavior: treat as a STOP condition, not a test to
"fix".

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm ls astro` → version ≥ 6.4.6
- [ ] `npm audit --audit-level=high` → 0 findings
- [ ] `npm run check` exits 0
- [ ] `npm run test` exits 0 (same tests as before the upgrade, unmodified)
- [ ] `npm run build` exits 0
- [ ] `grep -c "output: 'hybrid'" astro.config.mjs` → 0
- [ ] `grep -c '@astrojs/vercel/serverless' astro.config.mjs` → 0
- [ ] `package.json` engines is `22.x`; CI node-version is 22
- [ ] Step 6's email + signature HTML checks pass
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Plan 001's gates fail on the unmodified branch (step 1).
- `npx @astrojs/upgrade` errors, or the peer-dependency solver forces a
  `resend` or `@neondatabase/serverless` major bump.
- Step 6 shows the obfuscated email or ruby signature rendered differently
  than in the 4.x build. Check whether the installed astro major exposes a
  `compressHTML` config option that restores the older whitespace behavior;
  if setting it doesn't fix the output, report with both HTML snippets —
  do NOT rewrite Email.astro or the signature markup in this plan.
- Any plan-001 test fails after the upgrade.
- `astro check` errors point into `node_modules` or generated files you can't
  fix by `astro sync` + the documented config changes.
- You find yourself editing more than ~5 `src/` files — the migration surface
  was estimated at config + types; larger churn means the estimate was wrong.

## Maintenance notes

- Plan 005 (hydration diet) should land AFTER this plan so islands are
  restructured once, on the current framework.
- Future: `resend` 4→6 and adopting `astro:env` for typed env vars are
  deliberate follow-ups, not blockers.
- Reviewers: scrutinize `package-lock.json` for unexpected prod-dep changes,
  and the step-6 HTML evidence in the executor's report.
- Watch the next `npm audit` runs: the js-yaml moderate advisory
  (GHSA-h67p-54hq-rp68) rode in via astro 4's markdown chain and should
  disappear with astro 7 (which drops the remark pipeline by default) —
  confirm rather than assume.
