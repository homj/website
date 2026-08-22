import type { APIRoute } from 'astro';
import { SITE } from '../data/seo';

// Markdown body for a 404, served when an agent asks for text/markdown (see
// scripts/vercel-headers.mjs). Short and link-first: the point is to let a
// caller that guessed a URL recover in one more fetch rather than parse HTML.
const body = `# 404 — page not found

There is nothing at this address. Every page on this site:

- [Home](${SITE.url}/) — profile, projects, experience, contact
- [About](${SITE.url}/about/) — background and how he works
- [Contact](${SITE.url}/contact/) — every route to get in touch
- [API reference](${SITE.url}/docs/) — the one public endpoint
- [Imprint](${SITE.url}/imprint/) — operator identity and VAT ID
- [Privacy policy](${SITE.url}/privacy/) — GDPR disclosures

## Where to look next

- [llms.txt](${SITE.url}/llms.txt) — index of everything published here
- [llms-full.txt](${SITE.url}/llms-full.txt) — the whole site in one file
- [index.md](${SITE.url}/index.md) — the home page as Markdown
- [sitemap.xml](${SITE.url}/sitemap.xml) — every canonical URL
- [openapi.json](${SITE.url}/openapi.json) — the one public endpoint
`;

export const GET: APIRoute = () =>
  new Response(body, {
    status: 404,
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
