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
// Reject empty domain labels (e.g. `a@b..com`) and require at least one dot.
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
const FRC_VERIFY_URL = 'https://global.frcapi.com/api/v2/captcha/siteverify';
const DEFAULT_FROM = 'Johannes Homeier <no-reply@johanneshomeier.com>';

// Vercel Postgres (Neon) connection string, auto-injected by the integration.
function dbUrl(): string | undefined {
  return env('POSTGRES_URL') ?? env('DATABASE_URL')
    ?? env('POSTGRES_URL_NON_POOLING') ?? env('DATABASE_URL_UNPOOLED');
}

export const POST: APIRoute = async ({ request }) => {
  const resendKey = env('RESEND_API_KEY');
  const hasDb = !!dbUrl();
  if (!hasDb && !resendKey) {
    return json({ error: 'Contact is not configured.' }, 500);
  }

  let note = '';
  let email = '';
  let captchaResponse = '';
  try {
    const body = await request.json();
    note = typeof body?.note === 'string' ? body.note.trim() : '';
    email = typeof body?.email === 'string' ? body.email.trim() : '';
    captchaResponse = typeof body?.frcCaptchaResponse === 'string' ? body.frcCaptchaResponse : '';
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  if (!note) {
    return json({ error: 'Note cannot be empty.' }, 400);
  }
  if (note.length > MAX_LEN) {
    return json({ error: 'Note is too long.' }, 400);
  }
  if (email && !EMAIL_RE.test(email)) {
    return json({ error: 'That email address looks invalid.' }, 400);
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
      return json({ error: 'Captcha verification is required.' }, 400);
    }
    if (!(await verifyCaptcha(frcApiKey, captchaResponse))) {
      return json({ error: 'Captcha verification failed. Please try again.' }, 400);
    }
  }

  // Persist and email in parallel and independently — one sink failing must
  // never lose the note as long as the other captured it.
  const [stored, emailed] = await Promise.all([
    hasDb ? storeNote(email, note) : Promise.resolve(false),
    resendKey ? sendEmail(resendKey, email, note) : Promise.resolve(false),
  ]);

  if (!stored && !emailed) {
    return json({ error: 'Could not save your note. Please try again.' }, 502);
  }

  return json({ ok: true }, 200);
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

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
