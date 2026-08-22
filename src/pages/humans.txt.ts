import type { APIRoute } from 'astro';
import { CONTROLLER } from '../data/legal';

export const GET: APIRoute = () => {
  const body = [
    '/* TEAM */',
    '',
    `Product engineer & tech lead: ${CONTROLLER.name}`,
    `Contact: ${CONTROLLER.email}`,
    `Location: ${CONTROLLER.city}, ${CONTROLLER.country}`,
    'GitHub: https://github.com/homj',
    'LinkedIn: https://www.linkedin.com/in/johannes-homeier/',
    '',
    '/* SITE */',
    '',
    'Built with: Astro, React, TypeScript',
    'Hosted on: Vercel',
    'Typeface: Inter, self-hosted',
    'Standards: HTML5, CSS3, schema.org, llms.txt, RFC 9116',
    '',
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
