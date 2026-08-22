// Adds response headers to the Vercel build output.
//
// The Astro Vercel adapter emits .vercel/output/config.json via the Build
// Output API, and that file is the authoritative routing config - `headers` in
// vercel.json is not merged into it. So we append header routes here, after
// `astro build`, rather than shipping config that would silently do nothing.
//
// Every route uses `continue: true` so it only decorates the response and lets
// the filesystem handler still serve the file.
//
// This runs from the `build` script, so vercel.json pins `buildCommand` to it -
// a build command configured in the Vercel dashboard would otherwise take over
// and run `astro build` alone, dropping every header below without a trace.

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
      // `preload` submits the domain to the browsers' built-in HSTS list: every
      // present and future subdomain is HTTPS-only, and removal takes months.
      'strict-transport-security': 'max-age=63072000; includeSubDomains; preload',
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
// Without it there is nowhere safe to put them: the adapter's route list ends in
// a terminal `/.*` -> /404.html catch-all, so appending would park every header
// behind a route that always matches first, and the build would still look green.
const fsIndex = config.routes.findIndex(r => r.handle === 'filesystem');
if (fsIndex === -1) {
  throw new Error(
    `${CONFIG} has no \`handle: "filesystem"\` route - the adapter's output shape changed. `
    + 'Refusing to write header routes that could never match; update this script.',
  );
}
config.routes.splice(fsIndex, 0, ...routes);

await writeFile(CONFIG, JSON.stringify(config, null, '\t'));
console.log(`vercel-headers: inserted ${routes.length} header routes at index ${fsIndex}`);
