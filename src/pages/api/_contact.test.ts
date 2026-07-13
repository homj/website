import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { clean, EMAIL_RE, EMAIL_MAX, MAX_LEN, POST } from './contact';

// Mocks for the two external sinks. vi.mock is hoisted above imports, so the
// shared spies must come from vi.hoisted to be visible inside the factories.
const { sendMock, neonMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  neonMock: vi.fn(),
}));

vi.mock('resend', () => ({
  // vitest 4 requires mock implementations invoked with `new` to be
  // constructible (a `function`, not an arrow) — same returned object.
  Resend: vi.fn(function () {
    return { emails: { send: sendMock } };
  }),
}));

vi.mock('@neondatabase/serverless', () => ({
  neon: neonMock,
}));

// Every env var the endpoint reads. Each test starts with all of them unset
// and afterEach restores whatever the surrounding process had.
const ENV_KEYS = [
  'RESEND_API_KEY',
  'POSTGRES_URL',
  'DATABASE_URL',
  'POSTGRES_URL_NON_POOLING',
  'DATABASE_URL_UNPOOLED',
  'FRIENDLY_CAPTCHA_API_KEY',
  'PUBLIC_FRIENDLY_CAPTCHA_SITEKEY',
  'CONTACT_TO',
  'CONTACT_FROM',
  'VERCEL_URL',
];
let savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  vi.unstubAllGlobals();
  sendMock.mockReset();
  neonMock.mockReset();
});

// Builds the minimal APIContext the handler needs and invokes it directly.
// Each call gets a unique synthetic x-forwarded-for IP by default so unrelated
// tests never collide against the module-level rate limiter; pass an explicit
// 'x-forwarded-for' in extraHeaders to opt into sharing a rate-limit bucket.
let ipCounter = 0;
function post(body?: unknown, extraHeaders: Record<string, string> = {}): Promise<Response> {
  const headers: Record<string, string> = {
    'x-forwarded-for': `10.0.0.${++ipCounter}`,
    ...extraHeaders,
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const request = new Request('http://localhost/api/contact', {
    method: 'POST',
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers,
  });
  return POST({ request } as any) as Promise<Response>;
}

describe('clean', () => {
  it('strips NUL and other control characters', () => {
    expect(clean('a\u0000b\u0001c\u007fd')).toBe('abcd');
  });

  it('keeps newlines and tabs when keepNewlines is true', () => {
    expect(clean('line1\nline2\tend\r', true)).toBe('line1\nline2\tend');
  });

  it('strips newlines and tabs when keepNewlines is false', () => {
    expect(clean('line1\nline2\tend')).toBe('line1line2end');
  });

  it('trims surrounding whitespace', () => {
    expect(clean('  hello  ')).toBe('hello');
  });

  it('passes ordinary Unicode through unchanged', () => {
    expect(clean('こんにちは、世界')).toBe('こんにちは、世界');
  });
});

describe('EMAIL_RE', () => {
  it('accepts simple addresses', () => {
    expect(EMAIL_RE.test('a@b.co')).toBe(true);
  });

  it('accepts dots, plus tags, and subdomains', () => {
    expect(EMAIL_RE.test('first.last+tag@sub.domain.org')).toBe(true);
  });

  it('rejects addresses with spaces', () => {
    expect(EMAIL_RE.test('a b@c.co')).toBe(false);
  });

  it('rejects addresses without an @', () => {
    expect(EMAIL_RE.test('nobody.example.com')).toBe(false);
  });

  it('rejects domains without a dot', () => {
    expect(EMAIL_RE.test('a@b')).toBe(false);
  });

  it('rejects empty domain labels', () => {
    expect(EMAIL_RE.test('a@b..com')).toBe(false);
  });

  it('caps addresses at the RFC 5321 maximum of 254', () => {
    expect(EMAIL_MAX).toBe(254);
  });
});

describe('POST /api/contact', () => {
  it('returns 500 when neither email nor storage is configured', async () => {
    const res = await post({ note: 'hi' });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Contact is not configured.' });
  });

  describe('with Resend configured', () => {
    beforeEach(() => {
      process.env.RESEND_API_KEY = 'test-key';
      sendMock.mockResolvedValue({ error: null });
    });

    it('returns 400 for a body that is not JSON', async () => {
      const res = await post();
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Invalid request body.' });
    });

    it('returns 400 for an empty note', async () => {
      const res = await post({ note: '' });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Note cannot be empty.' });
    });

    it('returns 400 for a note longer than MAX_LEN', async () => {
      const res = await post({ note: 'x'.repeat(MAX_LEN + 1) });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Note is too long.' });
    });

    it('returns 400 for an invalid email address', async () => {
      const res = await post({ note: 'hi', email: 'not-an-email' });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'That email address looks invalid.' });
    });

    it('returns 200 for a valid note', async () => {
      const res = await post({ note: 'hi' });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
      expect(sendMock).toHaveBeenCalledTimes(1);
    });

    it('requires a captcha response when Friendly Captcha is configured', async () => {
      process.env.FRIENDLY_CAPTCHA_API_KEY = 'test';
      // No network call may escape even if the guard regresses.
      const fetchMock = vi.fn(() => {
        throw new Error('unexpected network call');
      });
      vi.stubGlobal('fetch', fetchMock);
      const res = await post({ note: 'hi' });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Captcha verification is required.' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns 502 when both sinks fail', async () => {
      process.env.POSTGRES_URL = 'postgres://user:pass@host/db';
      neonMock.mockReturnValue(() => {
        throw new Error('db down');
      });
      sendMock.mockResolvedValue({ error: { message: 'send failed' } });
      const res = await post({ note: 'hi' });
      expect(res.status).toBe(502);
      expect(await res.json()).toEqual({ error: 'Could not save your note. Please try again.' });
    });
  });
});

