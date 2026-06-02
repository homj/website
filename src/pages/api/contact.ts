import type { APIRoute } from 'astro';
import { Resend } from 'resend';

// Run on-demand as a serverless function rather than being prerendered.
export const prerender = false;

// Recipient inbox for contact notes, configured via the environment.
const TO = import.meta.env.CONTACT_TO ?? ['j.homeier', 'proton.me'].join('@');
const MAX_LEN = 5000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FRC_VERIFY_URL = 'https://global.frcapi.com/api/v2/captcha/siteverify';

export const POST: APIRoute = async ({ request }) => {
  const apiKey = import.meta.env.RESEND_API_KEY;
  if (!apiKey) {
    return json({ error: 'Email service is not configured.' }, 500);
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
  const frcApiKey = import.meta.env.FRIENDLY_CAPTCHA_API_KEY;
  if (frcApiKey) {
    if (!captchaResponse) {
      return json({ error: 'Captcha verification is required.' }, 400);
    }
    if (!(await verifyCaptcha(frcApiKey, captchaResponse))) {
      return json({ error: 'Captcha verification failed. Please try again.' }, 400);
    }
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    // Until a custom domain is verified in Resend, use the shared onboarding
    // sender. Swap this for an address on your own verified domain later.
    from: import.meta.env.CONTACT_FROM ?? 'Site Notes <onboarding@resend.dev>',
    to: TO,
    // Reply straight to the visitor when they shared an address, otherwise
    // keep replies pointed at the inbox itself.
    replyTo: email || TO,
    subject: 'Note from your site',
    text: email ? `From: ${email}\n\n${note}` : note,
  });

  if (error) {
    console.error('Resend error:', error);
    return json({ error: 'Could not send your note. Please try again.' }, 502);
  }

  return json({ ok: true }, 200);
};

// Verifies a Friendly Captcha response token against the v2 siteverify API.
async function verifyCaptcha(apiKey: string, response: string): Promise<boolean> {
  const sitekey = import.meta.env.PUBLIC_FRIENDLY_CAPTCHA_SITEKEY;
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
