import type { APIRoute } from 'astro';
import { homeMarkdown } from '../lib/agent-docs';

// Markdown alternate of the home page, advertised from <link rel="alternate">
// and from /llms.txt.
export const GET: APIRoute = () =>
  new Response(homeMarkdown(), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
