/**
 * api.js  (Phase 4 — Part 3)
 * ─────────────────────────────────────────────────────────────────────────────
 * Changes from Phase 3:
 *   + Response interceptor detects offline errors (network failure or
 *     X-SW-Offline header) on mutating requests (POST/PUT/DELETE) and
 *     enqueues them for background sync instead of throwing immediately.
 *   + GET requests that return an offline sentinel still throw so the
 *     calling component can show stale data from the SW cache.
 *
 * IMPORTANT: this file replaces client/src/services/api.js in full.
 */

import axios from 'axios';
import { enqueueMutation } from '../utils/registerSW';
import tokenStorage from '../utils/tokenStorage';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

// ── Request: attach JWT ───────────────────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = tokenStorage.getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response: offline-aware error handling ────────────────────────────────────
api.interceptors.response.use(
  // Success path — pass through unchanged
  (response) => response,

  async (error) => {
    const { config, response } = error;
    if (!config) return Promise.reject(error);

    const method  = config.method?.toUpperCase();
    const isMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
    const isOffline  = !navigator.onLine;
    const isSwOffline = response?.headers?.['x-sw-offline'] === '1';

    // Queue mutations when we're truly offline (not just a server error)
    const isUpload = config.url?.includes('/attachments');
    if (isMutation && !isUpload && (isOffline || isSwOffline || !response)) {
      await enqueueMutation({
        url:     config.baseURL
          ? config.url.startsWith('http') ? config.url : `${config.baseURL}${config.url}`
          : config.url,
        method,
        headers: {
          'Content-Type': config.headers['Content-Type'] || 'application/json',
          Authorization:  config.headers.Authorization || '',
        },
        body: config.data ?? null,
      });

      // Return a synthetic "queued" response so callers don't crash
      return {
        data: {
          success:  true,
          queued:   true,
          message:  'Saved offline — will sync when back online',
        },
        status:  202,
        headers: {},
        config,
      };
    }

    // 401 → clear token and redirect to login
    if (response?.status === 401) {
      tokenStorage.clearTokens();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;
