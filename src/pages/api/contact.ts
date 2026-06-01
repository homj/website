import type { APIRoute } from 'astro';
import { Resend } from 'resend';

// Run on-demand as a serverless function rather than being prerendered.
export const prerender = false;

const TO = ['j.homeier', 'proton.me'].join('@');
const MAX_LEN = 5000;

export const POST: APIRoute = async ({ request }) => {
  const apiKey = import.meta.env.RESEND_API_KEY;
  if (!apiKey) {
    return json({ error: 'Email service is not configured.' }, 500);
  }

  let note = '';
  try {
    const body = await request.json();
    note = typeof body?.note === 'string' ? body.note.trim() : '';
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  if (!note) {
    return json({ error: 'Note cannot be empty.' }, 400);
  }
  if (note.length > MAX_LEN) {
    return json({ error: 'Note is too long.' }, 400);
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    // Until a custom domain is verified in Resend, use the shared onboarding
    // sender. Swap this for an address on your own verified domain later.
    from: import.meta.env.CONTACT_FROM ?? 'Site Notes <onboarding@resend.dev>',
    to: TO,
    replyTo: TO,
    subject: 'Note from your site',
    text: note,
  });

  if (error) {
    console.error('Resend error:', error);
    return json({ error: 'Could not send your note. Please try again.' }, 502);
  }

  return json({ ok: true }, 200);
};

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