describe('origin check', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 'test-key';
    sendMock.mockResolvedValue({ error: null });
  });

  it('rejects a request from a disallowed origin', async () => {
    const res = await post({ note: 'hi' }, { origin: 'https://evil.example' });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Invalid request origin.' });
  });

  it('allows the canonical origin through to validation', async () => {
    const res = await post({ note: '' }, { origin: 'https://johanneshomeier.com' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Note cannot be empty.' });
  });

  it('allows a request with no Origin header through to validation', async () => {
    const res = await post({ note: '' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Note cannot be empty.' });
  });

  it('allows the current deployment origin (VERCEL_URL) through to validation', async () => {
    process.env.VERCEL_URL = 'preview-abc.vercel.app';
    const res = await post({ note: '' }, { origin: 'https://preview-abc.vercel.app' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Note cannot be empty.' });
  });
});

describe('rate limit', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 'test-key';
    sendMock.mockResolvedValue({ error: null });
  });

  it('returns 429 on the 6th request from the same IP within the window', async () => {
    const ip = '203.0.113.5';
    for (let i = 0; i < 5; i++) {
      const res = await post({ note: 'hi' }, { 'x-forwarded-for': ip });
      expect(res.status).toBe(200);
    }
    const res = await post({ note: 'hi' }, { 'x-forwarded-for': ip });
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'Too many requests. Please try again later.' });
  });

  it('does not rate-limit a different IP in the same window', async () => {
    const ipA = '203.0.113.10';
    for (let i = 0; i < 5; i++) {
      await post({ note: 'hi' }, { 'x-forwarded-for': ipA });
    }
    const res = await post({ note: 'hi' }, { 'x-forwarded-for': '203.0.113.11' });
    expect(res.status).toBe(200);
  });

  it('resets the rate limit window on a fresh module import', async () => {
    const ip = '203.0.113.30';
    for (let i = 0; i < 5; i++) {
      await post({ note: 'hi' }, { 'x-forwarded-for': ip });
    }
    const limited = await post({ note: 'hi' }, { 'x-forwarded-for': ip });
    expect(limited.status).toBe(429);

    vi.resetModules();
    const fresh = await import('./contact');
    const request = new Request('http://localhost/api/contact', {
      method: 'POST',
      body: JSON.stringify({ note: 'hi' }),
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    });
    const res = await fresh.POST({ request } as any);
    expect(res.status).toBe(200);
  });
});

describe('Cache-Control', () => {
  it('sets no-store on error responses', async () => {
    const res = await post({ note: 'hi' });
    expect(res.status).toBe(500);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('sets no-store on success responses', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    sendMock.mockResolvedValue({ error: null });
    const res = await post({ note: 'hi' });
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});
