import type { APIRoute } from 'astro';
import { CONTROLLER } from '../../data/legal';
import { SITE } from '../../data/seo';

// RFC 9116. A security.txt whose `Expires` has passed is treated as invalid, and
// RFC 9116 asks for less than a year out - which a build-time date cannot hold on
// a site that may sit undeployed for longer than it. So this one route opts out
// of prerendering and dates itself per request; it stays a year ahead for as long
// as the deployment lives, without needing a redeploy to stay valid.
export const prerender = false;

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
