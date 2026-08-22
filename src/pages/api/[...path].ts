import type { APIRoute } from 'astro';
import { SITE } from '../../data/seo';

export const prerender = false;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

// A JSON POST from another origin is preflighted, and a preflight only passes on
// a 2xx - so answering OPTIONS with the 404 below would fail the preflight and
// leave a browser-based agent with an opaque network error instead of the
// explanatory body. Say yes to the preflight; the real request still 404s, but
// readably.
export const OPTIONS: APIRoute = () => new Response(null, { status: 204, headers: CORS });

// Anything under /api/ that is not a real endpoint. Without this, an unknown API
// path falls through to the HTML 404 page - which a programmatic caller cannot
// parse. /api/contact is a static route, so it takes priority over this one.
export const ALL: APIRoute = ({ params, request }) => {
  const body = {
    error: `No API endpoint at /api/${params.path ?? ''}.`,
    code: 'endpoint_not_found',
    resolution: `This site exposes one endpoint: POST /api/contact. See ${SITE.url}/openapi.json for its schema.`,
    status: 404,
    method: request.method,
  };

  return new Response(JSON.stringify(body, null, 2), {
    status: 404,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS,
      'Cache-Control': 'no-store',
    },
  });
};
