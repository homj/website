// Adds response headers to the Vercel build output.
//
// The Astro Vercel adapter emits .vercel/output/config.json via the Build
// Output API, and that file is the authoritative routing config - `headers` in
// vercel.json is not merged into it. So we append header routes here, after
// `astro build`, rather than shipping config that would silently do nothing.
//
// Every route uses `continue: true` so it only decorates the response and lets
// the filesystem handler still serve the file.

import { readFile, writeFile } from 'node:fs/promises';

const CONFIG = '.vercel/output/config.json';

// Files an agent fetches directly. They are cross-origin readable so a
// browser-based agent can load them, and cached briefly rather than forever.
const MACHINE_READABLE =
  '^/(llms\\.txt|llms-full\\.txt|index\\.md|openapi\\.json|sitemap\\.xml|humans\\.txt|robots\\.txt|\\.well-known/security\\.txt)$';

const routes = [
  {
    src: '^/(.*)$',
    headers: {
      // Vercel terminates TLS for every request; no subdomain is served plaintext.
      'strict-transport-security': 'max-age=63072000; includeSubDomains',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
      'x-frame-options': 'DENY',
      'permissions-policy': 'geolocation=(), microphone=(), camera=(), interest-cohort=()',
    },
    continue: true,
  },
  {
    src: MACHINE_READABLE,
    headers: {
      'access-control-allow-origin': '*',
      'cache-control': 'public, max-age=3600, must-revalidate',
    },
    continue: true,
  },
  {
    // Not every CDN mime table knows .md; state it rather than hope.
    src: '^/index\\.md$',
    headers: { 'content-type': 'text/markdown; charset=utf-8' },
    continue: true,
  },
];

const config = JSON.parse(await readFile(CONFIG, 'utf8'));

// Header routes must precede the filesystem handler to apply to static files.
const fsIndex = config.routes.findIndex(r => r.handle === 'filesystem');
const at = fsIndex === -1 ? config.routes.length : fsIndex;
config.routes.splice(at, 0, ...routes);

await writeFile(CONFIG, JSON.stringify(config, null, '\t'));
console.log(`vercel-headers: inserted ${routes.length} header routes at index ${at}`);
