import type { APIRoute } from 'astro';
import { CONTROLLER } from '../../data/legal';
import { SITE } from '../../data/seo';

// RFC 9116. Generated at build time so `Expires` is always a fresh date ahead
// of now - a security.txt whose Expires has passed is treated as invalid.
export const GET: APIRoute = () => {
  const expires = new Date();
  expires.setUTCFullYear(expires.getUTCFullYear() + 1);
  expires.setUTCHours(0, 0, 0, 0);

  const body = [
    `Contact: mailto:${CONTROLLER.email}`,
    `Expires: ${expires.toISOString()}`,
    'Preferred-Languages: en, de',
    `Canonical: ${SITE.url}/.well-known/security.txt`,
    '',
    '# This is a personal site with no user accounts and no stored credentials.',
    '# The only endpoint that accepts input is POST /api/contact.',
    '',
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
