# Plan 003: Harden /api/contact (origin check, rate limit, no-store) and add baseline security headers

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 762e2c2..HEAD -- src/pages/api/contact.ts src/pages/api/contact.test.ts vercel.json`
> If contact.ts changed since this plan was written (plan 001 adds `export`
> keywords — that drift is expected), compare the "Current state" excerpts
> against the live code before proceeding; on a mismatch beyond plan 001's
> exports, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/001-verification-baseline.md (test harness)
- **Category**: security
- **Planned at**: commit `762e2c2`, 2026-07-12

## Why this matters

`/api/contact` is the site's only state-changing endpoint: it sends email
through Resend and inserts rows into Postgres. Today it accepts a POST from
**any origin** (no `Origin` validation → cross-site request forgery is
possible; impact is spam email/DB rows, not data theft), has **no rate
limiting** (each request can cost a Resend send + a DB insert; the Friendly
Captcha gate only applies when its env var is configured), and returns
responses without `Cache-Control: no-store`. Separately, the site sets **no
security response headers at all** (there is no `vercel.json` in the repo):
no `X-Content-Type-Options`, no `Referrer-Policy`, no HSTS, no
`frame-ancestors`. These are cheap, no-breakage wins for a site whose owner
sells web-security auditing (siteboard).

## Current state

- `vercel.json` — **does not exist** (create it).
- `src/pages/api/contact.ts` — relevant excerpts at the planned-at commit:
  - `contact.ts:44-49` — handler entry:
    ```ts
    export const POST: APIRoute = async ({ request }) => {
      const resendKey = env('RESEND_API_KEY');
      const hasDb = !!dbUrl();
      if (!hasDb && !resendKey) {
        return json({ error: 'Contact is not configured.' }, 500);
      }
    ```
  - `contact.ts:75-88` — captcha gate, enforced only when
    `FRIENDLY_CAPTCHA_API_KEY` is set (this conditional skip is deliberate —
    keep it).
  - `contact.ts:178-183` — response helper:
    ```ts
    function json(data: unknown, status: number): Response {
      return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    ```
  - `contact.ts:12-15` — `env(key)` helper; use it for any new env reads.
- The client (`src/components/sections.tsx:359-367`) posts same-origin with
  `Content-Type: application/json` — browsers will always send an `Origin`
  header with this cross-origin-capable POST, so origin enforcement cannot
  break the real form.
- Conventions: explanatory block comments above functions, 2-space indent,
  single quotes (match the existing file).
- Test harness (from plan 001): `src/pages/api/contact.test.ts`, run with
  `npm run test`. Model new tests on its existing handler-invocation pattern
  (build a `Request`, call `POST({ request } as any)`, assert status + JSON).
- Deployment facts: Vercel serverless; client IP arrives in the
  `x-forwarded-for` header (first entry) on Vercel; `VERCEL_ENV` is
  `production` on prod deployments; the canonical site origin is
  `https://johanneshomeier.com`; preview deploys run on `*.vercel.app` hosts
  and their own origin is available at runtime as
  `https://${process.env.VERCEL_URL}`.

## Commands you will need

| Purpose   | Command          | Expected on success |
|-----------|------------------|---------------------|
| Install   | `npm install`    | exit 0              |
| Typecheck | `npm run check`  | 0 errors            |
| Tests     | `npm run test`   | all pass            |
| Build     | `npm run build`  | exit 0              |

## Scope

**In scope** (the only files you should modify/create):
- `src/pages/api/contact.ts`
- `src/pages/api/contact.test.ts`
- `vercel.json` (create)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- The captcha-optional behavior (deliberate for local dev — do not make the
  captcha mandatory).
- The validation logic (`clean`, `EMAIL_RE`, length checks) and the
  dual-sink `Promise.all` logic — no changes.
- `src/components/sections.tsx` (client) — no client changes are needed.
- A full `Content-Security-Policy` with `script-src` — the site has inline
  scripts (theme bootstrap in Layout.astro, JSON-LD, Email.astro) that would
  need hashes/nonces; that is explicitly deferred (see maintenance notes).
  Only the `frame-ancestors` directive is in scope.
- External rate-limit stores (Upstash/KV/WAF) — rejected for this plan; see
  maintenance notes.

## Git workflow

- Branch: `advisor/003-contact-hardening`
- Commit style: short imperative summary (match `git log`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add `Cache-Control: no-store` to all endpoint responses

In `contact.ts`, extend the `json()` helper's headers with
`'Cache-Control': 'no-store'`.

**Verify**: `npm run check` → 0 errors;
`grep -n 'no-store' src/pages/api/contact.ts` → 1 match inside `json()`.

### Step 2: Enforce same-origin posts

At the top of the `POST` handler (immediately after the
`'Contact is not configured.'` guard), add an origin check with this exact
policy, as a small helper function with a comment explaining it:

- Read `request.headers.get('origin')`.
- If the header is **absent**, allow (non-browser clients carry no CSRF risk;
  the captcha still gates them).
- If present, allow only when it equals the canonical origin
  (`https://johanneshomeier.com`) or the current deployment's own origin
  (`https://${env('VERCEL_URL')}` when `VERCEL_URL` is set — this keeps
  Vercel preview deployments working).
- Otherwise return `json({ error: 'Invalid request origin.' }, 403)`.

**Verify**: `npm run check` → 0 errors. Tests come in step 4.

### Step 3: Add a best-effort per-instance rate limit

Add a module-level limiter above the handler, with a comment stating its
honest scope (per serverless instance, resets on cold start — defense in
depth, not a hard guarantee):

- Key: client IP = first comma-separated entry of `x-forwarded-for`, else
  `'unknown'`.
- Policy: max **5 requests per 10 minutes** per key, sliding window is
  overkill — a fixed window `Map<string, { count: number; windowStart: number }>`
  is fine. On exceed: `json({ error: 'Too many requests. Please try again later.' }, 429)`.
- Prune stale entries opportunistically on each call (delete entries whose
  window expired) so the Map cannot grow unboundedly on a long-lived instance.
- Place the check **after** the origin check and **before** body parsing.

**Verify**: `npm run check` → 0 errors.

### Step 4: Extend the test suite

Add to `src/pages/api/contact.test.ts` (same mocking pattern as the existing
tests; use `vi.resetModules()` + dynamic import so the limiter's module state
is fresh per test):

1. Origin: request with `Origin: https://evil.example` → 403; with
   `Origin: https://johanneshomeier.com` → passes the origin gate (reaches
   validation, e.g. returns the empty-note 400); with no Origin header →
   passes the gate; with `VERCEL_URL=preview-abc.vercel.app` set and
   `Origin: https://preview-abc.vercel.app` → passes the gate.
2. Rate limit: 6 sequential valid-shaped requests from the same
   `x-forwarded-for` → the 6th returns 429; a request from a different IP in
   the same test still passes; a fresh module import resets the window.
3. `no-store`: any response's `Cache-Control` header equals `no-store`.

**Verify**: `npm run test` → all pass, including ≥ 7 new tests.

### Step 5: Create vercel.json with baseline headers

Create `vercel.json` at the repo root:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
        { "key": "Content-Security-Policy", "value": "frame-ancestors 'none'" }
      ]
    }
  ]
}
```

Do not add any other keys to vercel.json (no rewrites, no functions config).

**Verify**: `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('ok')"` → `ok`;
`npm run build` still exits 0.

