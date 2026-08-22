import type { APIRoute } from 'astro';
import { CONTENT_UPDATED_ISO, PAGE_UPDATED_ISO, PERSONAL } from '../data/content';
import { LEGAL_UPDATED_ISO } from '../data/legal';
import { SITE } from '../data/seo';

// Generated rather than hand-maintained so <lastmod> always reflects the dates
// the content itself carries.

// The home page carries both the Personal note and the rest of the content, and
// either can change without the other; its <lastmod> is whichever moved last.
// ISO-8601 dates sort lexicographically, so plain string comparison is enough.
const HOME_LASTMOD = [PERSONAL.updatedISO, CONTENT_UPDATED_ISO].sort().at(-1)!;

const PAGES: { path: string; lastmod: string; priority: string; changefreq: string }[] = [
  { path: '/', lastmod: HOME_LASTMOD, priority: '1.0', changefreq: 'monthly' },
  { path: '/about/', lastmod: PAGE_UPDATED_ISO['/about/'], priority: '0.8', changefreq: 'monthly' },
  { path: '/contact/', lastmod: PAGE_UPDATED_ISO['/contact/'], priority: '0.8', changefreq: 'monthly' },
  { path: '/docs/', lastmod: PAGE_UPDATED_ISO['/docs/'], priority: '0.6', changefreq: 'monthly' },
  { path: '/imprint/', lastmod: LEGAL_UPDATED_ISO, priority: '0.2', changefreq: 'yearly' },
  { path: '/privacy/', lastmod: LEGAL_UPDATED_ISO, priority: '0.2', changefreq: 'yearly' },
];

export const GET: APIRoute = () => {
  const urls = PAGES.map(
    p => `  <url>
    <loc>${SITE.url}${p.path}</loc>
    <lastmod>${p.lastmod}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`,
  ).join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
