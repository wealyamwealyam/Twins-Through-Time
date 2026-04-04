/**
 * accountService.js
 * -----------------
 * Wraps the §2 Account API endpoints.
 */

import { apiFetch } from "./api.js";

/**
 * Fetch the currently logged-in user's profile.
 * @returns {Promise<object>} user object
 */
export async function getMe() {
  return apiFetch("/api/account/profile");
}

/**
 * Update the currently logged-in user's profile.
 * Only send the fields you want to change.
 * @param {{ username?, firstName?, lastName?, age?, gender? }} updates
 */
export async function updateMe(updates) {
  return apiFetch("/api/account/profile", {
    method: "PATCH",
    body:   JSON.stringify(updates),
  });
}
