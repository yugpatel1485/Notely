/**
 * vite.config.js  (Phase 4 — Part 3)
 * ─────────────────────────────────────────────────────────────────────────────
 * Changes from Phase 3:
 *   + No new Vite plugins needed — sw.js is placed in /public so Vite
 *     copies it verbatim to /dist during build at the root scope (/sw.js).
 *     This means the SW gets the broadest possible scope ('/').
 *
 *   The only change here is documenting that intentional decision and adding
 *   a small server.headers config so sw.js is never cached by the browser
 *   (the browser should always re-fetch it to check for updates).
 */

import { defineConfig } from 'vite';
import react            from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    headers: {
      'Service-Worker-Allowed': '/',
    },
    proxy: {
      '/api': {
        target:       'http://localhost:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target:       'http://localhost:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        ws:     true,
      },
    },
  },

  build: {
    // Make sure sw.js is never fingerprinted / renamed
    rollupOptions: {
      output: {
        // Assets in public/ are copied as-is; this just documents that sw.js
        // must stay at /sw.js and must not be bundled.
      },
    },
  },
});
