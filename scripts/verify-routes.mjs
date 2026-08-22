// Replays the generated Vercel route table against sample requests and asserts
// the behaviours the is-agentic scan checks for. Run after `npm run build`:
//
//   npm run verify
//
// This exists because the routing is order-dependent and fails silently when it
// breaks: a rewrite placed after `handle: filesystem` never fires, a header route
// after the terminal 404 never applies, and either way the build stays green and
// the pages still load. The failure only shows up as a lower score weeks later.
//
// It models Vercel's phases (pre-filesystem -> filesystem -> miss handlers); it
// does not re-implement Vercel, so it proves the route table, not the platform.
// The `has` regexes are anchored here; Vercel matching them more loosely would
// only ever be more permissive, so a pass here is not a false positive.
import { readFileSync, existsSync } from 'node:fs';

const cfg = JSON.parse(readFileSync('.vercel/output/config.json', 'utf8'));
const STATIC = '.vercel/output/static';
const exists = p => {
  const f = STATIC + p;
  return existsSync(f) || existsSync(f.replace(/\/$/, '') + '/index.html');
};

function matches(route, path, headers) {
  if (route.handle) return false;
  if (!new RegExp(route.src).test(path)) return false;
  for (const h of route.has ?? []) {
    if (h.type !== 'header') return false;
    const v = headers[h.key.toLowerCase()];
    if (v === undefined) return false;
    if (h.value && !new RegExp(`^${h.value}$`).test(v)) return false;
  }
  return true;
}

function serve(path, headers = {}) {
  headers = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  const applied = {};
  let dest = path;
  const fsIdx = cfg.routes.findIndex(r => r.handle === 'filesystem');

  for (const r of cfg.routes.slice(0, fsIdx)) {
    if (!matches(r, dest, headers)) continue;
    Object.assign(applied, r.headers ?? {});
    if (r.dest) dest = r.dest;
    if (!r.continue && r.dest) break;
  }

  if (exists(dest)) return { status: 200, dest, headers: applied };

  for (const r of cfg.routes.slice(fsIdx + 1)) {
    if (!matches(r, dest, headers)) continue;
    Object.assign(applied, r.headers ?? {});
    if (r.dest === '_render') return { status: 200, dest: '_render (SSR)', headers: applied };
    if (r.dest) return { status: r.status ?? 200, dest: r.dest, headers: applied };
  }
  return { status: 404, dest: '(unmatched)', headers: applied };
}

const MD = 'text/markdown, text/plain;q=0.9, */*;q=0.8';
const HTML = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';

const cases = [
  ['/ (browser)',            '/',        { accept: HTML }],
  ['/ (agent wants md)',     '/',        { accept: MD }],
  ['/ (bare text/markdown)', '/',        { accept: 'text/markdown' }],
  ['/ (Accept: */*)',        '/',        { accept: '*/*' }],
  ['/ (no Accept)',          '/',        {}],
  ['/index.md',              '/index.md',{ accept: MD }],
  ['/llms.txt (md accept)',  '/llms.txt',{ accept: MD }],
  ['/miss (browser)',        '/nope',    { accept: HTML }],
  ['/miss (agent wants md)', '/nope',    { accept: MD }],
  ['/api/contact',           '/api/contact', { accept: '*/*' }],
];

let bad = 0;
for (const [label, path, hdrs] of cases) {
  const r = serve(path, hdrs);
  const ct = r.headers['content-type'] ?? '(from file ext)';
  const vary = r.headers['vary'] ?? '-';
  console.log(`${label.padEnd(24)} ${String(r.status).padEnd(4)} -> ${r.dest.padEnd(12)} ct=${ct.padEnd(28)} vary=${vary}`);
}

// Assertions: the behaviours the scan actually failed on.
const checks = [
  ['agent gets markdown at /',     serve('/', { accept: MD }).dest === '/index.md'],
  ['browser still gets HTML at /', serve('/', { accept: HTML }).dest === '/'],
  ['*/* does not trigger md',      serve('/', { accept: '*/*' }).dest === '/'],
  ['/ sends Vary: Accept',         (serve('/', { accept: HTML }).headers['vary'] ?? '').includes('Accept')],
  ['md miss -> /404.md + 404',     (() => { const r = serve('/nope', { accept: MD }); return r.dest === '/404.md' && r.status === 404; })()],
  ['html miss -> /404.html + 404', (() => { const r = serve('/nope', { accept: HTML }); return r.dest === '/404.html' && r.status === 404; })()],
  ['404 branches send Vary',       ['/nope'].every(p => [MD, HTML].every(a => (serve(p, { accept: a }).headers['vary'] ?? '').includes('Accept')))],
  ['llms.txt unaffected by Accept',serve('/llms.txt', { accept: MD }).dest === '/llms.txt'],
];
console.log();
for (const [name, ok] of checks) { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); }
console.log();
if (bad) {
  console.error(`verify-routes: ${bad} of ${checks.length} checks FAILED - see scripts/vercel-headers.mjs`);
  process.exit(1);
}
console.log(`verify-routes: all ${checks.length} checks passed`);
