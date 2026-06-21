/**
 * sw.js  (Phase 4 — Part 3)
 * ─────────────────────────────────────────────────────────────────────────────
 * Service Worker for Notely offline support.
 *
 * Strategy summary:
 *   - App shell (HTML, JS, CSS, fonts) → Cache-First with network fallback
 *   - API GET requests → Network-First with cache fallback (stale-while-revalidate)
 *   - API mutating requests (POST/PUT/DELETE) when offline → queued in IndexedDB
 *     and replayed when connectivity returns via Background Sync
 *   - Static assets (images, fonts) → Cache-First, long TTL
 *
 * Caches:
 *   notely-shell-v1    App shell
 *   notely-api-v1      API response cache
 *   notely-assets-v1   Static assets
 */

const SHELL_CACHE  = 'notely-shell-v1';
const API_CACHE    = 'notely-api-v1';
const ASSET_CACHE  = 'notely-assets-v1';
const SYNC_TAG     = 'notely-sync-queue';

// Files that make up the app shell (populated by Vite build manifest at build time;
// the ones listed here are the Vite dev-server paths for local development).
const SHELL_URLS = [
  '/',
  '/index.html',
];

// ── Install: pre-cache the app shell ─────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      cache.addAll(SHELL_URLS).catch(() => {
        // Non-fatal in dev — shell URLs may not all be reachable yet
      })
    ).then(() => self.skipWaiting())
  );
});

// ── Activate: remove old caches ───────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  const CURRENT = new Set([SHELL_CACHE, API_CACHE, ASSET_CACHE]);
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !CURRENT.has(k)).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: route requests ──────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests — mutations go through the sync queue instead
  if (request.method !== 'GET') return;

  // Skip chrome-extension, socket.io polling, etc.
  if (!['http:', 'https:'].includes(url.protocol)) return;
  if (url.pathname.startsWith('/socket.io')) return;

  // API calls → Network-First with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstApi(request));
    return;
  }

  // Google Fonts / CDN assets → Cache-First
  if (
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(cacheFirstAsset(request));
    return;
  }

  // App shell (HTML navigation requests) → Cache-First, fallback to /
  if (request.mode === 'navigate') {
    event.respondWith(navigationHandler(request));
    return;
  }

  // Other same-origin static assets (JS, CSS, images built by Vite) → Cache-First
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirstShell(request));
    return;
  }
});

// ── Strategy: Network-First for API GETs ──────────────────────────────────────
async function networkFirstApi(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const response = await fetch(request.clone());
    if (response.ok) {
      // Store a clone — only cache successful responses
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline — serve from cache
    const cached = await cache.match(request);
    if (cached) return cached;
    // Return a structured offline response so the UI can detect it
    return offlineApiResponse();
  }
}

// ── Strategy: Cache-First for shell/assets ────────────────────────────────────
async function cacheFirstShell(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request.clone());
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

// ── Strategy: Cache-First for external assets ─────────────────────────────────
async function cacheFirstAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request.clone());
    if (response.ok) {
      const cache = await caches.open(ASSET_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 503 });
  }
}

// ── Strategy: Navigation (SPA) — always serve index.html ─────────────────────
async function navigationHandler(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline — serve cached index.html so the React app still boots
    const cached =
      (await caches.match(request)) ||
      (await caches.match('/')) ||
      (await caches.match('/index.html'));
    return cached || new Response('Offline', { status: 503 });
  }
}

// ── Offline API response sentinel ─────────────────────────────────────────────
function offlineApiResponse() {
  return new Response(
    JSON.stringify({ success: false, message: 'offline', offline: true }),
    {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'X-SW-Offline': '1' },
    }
  );
}

// ── Background Sync: replay queued mutations ──────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(replaySyncQueue());
  }
});

async function replaySyncQueue() {
  const queue = await readSyncQueue();
  if (!queue.length) return;

  const succeeded = [];

  for (const item of queue) {
    try {
      const response = await fetch(item.url, {
        method:  item.method,
        headers: item.headers,
        body:    item.body ?? undefined,
      });
      if (response.ok || (response.status >= 200 && response.status < 300)) {
        succeeded.push(item.id);
      }
      // 4xx errors = bad request, remove from queue to avoid infinite retry
      if (response.status >= 400 && response.status < 500) {
        succeeded.push(item.id);
      }
    } catch {
      // Still offline — leave in queue
    }
  }

  if (succeeded.length) {
    await removeSyncItems(succeeded);
    // Tell the app that queued writes were flushed
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((c) =>
      c.postMessage({ type: 'SYNC_COMPLETE', flushed: succeeded.length })
    );
  }
}

// ── IndexedDB helpers for the sync queue ──────────────────────────────────────
function openSyncDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('notely-sync', 1);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

async function readSyncQueue() {
  const db = await openSyncDb();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('queue', 'readonly');
    const req = tx.objectStore('queue').getAll();
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

async function removeSyncItems(ids) {
  const db = await openSyncDb();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction('queue', 'readwrite');
    const store = tx.objectStore('queue');
    ids.forEach((id) => store.delete(id));
    tx.oncomplete = resolve;
    tx.onerror    = (e) => reject(e.target.error);
  });
}

// ── Message handler: client → SW ─────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // Client enqueues a mutation while offline
  if (event.data?.type === 'ENQUEUE_MUTATION') {
    enqueueMutation(event.data.payload);
  }
});

async function enqueueMutation(payload) {
  const db = await openSyncDb();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('queue', 'readwrite');
    tx.objectStore('queue').add(payload);
    tx.oncomplete = resolve;
    tx.onerror    = (e) => reject(e.target.error);
  });
}
