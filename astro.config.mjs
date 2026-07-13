import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://johanneshomeier.com',
  integrations: [react()],
  // Default 'static' output prerenders every page; the /api/contact route
  // opts out with `export const prerender = false` and runs as a Vercel
  // serverless function. This replaced Astro 4's hybrid output mode, which
  // was removed in Astro 5.
  adapter: vercel(),
});
