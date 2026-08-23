import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

// Run on-demand as a serverless function rather than being prerendered.
export const prerender = false;

// Read env at request/runtime. Vercel injects vars into process.env per
// invocation; we fall back to import.meta.env for local `astro dev`. Reading
// import.meta.env directly would inline values at BUILD time and silently miss
// any var added to the project afterwards.
function env(key: string): string | undefined {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return proc?.env?.[key] ?? (import.meta.env as Record<string, string | undefined>)[key];
}

const MAX_LEN = 5000;
const EMAIL_MAX = 254; // RFC 5321 max length of an email address
// Reject empty domain labels (e.g. `a@b..com`) and require at least one dot.
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
const FRC_VERIFY_URL = 'https://global.frcapi.com/api/v2/captcha/siteverify';
const DEFAULT_FROM = 'Johannes Homeier <no-reply@johanneshomeier.com>';

// /openapi.json is served cross-origin readable and advertises this endpoint, so
// an agent can discover it from another origin. Without these the browser blocks
// the call it just learned how to make: a JSON body makes the POST non-simple, so
// it is preflighted, and the preflight needs its own answer (see OPTIONS below).
// Rate limiting. Deliberately in-memory rather than backed by the database: the
// only durable key would be the caller's IP, and storing that would be a new
// category of personal data on a site whose privacy policy says it stores none.
// A serverless instance is short-lived and there may be several, so this is a
// floor rather than a global guarantee - openapi.json says so plainly. The
// captcha remains the real abuse control; this exists so an agent reading the
// RateLimit headers is told something true.
const RATE_LIMIT = 10;             // requests per window, per instance
const RATE_WINDOW_MS = 60 * 60_000; // one hour
const hits = new Map<string, number[]>();

function rateLimit(ip: string): { allowed: boolean; remaining: number; reset: number } {
  const now = Date.now();
  const cutoff = now - RATE_WINDOW_MS;

  // Prune whole entries as we go, so the map cannot grow without bound on an
  // instance that survives a long time.
  for (const [key, times] of hits) {
    const live = times.filter(t => t > cutoff);
    if (live.length) hits.set(key, live);
    else hits.delete(key);
  }

  const times = hits.get(ip) ?? [];
  const oldest = times[0] ?? now;
  const reset = Math.max(1, Math.ceil((oldest + RATE_WINDOW_MS - now) / 1000));

  if (times.length >= RATE_LIMIT) return { allowed: false, remaining: 0, reset };

  times.push(now);
  hits.set(ip, times);
  return { allowed: true, remaining: RATE_LIMIT - times.length, reset };
}

/**
 * Current standing without consuming budget. Used for responses that perform no
 * work (a preflight, a wrong-method rejection) so a caller - or a scanner - can
 * still read its position, and so probing cannot burn a real caller's quota.
 */
function ratePeek(ip: string): { remaining: number; reset: number } {
  const now = Date.now();
  const times = (hits.get(ip) ?? []).filter(t => t > now - RATE_WINDOW_MS);
  const oldest = times[0] ?? now;
  return {
    remaining: Math.max(0, RATE_LIMIT - times.length),
    reset: Math.max(1, Math.ceil((oldest + RATE_WINDOW_MS - now) / 1000)),
  };
}

function rateHeaders(r: { remaining: number; reset: number }): Record<string, string> {
  return {
    'RateLimit-Limit': String(RATE_LIMIT),
    'RateLimit-Remaining': String(r.remaining),
    'RateLimit-Reset': String(r.reset),
    'RateLimit-Policy': `${RATE_LIMIT};w=${RATE_WINDOW_MS / 1000}`,
  };
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Expose-Headers':
    'RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset, RateLimit-Policy, Retry-After',
};

export const OPTIONS: APIRoute = ({ clientAddress }) =>
  new Response(null, {
    status: 204,
    headers: { ...CORS, ...rateHeaders(ratePeek(clientAddress ?? 'unknown')) },
  });

// Any method other than POST/OPTIONS. Answered in JSON rather than letting the
// framework return an HTML page: a caller that reached this endpoint is doing so
// programmatically, and an HTML error is not something it can act on.
export const ALL: APIRoute = ({ request, clientAddress }) =>
  fail(
    'method_not_allowed',
    `${request.method} is not supported on this endpoint.`,
    'Use POST with a JSON body. See https://johanneshomeier.com/openapi.json.',
    405,
    { Allow: 'POST, OPTIONS', ...rateHeaders(ratePeek(clientAddress ?? 'unknown')) },
  );

// Strip control characters that would break Postgres text storage (NUL bytes
// are rejected outright) or leak into email headers. The note keeps tabs and
// newlines; an address keeps neither. Also trims surrounding whitespace.
function clean(input: string, keepNewlines = false): string {
  let out = '';
  for (const ch of input) {
    const code = ch.codePointAt(0)!;
    const isControl = code < 0x20 || code === 0x7f;
    const keep = keepNewlines && (ch === '\n' || ch === '\r' || ch === '\t');
    if (!isControl || keep) out += ch;
  }
  return out.trim();
}

