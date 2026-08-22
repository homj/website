// Adds response headers and Accept-negotiation routes to the Vercel build output.
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
  '^/(llms\\.txt|llms-full\\.txt|index\\.md|404\\.md|openapi\\.json|sitemap\\.xml|humans\\.txt|robots\\.txt|\\.well-known/security\\.txt)$';

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
    src: '^/(index|404)\\.md$',
    headers: { 'content-type': 'text/markdown; charset=utf-8' },
    continue: true,
  },
  {
    // `/` and `/index.md` are two representations selected by Accept, so the
    // cache key has to include it. Without Vary a CDN can hand the HTML variant
    // to an agent asking for markdown, depending on which landed in cache first.
    src: '^/(index\\.md)?$',
    headers: { vary: 'Accept, Accept-Encoding' },
    continue: true,
  },
  {
    // Header routes match the requested path, not the rewritten one, so `/`
    // needs its own content-type rule - the rewrite below leaves the URL as `/`.
    // The CORS header has to be repeated here too: MACHINE_READABLE above does
    // not match `/`, and without it a browser-based agent fetching `/` with
    // `Accept: text/markdown` from another origin gets the body but is blocked
    // from reading it - the one case this negotiation exists for.
    src: '^/$',
    has: [{ type: 'header', key: 'accept', value: '.*text/markdown.*' }],
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'access-control-allow-origin': '*',
    },
    continue: true,
  },
  {
    // acceptmarkdown.com: an agent asking for markdown gets the markdown mirror
    // of the home page. A rewrite, not a redirect, so the URL stays `/`.
    src: '^/$',
    has: [{ type: 'header', key: 'accept', value: '.*text/markdown.*' }],
    dest: '/index.md',
  },
];

// Served after the filesystem handler, so it only catches genuine misses. Gives
// an agent asking for markdown a markdown 404 body it can act on, instead of a
// page of HTML chrome.
const notFoundRoutes = [
  {
    src: '/.*',
    has: [{ type: 'header', key: 'accept', value: '.*text/markdown.*' }],
    dest: '/404.md',
    status: 404,
    headers: {
      vary: 'Accept, Accept-Encoding',
      'content-type': 'text/markdown; charset=utf-8',
      'access-control-allow-origin': '*',
    },
  },
];

const config = JSON.parse(await readFile(CONFIG, 'utf8'));

// `astro build` rewrites config.json from scratch, so this always sees a fresh
// adapter output. Run twice against the same file and the lookups below would
// latch onto routes this script itself wrote - the `catchAll` search in
// particular would find our own markdown 404 and hang the Vary header off that
// instead of the terminal HTML one, silently. Refuse rather than half-apply.
if (config.routes.some(r => r.src === MACHINE_READABLE)) {
  throw new Error(
    `${CONFIG} already carries these routes - run \`astro build\` first. `
    + 'Applying twice would decorate this script\'s own routes instead of the adapter\'s.',
  );
}

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

// The markdown 404 has to sit ahead of the adapter's terminal `/.*` -> /404.html
// route, which matches everything and would otherwise answer first.
const catchAll = config.routes.findIndex(
  r => r.status === 404 && typeof r.dest === 'string' && r.dest.includes('404'),
);
if (catchAll === -1) {
  throw new Error(
    `${CONFIG} has no terminal 404 route - the adapter's output shape changed. `
    + 'Refusing to write a markdown 404 that could never match; update this script.',
  );
}
// Both 404 branches are selected by Accept, so the HTML one needs `Vary` just
// as much as the markdown one. Only the markdown route carried it, which left a
// shared cache free to store the HTML 404 for a path under no Accept dimension
// and then hand that same HTML back to the next agent asking for markdown.
// Written onto the adapter's own route rather than inserted as an extra
// `continue: true` header route, because `continue` after `handle: filesystem`
// is not a shape the adapter itself ever emits.
const terminal = config.routes[catchAll];
terminal.headers = { vary: 'Accept, Accept-Encoding', ...terminal.headers };

config.routes.splice(catchAll, 0, ...notFoundRoutes);

await writeFile(CONFIG, JSON.stringify(config, null, '\t'));
console.log(
  `vercel-headers: inserted ${routes.length} routes at ${fsIndex}, `
  + `${notFoundRoutes.length} not-found route at ${catchAll} (+Vary on the HTML 404)`,
);
