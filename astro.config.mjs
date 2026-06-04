// astro.config.mjs
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://cocospuppynursery.com', // update to the real domain when known
  output: 'static',                       // pages prerender; endpoints opt out per-file
  adapter: vercel(),
  integrations: [sitemap()],
});
