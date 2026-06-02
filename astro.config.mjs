import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel/serverless';

export default defineConfig({
  site: 'https://johanneshomeier.com',
  integrations: [react()],
  // hybrid keeps every page static and prerendered; only routes that opt out
  // with `export const prerender = false` (the /api/contact endpoint) run
  // server-side as Vercel serverless functions.
  output: 'hybrid',
  adapter: vercel(),
});
