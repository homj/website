# Plan 001: Establish a verification baseline (typecheck, tests, CI, CLAUDE.md)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 762e2c2..HEAD -- package.json tsconfig.json src/pages/api/contact.ts scripts/gen-assets.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests / dx
- **Planned at**: commit `762e2c2`, 2026-07-12

## Why this matters

This repo has **no way to know it works**: `package.json` has only `dev`,
`build`, `preview` scripts — no typecheck, no tests, no lint, and there is no
CI (no `.github/` directory exists). Every other plan in `plans/` needs a
verification gate to land safely, and the riskiest code in the repo — the
contact endpoint that validates user input, sends email via Resend, and writes
to Postgres — has zero coverage. This plan adds `astro check` (typecheck),
Vitest with unit tests for the contact endpoint, a GitHub Actions CI workflow,
and a `CLAUDE.md` so future agent sessions know the commands. It also fixes an
undeclared dependency: `scripts/gen-assets.mjs` imports `sharp`, which is only
present transitively (astro declares `sharp ^0.33.3` as an optional dep) — it
must be a declared devDependency.

## Current state

- `package.json` — scripts are only `dev` / `build` / `preview`; devDependencies
  are `@types/react`, `@types/react-dom`, `satori` (no `sharp`, no `typescript`,
  no `@astrojs/check`, no test runner). `"engines": { "node": "20.x" }`.
- `tsconfig.json` — extends `astro/tsconfigs/strict` with react-jsx. Full file:

  ```json
  {
    "extends": "astro/tsconfigs/strict",
    "compilerOptions": {
      "jsx": "react-jsx",
      "jsxImportSource": "react"
    }
  }
  ```

- `src/pages/api/contact.ts` — the only server route (Astro `APIRoute`,
  `export const prerender = false`). Structure (excerpts, `file:line` as of
  the planned-at commit):
  - `contact.ts:12-15` — `env(key)` helper reading `process.env` falling back
    to `import.meta.env`.
  - `contact.ts:17-20` — constants:
    ```ts
    const MAX_LEN = 5000;
    const EMAIL_MAX = 254; // RFC 5321 max length of an email address
    // Reject empty domain labels (e.g. `a@b..com`) and require at least one dot.
    const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
    ```
  - `contact.ts:27-36` — `clean(input, keepNewlines)` strips control chars
    (keeps `\n\r\t` in notes), trims.
  - `contact.ts:44-102` — `POST` handler: parse JSON → validate note/email →
    optional Friendly Captcha verify (only when `FRIENDLY_CAPTCHA_API_KEY` set)
    → `Promise.all([storeNote, sendEmail])` → 200 if either sink succeeded,
    502 if both failed, 500 if neither is configured.
  - None of `clean`, `EMAIL_RE`, `MAX_LEN` are exported today.
- `scripts/gen-assets.mjs:7` — `import sharp from 'sharp';` (undeclared).
- There is no `README.md`, no `CLAUDE.md`, no `.github/` directory.
- Repo conventions: 2-space indent, single quotes, semicolons, explanatory
  block comments above functions (see `src/pages/api/contact.ts` — match it).

## Commands you will need

| Purpose   | Command             | Expected on success            |
|-----------|---------------------|--------------------------------|
| Install   | `npm install`       | exit 0                         |
| Build     | `npm run build`     | exit 0, output in `.vercel/`   |
| Typecheck | `npm run check`     | (created in step 2) 0 errors   |
| Tests     | `npm run test`      | (created in step 3) all pass   |

## Scope

**In scope** (the only files you should modify/create):
- `package.json` (scripts + devDependencies)
- `package-lock.json` (via npm, never by hand)
- `src/components/ui.tsx` (ONLY the one-line handler-signature fix in step 2b — no other change)
- `src/pages/api/contact.ts` (ONLY the export-keyword changes in step 3 — no behavior change)
- `src/pages/api/contact.test.ts` (create)
- `.github/workflows/ci.yml` (create)
- `CLAUDE.md` (create)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- Any other file in `src/` — no refactors, no lint fixes, no style changes.
- `.env.example`, `astro.config.mjs`, anything in `public/`.
- Do not add ESLint/Prettier — the repo has no lint config by choice; adding
  one is a separate decision.
