/**
 * tokenStorage.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for where auth tokens live in the browser.
 *
 * Deliberately uses sessionStorage instead of localStorage:
 *   - sessionStorage is scoped to a single tab/window. Opening a new tab
 *     does NOT inherit another tab's session — the new tab has to log in.
 *   - Closing the tab clears it. Reopening the site is a fresh, logged-out
 *     state, matching the "should ask me to login again" requirement.
 *   - Reloading or duplicating the SAME tab keeps the session, since that's
 *     still the same sessionStorage context — this is expected browser
 *     behavior, not a bug.
 *
 * If a future requirement needs cross-tab shared sessions again, the only
 * change required is swapping `sessionStorage` for `localStorage` here —
 * nothing else in the app should read/write these keys directly.
 */

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

export const tokenStorage = {
  getAccessToken() {
    return sessionStorage.getItem(ACCESS_TOKEN_KEY);
  },
  getRefreshToken() {
    return sessionStorage.getItem(REFRESH_TOKEN_KEY);
  },
  setTokens(accessToken, refreshToken) {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },
  setAccessToken(accessToken) {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  },
  clearTokens() {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

export default tokenStorage;
