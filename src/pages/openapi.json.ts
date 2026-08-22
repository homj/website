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
      'This personal site exposes one write endpoint. It accepts a short note and an optional reply-to address, and delivers it to the site owner. There is no authentication and no read API; the site content itself is available at /llms.txt, /llms-full.txt and /index.md.',
    contact: { name: CONTROLLER.name, email: CONTROLLER.email, url: SITE.url },
    license: { name: 'All rights reserved', url: `${SITE.url}/imprint` },
  },
  servers: [{ url: SITE.url, description: 'Production' }],
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
  },
  components: {
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
        required: ['error'],
        properties: { error: { type: 'string', description: 'Human-readable reason.' } },
      },
    },
  },
};

export const GET: APIRoute = () =>
  new Response(JSON.stringify(spec, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
