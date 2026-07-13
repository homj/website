import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { clean, EMAIL_RE, EMAIL_MAX, MAX_LEN, POST } from './contact';

// Mocks for the two external sinks. vi.mock is hoisted above imports, so the
// shared spies must come from vi.hoisted to be visible inside the factories.
const { sendMock, neonMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  neonMock: vi.fn(),
}));

vi.mock('resend', () => ({
  Resend: vi.fn(() => ({ emails: { send: sendMock } })),
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
function post(body?: unknown): Promise<Response> {
  const request = new Request('http://localhost/api/contact', {
    method: 'POST',
    ...(body === undefined
      ? {}
      : { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }),
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