- Do not upgrade `astro` or any existing dependency version (that is plan 002).

## Git workflow

- Branch: `advisor/001-verification-baseline` off the current default branch,
  unless the operator told you to work on an existing branch.
- Commit style (match `git log`): short imperative summary line, e.g.
  `Add typecheck, contact-endpoint tests, and CI baseline`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Declare the missing and new devDependencies

Run:

```
npm install --save-dev sharp@^0.33.3 typescript @astrojs/check@^0.9 vitest@^2
```

`sharp@^0.33.3` matches the range astro itself declares, so no second copy is
installed. `@astrojs/check@^0.9` and `vitest@^2` are the lines compatible with
Astro 4 / Vite 5 (this repo is on astro 4.16 until plan 002 lands — do not
install vitest 3 or check 0.10+ without verifying peer ranges resolve).

**Verify**: `npm ls sharp typescript @astrojs/check vitest` → all four listed,
exit 0, no `UNMET` entries.

### Step 2: Add `check` and `test` scripts

In `package.json`, extend `scripts`:

```json
"scripts": {
  "dev": "astro dev",
  "build": "astro build",
  "preview": "astro preview",
  "check": "astro check",
  "test": "vitest run"
}
```

**Verify**: `npm run check` → exits 0 with `0 errors` — EXCEPT the one known
pre-existing error fixed in step 2b. Expected on first run: exactly 1 error at
`src/components/ui.tsx:237` (`onFocus={move}` — FocusEventHandler mismatch).
Any OTHER error triggers the STOP condition.

### Step 2b: Fix the one pre-existing typecheck error (scoped, one line)

`astro check` has never run on this repo; it surfaces exactly one strict-mode
error. In `src/components/ui.tsx:182`, the `RowList` handler is declared:

```ts
const move = (e: React.MouseEvent) => {
```

but it is wired to both `onMouseOver={move}` and `onFocus={move}` (ui.tsx:237).
The body only reads `e.target`, so widen the parameter type — this satisfies
both handler props under TypeScript's contravariant handler checking:

```ts
const move = (e: React.SyntheticEvent<HTMLDivElement>) => {
```

Change ONLY that parameter type. Do not touch anything else in ui.tsx.

**Verify**: `npm run check` → exits 0, `0 errors`;
`git diff src/components/ui.tsx` shows exactly one changed line.

### Step 3: Export the contact validation internals (no behavior change)

In `src/pages/api/contact.ts`, add the `export` keyword to the existing
declarations of `clean` and the `EMAIL_RE` / `MAX_LEN` / `EMAIL_MAX` constants
(lines 17-36 area). Do not move, rename, or otherwise alter them. Example for
one of them:

```ts
export const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
```

**Verify**: `npm run check` → still 0 errors; `git diff src/pages/api/contact.ts`
shows only added `export ` keywords.

### Step 4: Write the contact endpoint tests

Create `src/pages/api/contact.test.ts`. There are no existing tests to model
after; use plain Vitest style (`describe`/`it`/`expect`), 2-space indent,
single quotes. Cover, at minimum:

1. `clean()`: strips NUL and other control characters; keeps `\n` and `\t`
   when `keepNewlines` is true and strips them when false; trims surrounding
   whitespace; passes ordinary Unicode (e.g. Japanese) through unchanged.
2. `EMAIL_RE`: accepts `a@b.co`, `first.last+tag@sub.domain.org`; rejects
   spaces, missing `@`, missing dot (`a@b`), empty labels (`a@b..com`),
   and a string longer than `EMAIL_MAX` is rejected by length check (test the
   constant equals 254 rather than re-implementing the handler).