// Vercel Postgres (Neon) connection string, auto-injected by the integration.
function dbUrl(): string | undefined {
  return env('POSTGRES_URL') ?? env('DATABASE_URL')
    ?? env('POSTGRES_URL_NON_POOLING') ?? env('DATABASE_URL_UNPOOLED');
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const limit = rateLimit(clientAddress ?? 'unknown');
  if (!limit.allowed) {
    return fail(
      'rate_limited',
      'Too many notes from this address. Try again later.',
      `Wait ${limit.reset} seconds before retrying; see the RateLimit headers on this response.`,
      429,
      { ...rateHeaders(limit), 'Retry-After': String(limit.reset) },
    );
  }

  const resendKey = env('RESEND_API_KEY');
  const hasDb = !!dbUrl();
  if (!hasDb && !resendKey) {
    return fail('not_configured', 'Contact is not configured.',
      'The server is missing its delivery credentials. Email hello@johanneshomeier.com directly.', 500,
      rateHeaders(limit));
  }

  let note = '';
  let email = '';
  let captchaResponse = '';
  try {
    const body = await request.json();
    note = typeof body?.note === 'string' ? clean(body.note, true) : '';
    email = typeof body?.email === 'string' ? clean(body.email) : '';
    captchaResponse = typeof body?.frcCaptchaResponse === 'string' ? body.frcCaptchaResponse : '';
  } catch {
    return fail('invalid_body', 'Invalid request body.',
      'Send a JSON object with a `note` string. See https://johanneshomeier.com/openapi.json.', 400,
      rateHeaders(limit));
  }

  if (!note) {
    return fail('note_empty', 'Note cannot be empty.',
      'Provide a non-empty `note` string.', 400, rateHeaders(limit));
  }
  if (note.length > MAX_LEN) {
    return fail('note_too_long', 'Note is too long.',
      `Keep \`note\` to ${MAX_LEN} characters or fewer.`, 400, rateHeaders(limit));
  }
  if (email && (email.length > EMAIL_MAX || !EMAIL_RE.test(email))) {
    return fail('email_invalid', 'That email address looks invalid.',
      'Send a valid address in `email`, or omit the field to stay anonymous.', 400,
      rateHeaders(limit));
  }

  // Bot prevention via Friendly Captcha. Only enforced when an API key is
  // configured, so local dev / preview without secrets keeps working.
  const frcApiKey = env('FRIENDLY_CAPTCHA_API_KEY');
  if (frcApiKey) {
    // The server enforces the captcha but the client only renders it when the
    // public sitekey is set; without it, every submission below would be rejected.
    if (!env('PUBLIC_FRIENDLY_CAPTCHA_SITEKEY')) {
      console.warn('FRIENDLY_CAPTCHA_API_KEY is set without PUBLIC_FRIENDLY_CAPTCHA_SITEKEY - the widget will not render and submissions will be rejected.');
    }
    if (!captchaResponse) {
      return fail('captcha_required', 'Captcha verification is required.',
        'Solve the Friendly Captcha widget and send its token as `frcCaptchaResponse`.', 400,
        rateHeaders(limit));
    }
    if (!(await verifyCaptcha(frcApiKey, captchaResponse))) {
      return fail('captcha_failed', 'Captcha verification failed. Please try again.',
        'Request a fresh captcha token and retry; tokens are single-use and expire.', 400,
        rateHeaders(limit));
    }
  }

  // Persist and email in parallel and independently - one sink failing must
  // never lose the note as long as the other captured it.
  const [stored, emailed] = await Promise.all([
    hasDb ? storeNote(email, note) : Promise.resolve(false),
    resendKey ? sendEmail(resendKey, email, note) : Promise.resolve(false),
  ]);

  if (!stored && !emailed) {
    return fail('delivery_failed', 'Could not save your note. Please try again.',
      'Both delivery sinks failed. This is retryable - try again shortly.', 502,
      rateHeaders(limit));
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...CORS, ...rateHeaders(limit) },
  });
};

// Lazily create the table once per process; reset on failure so a later
// request can retry rather than caching a rejected promise.
let schemaReady: Promise<void> | undefined;

async function storeNote(email: string, note: string): Promise<boolean> {
  const url = dbUrl();
  if (!url) return false;
  try {
    const sql = neon(url);
    schemaReady ??= ensureSchema(sql).catch(err => { schemaReady = undefined; throw err; });
    await schemaReady;
    await sql`INSERT INTO notes (email, note) VALUES (${email || null}, ${note})`;
    return true;
  } catch (err) {
    console.error('Note storage error:', err);
    return false;
  }
}

async function ensureSchema(sql: NeonQueryFunction<false, false>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS notes (
      id          bigint generated always as identity primary key,
      created_at  timestamptz not null default now(),
      email       text,
      note        text not null
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS notes_created_at_idx ON notes (created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS notes_email_idx ON notes (email)`;
}

async function sendEmail(apiKey: string, email: string, note: string): Promise<boolean> {
  const to = env('CONTACT_TO') ?? ['j.homeier', 'proton.me'].join('@');
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: env('CONTACT_FROM') ?? DEFAULT_FROM,
      to,
      // Reply straight to the visitor when they shared an address, otherwise
      // keep replies pointed at the inbox itself.
      replyTo: email || to,
      subject: 'Note from your site',
      text: email ? `From: ${email}\n\n${note}` : note,
    });
    if (error) {
      console.error('Resend error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Resend error:', err);
    return false;
  }
}

// Verifies a Friendly Captcha response token against the v2 siteverify API.
async function verifyCaptcha(apiKey: string, response: string): Promise<boolean> {
  const sitekey = env('PUBLIC_FRIENDLY_CAPTCHA_SITEKEY');
  try {
    const res = await fetch(FRC_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify(sitekey ? { response, sitekey } : { response }),
    });
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    return data?.success === true;
  } catch (err) {
    console.error('Friendly Captcha verify error:', err);
    return false;
  }
}

// Structured error body: `error` stays for the browser form, `code` gives a
// caller something stable to branch on, and `resolution` says what to do next.
function fail(
  code: string,
  message: string,
  resolution: string,
  status: number,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify({ error: message, code, resolution, status }), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS, ...extraHeaders },
  });
}
