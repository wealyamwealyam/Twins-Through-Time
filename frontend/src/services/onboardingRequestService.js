/**
 * onboardingRequestService.js
 * ---------------------------
 * Frontend service for the Onboarding Requests API (§6 in docs/apis.md).
 */

import { apiRequest } from "../utils/apiClient.js";

/**
 * Create a new onboarding request for a set of reviewed photos.
 */
export function createOnboardingRequest({ title, notes, photoIds }) {
  return apiRequest("/onboarding-requests", {
    method: "POST",
    body: JSON.stringify({
      onboardingRequestTitle: title,
      onboardingRequestNotes: notes ?? null,
      photoIds,
    }),
  });
}

/**
 * List onboarding requests (filtered by status, page, limit).
 */
export function getOnboardingRequests({ status, page = 1, limit = 20 } = {}) {
  const q = new URLSearchParams();
  if (status) q.set("status", status);
  q.set("page", page);
  q.set("limit", limit);
  return apiRequest(`/onboarding-requests?${q}`);
}

/**
 * Get a single onboarding request by ID.
 */
export function getOnboardingRequest(id) {
  return apiRequest(`/onboarding-requests/${id}`);
}

/**
 * Update an onboarding request (title / notes only, pending status only).
 */
export function updateOnboardingRequest(id, { title, notes }) {
  return apiRequest(`/onboarding-requests/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      onboardingRequestTitle: title,
      onboardingRequestNotes: notes ?? null,
    }),
  });
}

/**
 * Delete an onboarding request (submitter only, pending status only).
 */
export function deleteOnboardingRequest(id) {
  return apiRequest(`/onboarding-requests/${id}`, { method: "DELETE" });
}
