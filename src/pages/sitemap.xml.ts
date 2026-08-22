import type { APIRoute } from 'astro';
import { PERSONAL } from '../data/content';
import { LEGAL_UPDATED_ISO } from '../data/legal';
import { SITE } from '../data/seo';

// Generated rather than hand-maintained so <lastmod> always reflects the dates
// the content itself carries.
const PAGES: { path: string; lastmod: string; priority: string; changefreq: string }[] = [
  { path: '/', lastmod: PERSONAL.updatedISO, priority: '1.0', changefreq: 'monthly' },
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
