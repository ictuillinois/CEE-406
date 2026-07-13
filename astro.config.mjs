// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// Pages visibility: toggle PAGES_PUBLIC env var to switch base path
// Private Pages (default): base = '/' → <random>.pages.github.io
// Public Pages:            base = '/CEE-406/' → ictuillinois.github.io/CEE-406/
const isPublic = process.env.PAGES_PUBLIC === 'true';

export default defineConfig({
  site: isPublic ? 'https://ictuillinois.github.io' : 'https://glowing-pancake-8gkkgl1.pages.github.io',
  base: isPublic ? '/CEE-406/' : '/',
  integrations: [react()],

  vite: {
    plugins: [tailwindcss()]
  }
});