3. `POST` handler behavior via direct invocation. Import `{ POST }` and call
   it with a minimal context object: `POST({ request } as any)` where
   `request = new Request('http://localhost/api/contact', { method: 'POST', body, headers })`.
   - With no `RESEND_API_KEY`/`POSTGRES_URL` env vars set → 500 with
     `{ error: 'Contact is not configured.' }`.
   - Set `process.env.RESEND_API_KEY = 'test-key'` (a fake value, in the test
     only) and mock the SDK: `vi.mock('resend', ...)` so `emails.send` resolves
     `{ error: null }`. Then: empty body → 400 `Invalid request body.`;
     `{ note: '' }` → 400 `Note cannot be empty.`; note longer than `MAX_LEN`
     → 400; `{ note: 'hi', email: 'not-an-email' }` → 400; valid
     `{ note: 'hi' }` → 200 `{ ok: true }`.
   - With `process.env.FRIENDLY_CAPTCHA_API_KEY = 'test'` set and no
     `frcCaptchaResponse` in the body → 400 `Captcha verification is required.`
     (also stub `global.fetch` with `vi.stubGlobal` so no network call can
     escape if the guard ever regresses).
   - Reset env and mocks between tests (`vi.unstubAllGlobals()`,
     `vi.resetModules()`, save/restore `process.env`). Note: `schemaReady` and
     module state are cached per import — use `vi.resetModules()` +
     dynamic `await import('./contact')` per test group if state bleeds.

Do NOT test `storeNote`/`ensureSchema` against a real database, and do not add
a Postgres test container — mock `@neondatabase/serverless` if a test needs
the DB path (e.g. 502 when both sinks fail: mock `neon` to throw and Resend to
return an error).

**Verify**: `npm run test` → all tests pass, ≥ 12 tests.

### Step 5: Add the CI workflow

Create `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run check
      - run: npm run test
      - run: npm run build
```

Use `node-version: 20` now; plan 002 bumps it together with `engines`.

**Verify**: `npx yaml-lint .github/workflows/ci.yml 2>/dev/null || node -e "require('js-yaml')"` —
if neither tool is available, verify by eye that indentation matches the block
above exactly; the real gate is CI's first run.

### Step 6: Write CLAUDE.md

Create `CLAUDE.md` at the repo root with exactly this outline (fill the
bracketed parts from the repo, keep it under ~60 lines):

```markdown
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
```

**Verify**: `test -f CLAUDE.md && head -3 CLAUDE.md` → shows the title line.

## Test plan

Covered by step 4 (the tests ARE the deliverable). Final check that the suite
guards the right things: temporarily change `EMAIL_RE` to `/^.*$/` locally,
run `npm run test`, confirm at least one test fails, revert.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run check` exits 0
- [ ] `npm run test` exits 0 with ≥ 12 passing tests
- [ ] `npm run build` exits 0
- [ ] `node -e "const p=require('./package.json'); if(!p.devDependencies.sharp) process.exit(1)"` exits 0
- [ ] `git diff 762e2c2..HEAD --stat -- src/` touches ONLY `src/pages/api/contact.ts`, `src/pages/api/contact.test.ts`, and `src/components/ui.tsx` (one line, step 2b)
- [ ] `.github/workflows/ci.yml` and `CLAUDE.md` exist
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `npm run check` reports type errors you did not introduce and the fix would
  require changing any file outside the in-scope list. Report the error list
  verbatim instead of fixing.
- `vitest` cannot import `src/pages/api/contact.ts` (e.g. `astro:*` module
  resolution errors). Do not add a vite config workaround beyond a minimal
  `vitest.config.ts` with `test: { environment: 'node' }`; if that doesn't
  resolve it, report.
- Installing the devDependencies changes the resolved version of `astro`,
  `react`, or any production dependency (check `git diff package-lock.json`
  for unexpected version bumps of prod deps).
- Any test requires network access to pass.

## Maintenance notes

- Plan 002 (Astro upgrade) will bump `@astrojs/check`, `vitest`, and the CI
  node-version; the test file's mocks of `resend`/`@neondatabase/serverless`
  should survive unchanged.
- Reviewers: scrutinize that step 3 added `export` keywords only — any other
  diff in contact.ts is out of scope for this plan.
- Deferred deliberately: ESLint/Prettier (owner has no lint config; a
  formatting sweep would pollute blame), Playwright/E2E (overkill for a
  3-page site; the vitest handler tests cover the only logic).
