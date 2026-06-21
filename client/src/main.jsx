/**
 * main.jsx  (Phase 4 — Part 3)
 * ─────────────────────────────────────────────────────────────────────────────
 * Changes from Phase 3:
 *   + Calls registerSW() after mounting so the service worker is registered
 *     once the React app has loaded.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App            from './App.jsx';
import { registerSW } from './utils/registerSW.js';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Register service worker after first render
registerSW();
