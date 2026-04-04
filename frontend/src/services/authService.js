/**
 * authService.js
 * --------------
 * Wraps the §1 Auth API endpoints.
 */

import { apiFetch, setTokens, clearTokens } from "./api.js";

/**
 * Register a new account.
 * @param {{ username, email, password, firstName, lastName, age?, gender?, requestContributor? }} data
 */
export async function register(data) {
  const body = await apiFetch("/api/auth/register", {
    method: "POST",
    body:   JSON.stringify(data),
  });
  // Store tokens immediately so the user is logged in after registration
  setTokens(body.token, body.refreshToken);
  return body; // { user, token, refreshToken }
}

/**
 * Log in with email + password.
 * @param {{ email, password }} credentials
 */
export async function login({ email, password }) {
  const body = await apiFetch("/api/auth/login", {
    method: "POST",
    body:   JSON.stringify({ email, password }),
  });
  setTokens(body.token, body.refreshToken);
  return body; // { token, refreshToken, user }
}

/**
 * Log out — invalidates the refresh token on the server and clears local storage.
 */
export async function logout() {
  const { getRefreshToken } = await import("./api.js");
  try {
    await apiFetch("/api/auth/logout", {
      method: "POST",
      body:   JSON.stringify({ refreshToken: getRefreshToken() }),
    });
  } finally {
    clearTokens();
  }
}

/**
 * Send a forgot-password email.
 * @param {string} email
 */
export async function forgotPassword(email) {
  return apiFetch("/api/auth/forgot-password", {
    method: "POST",
    body:   JSON.stringify({ email }),
  });
}

/**
 * Complete a password reset.
 * @param {{ resetToken, newPassword }} data
 */
export async function resetPassword({ resetToken, newPassword }) {
  return apiFetch("/api/auth/reset-password", {
    method: "POST",
    body:   JSON.stringify({ resetToken, newPassword }),
  });
}