## Test plan

Step 4 is the test plan: origin allow/deny matrix, rate-limit window
behavior, header assertion — modeled on the plan-001 handler tests. Full
suite green via `npm run test`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run check` exits 0
- [ ] `npm run test` exits 0, including the new origin/rate-limit/no-store tests
- [ ] `npm run build` exits 0
- [ ] `vercel.json` exists, parses as JSON, and contains exactly the 5 headers above
- [ ] `grep -c 'no-store' src/pages/api/contact.ts` ≥ 1
- [ ] `git status --porcelain` shows changes ONLY in the in-scope files
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The handler code at the cited lines doesn't match the excerpts beyond plan
  001's added `export` keywords (e.g. plan 002 landed first and reshaped the
  file) — re-verify line references before editing, and stop if the handler's
  control flow differs from "Current state".
- You find yourself wanting to change the captcha logic, the validation
  rules, or the client component — all out of scope.
- The rate-limit tests are flaky due to module-state bleed you cannot fix
  with `vi.resetModules()` — report rather than weakening assertions.
- Any evidence that `vercel.json` headers conflict with headers the
  @astrojs/vercel adapter already emits (build warning or documented
  conflict) — report which keys conflict.

## Maintenance notes

- **Deliberately deferred**: a full CSP with `script-src` hashes/nonces for
  the inline theme script, JSON-LD blocks, and Email.astro script. Revisit
  after plan 005 (which reduces inline-script surface). Until then,
  `frame-ancestors 'none'` covers clickjacking.
- **Deliberately rejected**: external rate-limit stores (Upstash/Vercel KV)
  — unjustified cost/complexity for this traffic. If contact spam becomes
  real, enable Vercel's WAF/firewall rules at the platform level instead of
  adding code.
- The per-instance limiter is weak against distributed abuse by design; the
  captcha remains the primary bot control. If `FRIENDLY_CAPTCHA_API_KEY` is
  ever unset in production, the endpoint is an unauthenticated email/DB-write
  primitive protected only by these new controls — the operator should keep
  the captcha configured in prod.
- Reviewers: check the origin-check order (before body parsing), the 403/429
  bodies match the site's error-message tone, and that no validation logic
  changed.
