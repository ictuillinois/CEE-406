// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// ── Deployment target: the custom domain, served at its ROOT ────────────────
//
// This used to switch on GitHub Pages *visibility*:
//
//   base: process.env.PAGES_PUBLIC === 'true' ? '/CEE-406/' : '/'
//
// which was right while the site lived at ictuillinois.github.io/CEE-406/ —
// a project page is served from a subpath. It is wrong now, and it broke the
// site the moment cee406.com was pointed here: a custom domain is served from
// the ROOT, so every asset built with base '/CEE-406/' resolved to
// cee406.com/CEE-406/_astro/... and 404'd. The HTML arrived fine and the page
// rendered unstyled, with every link one level too deep.
//
// Visibility was never the right signal. The domain is. There is one target
// now, so there is no branch: base is '/', and `public/CNAME` binds the
// domain to this deployment on every publish (an Actions deploy replaces the
// whole site, so the CNAME has to be in the artifact, not just in Settings).
//
// If the site ever has to fall back to ictuillinois.github.io/CEE-406/,
// change base to '/CEE-406/' and delete public/CNAME — but change both, and
// remember that internal links are all built from BASE_URL, so nothing else
// needs touching.

export default defineConfig({
  site: 'https://www.cee406.com',
  base: '/',
  integrations: [react()],

  vite: {
    plugins: [tailwindcss()]
  }
});
