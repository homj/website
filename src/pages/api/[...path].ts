import type { APIRoute } from 'astro';
import { SITE } from '../../data/seo';

export const prerender = false;

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
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    },
  });
};
