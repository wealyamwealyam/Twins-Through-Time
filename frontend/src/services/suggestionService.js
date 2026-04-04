/**
 * suggestionService.js
 * --------------------
 * Frontend service for the Onboarding Request Suggestions API (§7 in docs/apis.md).
 * All routes are nested under /api/onboarding-requests/:id/suggestions
 */

import { apiFetch } from "./api.js";

/**
 * Create a suggestion (admin only).
 * @param {string} onboardingRequestId
 * @param {{ onboardingRequestNote?: string, photoEdits?: object[] }} data
 */
export function createSuggestion(onboardingRequestId, data) {
  return apiFetch(`/api/onboarding-requests/${onboardingRequestId}/suggestions`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * List all suggestions for an onboarding request.
 * @param {string} onboardingRequestId
 */
export function getSuggestions(onboardingRequestId) {
  return apiFetch(`/api/onboarding-requests/${onboardingRequestId}/suggestions`);
}

/**
 * Get a single suggestion by ID.
 * @param {string} onboardingRequestId
 * @param {string} suggestionId
 */
export function getSuggestion(onboardingRequestId, suggestionId) {
  return apiFetch(
    `/api/onboarding-requests/${onboardingRequestId}/suggestions/${suggestionId}`
  );
}

/**
 * Apply a photo edit from a suggestion.
 * @param {string} onboardingRequestId
 * @param {string} suggestionId
 * @param {string} editId
 */
export function applyPhotoEdit(onboardingRequestId, suggestionId, editId) {
  return apiFetch(
    `/api/onboarding-requests/${onboardingRequestId}/suggestions/${suggestionId}/photo-edits/${editId}/apply`,
    { method: "POST" }
  );
}

/**
 * Add a note to a photo edit.
 * @param {string} onboardingRequestId
 * @param {string} suggestionId
 * @param {string} editId
 * @param {string} note
 */
export function addPhotoEditNote(onboardingRequestId, suggestionId, editId, note) {
  return apiFetch(
    `/api/onboarding-requests/${onboardingRequestId}/suggestions/${suggestionId}/photo-edits/${editId}/note`,
    {
      method: "POST",
      body: JSON.stringify({ note }),
    }
  );
}
