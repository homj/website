import type { APIRoute } from 'astro';
import { CONTROLLER } from '../data/legal';
import { SITE } from '../data/seo';

// Describes the one endpoint this site exposes, so an agent can discover how to
// leave a note without scraping the form. Kept in step with src/pages/api/contact.ts.
const NOTE_MAX = 5000;
const EMAIL_MAX = 254;

const spec = {
  openapi: '3.1.0',
  info: {
    title: 'Johannes Homeier - public site API',
    version: '1.0.0',
    summary: 'The single public endpoint of johanneshomeier.com: leave a note.',
    description:
      'This personal site exposes one write endpoint. It accepts a short note and an optional reply-to address, and delivers it to the site owner. There is no authentication and no read API; the site content itself is available at /llms.txt, /llms-full.txt and /index.md. The endpoint is readable from any origin: it answers the CORS preflight and returns `Access-Control-Allow-Origin: *`, so a browser-based agent can call it directly.',
    contact: { name: CONTROLLER.name, email: CONTROLLER.email, url: SITE.url },
    license: { name: 'All rights reserved', url: `${SITE.url}/imprint/` },
  },
  servers: [{ url: SITE.url, description: 'Production' }],
  'x-versioning': {
    policy:
      'Breaking changes ship under a new path segment (/api/v2/...) rather than altering an existing version in place. Pin to /api/v1/ when integrating; the unversioned /api/contact always follows the newest version and can change without notice.',
    current: 'v1',
    deprecationSignals: [
      'A retiring version returns a `Deprecation` header and a `Sunset` header (RFC 8594) carrying the retirement date.',
      'A version keeps serving for at least six months after its Sunset header first appears.',
    ],
    documentation: `${SITE.url}/docs/`,
  },
  'x-rateLimit': {
    limit: 10,
    windowSeconds: 3600,
    scope:
      'Enforced per serving instance rather than globally, so treat it as a floor rather than a guarantee.',
    headers: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'RateLimit-Policy', 'Retry-After'],
  },
  paths: {
    '/api/contact': {
      post: {
        operationId: 'leaveNote',
        summary: 'Leave a note for Johannes Homeier',
        description:
          'Delivers a short message to the site owner. A reply-to email address is optional. When the site is configured with a Friendly Captcha key, `frcCaptchaResponse` is required and must carry a valid widget token; the public sitekey is exposed on the home page.',
        tags: ['contact'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/NoteRequest' },
              examples: {
                minimal: {
                  summary: 'Note only',
                  value: { note: 'Enjoyed the write-up on signal-based composables.' },
                },
                withReplyTo: {
                  summary: 'Note with a reply-to address',
                  value: {
                    note: 'Would you be open to a short consulting engagement?',
                    email: 'someone@example.com',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'The note was stored, emailed, or both.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/NoteAccepted' },
              },
            },
          },
          '400': {
            description:
              'The body was not valid JSON, the note was empty or longer than 5000 characters, the email address was malformed, or captcha verification failed.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Error' } },
            },
          },
          '500': {
            description: 'Contact delivery is not configured on the server.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Error' } },
            },
          },
          '502': {
            description: 'Both delivery sinks failed; the note was not saved. Safe to retry.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Error' } },
            },
          },
        },
      },
    },
    '/api/v1/contact': {
      post: {
        operationId: 'leaveNoteV1',
        summary: 'Leave a note (version-pinned)',
        description:
          'Identical to POST /api/contact, pinned to v1. Prefer this path when integrating: a breaking change will ship as /api/v2/contact rather than changing this one.',
        tags: ['contact'],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/NoteRequest' } },
          },
        },
        responses: {
          '200': {
            description: 'The note was stored, emailed, or both.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/NoteAccepted' } },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '429': { $ref: '#/components/responses/RateLimited' },
        },
      },
    },
  },
  components: {
    responses: {
      BadRequest: {
        description: 'The request was rejected. See `code` for the specific reason.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      RateLimited: {
        description:
          'Rate limit exceeded. `Retry-After` and the RateLimit headers say when to try again.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
    },
    schemas: {
      NoteRequest: {
        type: 'object',
        required: ['note'],
        additionalProperties: false,
        properties: {
          note: {
            type: 'string',
            minLength: 1,
            maxLength: NOTE_MAX,
            description: 'The message. Control characters other than tab and newline are stripped.',
          },
          email: {
            type: 'string',
            format: 'email',
            maxLength: EMAIL_MAX,
            description: 'Optional reply-to address. Omit it to stay anonymous.',
          },
          frcCaptchaResponse: {
            type: 'string',
            description: 'Friendly Captcha widget token. Required when the site runs with captcha enabled.',
          },
        },
      },
      NoteAccepted: {
        type: 'object',
        required: ['ok'],
        properties: { ok: { type: 'boolean', const: true } },
      },
      Error: {
        type: 'object',
        required: ['error', 'code', 'resolution', 'status'],
        description: 'Every error from this API uses this shape - never an HTML page.',
        properties: {
          error: { type: 'string', description: 'Human-readable reason.' },
          code: {
            type: 'string',
            description: 'Stable machine-readable identifier; branch on this, not on the message.',
            enum: [
              'invalid_body', 'note_empty', 'note_too_long', 'email_invalid',
              'captcha_required', 'captcha_failed', 'rate_limited',
              'method_not_allowed', 'endpoint_not_found', 'not_configured', 'delivery_failed',
            ],
          },
          resolution: { type: 'string', description: 'What the caller should do next.' },
          status: { type: 'integer', description: 'Repeats the HTTP status, for logging.' },
        },
      },
    },
  },
};

export const GET: APIRoute = () =>
  new Response(JSON.stringify(spec, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
