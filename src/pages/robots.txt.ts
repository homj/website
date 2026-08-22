import type { APIRoute } from 'astro';
import { SITE } from '../data/seo';

// Served from a route rather than public/ so the absolute URLs stay tied to
// SITE.url. Every crawler is welcome, including AI and assistant crawlers -
// they are named explicitly because a named group overrides `*` for that agent,
// so listing them is the only way to state the allowance unambiguously.
const AI_AGENTS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'anthropic-ai',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'GoogleOther',
  'Applebot',
  'Applebot-Extended',
  'meta-externalagent',
  'Amazonbot',
  'Bytespider',
  'CCBot',
  'cohere-ai',
  'DuckAssistBot',
  'MistralAI-User',
  'YouBot',
];

export const GET: APIRoute = () => {
  const groups = ['User-agent: *', 'Allow: /', ''];

  for (const agent of AI_AGENTS) {
    groups.push(`User-agent: ${agent}`, 'Allow: /', '');
  }

  const body = [
    '# Every crawler, including AI assistants, may read this site in full.',
    '# Plain-text and Markdown mirrors live at /llms.txt and /index.md.',
    '',
    ...groups,
    `Sitemap: ${SITE.url}/sitemap.xml`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
