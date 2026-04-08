/**
 * api.js
 * ------
 * Shared fetch wrapper used by all service modules.
 *
 * Token storage:
 *   localStorage["ttt_token"]         – short-lived JWT access token
 *   localStorage["ttt_refresh_token"] – long-lived refresh token
 *
 * On every request the access token is attached as a Bearer header.
 * If the server returns 401 the helper automatically tries one token
 * refresh, then retries the original request. If the refresh also
 * fails the user's tokens are cleared (forces re-login).
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

const TOKEN_KEY         = "ttt_token";
const REFRESH_TOKEN_KEY = "ttt_refresh_token";

// ─── Token helpers ────────────────────────────────────────────────────────────

export const getToken        = () => localStorage.getItem(TOKEN_KEY);
export const getRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY);

export const setTokens = (token, refreshToken) => {
  localStorage.setItem(TOKEN_KEY, token);
  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
};

export const clearTokens = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
};

// ─── Core fetch helper ────────────────────────────────────────────────────────

/**
 * apiFetch(path, options)
 *
 * Wraps native fetch with:
 *  - automatic base URL prefix
 *  - JSON Content-Type header
 *  - Bearer auth header (when a token is stored)
 *  - automatic 401 → token refresh → retry (once)
 *
 * Returns the parsed JSON body on success.
 * Throws an Error with { message, status, body } on failure.
 */
export async function apiFetch(path, options = {}, _isRetry = false) {
  const token = getToken();

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers ?? {}),
  };

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  // ── Auto-refresh on 401 ───────────────────────────────────────────────────
  if (response.status === 401 && !_isRetry) {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        const refreshRes = await fetch(`${BASE_URL}/api/auth/refresh`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ refreshToken }),
        });

        if (refreshRes.ok) {
          const { token: newToken } = await refreshRes.json();
          setTokens(newToken, null); // keep existing refresh token
          // Retry the original request once with the new access token
          return apiFetch(path, options, true);
        }
      } catch {
        // refresh itself failed — fall through to clear + throw
      }
    }
    // Could not refresh → wipe tokens so UI can redirect to login
    clearTokens();
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body = null;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    body = await response.json();
  }

  if (!response.ok) {
    const message =
      body?.error?.message ??
      body?.message ??
      `Request failed with status ${response.status}`;
    const err = new Error(message);
    err.status = response.status;
    err.body   = body;
    throw err;
  }

  return body;
}
