/**
 * registerSW.js  (Phase 4 — Part 3)
 * ─────────────────────────────────────────────────────────────────────────────
 * Registers the service worker and wires up update / message handling.
 * Import this once at the top of main.jsx (after React renders).
 *
 * Usage:
 *   import { registerSW } from './utils/registerSW';
 *   registerSW();
 */

export function registerSW() {
  if (!('serviceWorker' in navigator)) return;

  // Don't register in development (causes endless update loops)
  if (import.meta.env.DEV) return;

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      // Check for updates every 60 s (catches deploys while app is open)
      setInterval(() => registration.update(), 60_000);

      // New SW waiting → prompt-free activation (silent update)
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (
            newWorker.state === 'installed' &&
            navigator.serviceWorker.controller
          ) {
            // Tell the new SW to take over immediately
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });

      // Reload once the new SW has taken control
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });

      // Forward SW → window messages to a custom DOM event so React hooks can
      // subscribe without importing this module.
      navigator.serviceWorker.addEventListener('message', (event) => {
        window.dispatchEvent(
          new CustomEvent('sw-message', { detail: event.data })
        );
      });

      if (import.meta.env.DEV) {
        console.log('[SW] Registered:', registration.scope);
      }
    } catch (err) {
      console.warn('[SW] Registration failed:', err);
    }
  });
}

/**
 * Enqueue a mutation for background sync.
 * Call this from the offline-aware API interceptor when a fetch fails
 * because the device is offline.
 *
 * @param {{ url: string, method: string, headers: object, body?: string }} payload
 */
export async function enqueueMutation(payload) {
  if (!navigator.serviceWorker?.controller) return;

  navigator.serviceWorker.controller.postMessage({
    type: 'ENQUEUE_MUTATION',
    payload: { ...payload, enqueuedAt: Date.now() },
  });

  // Request a sync — browser will call it immediately if online, or when
  // connectivity is restored.
  try {
    const reg = await navigator.serviceWorker.ready;
    if ('sync' in reg) {
      await reg.sync.register('notely-sync-queue');
    }
  } catch {
    // sync API not supported in all browsers — queue is still persisted
  }
}
