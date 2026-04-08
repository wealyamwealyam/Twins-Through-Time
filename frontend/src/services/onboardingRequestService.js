/**
 * onboardingRequestService.js
 * ---------------------------
 * Frontend service for the Onboarding Requests API (§6 in docs/apis.md).
 */

import { apiFetch } from "./api.js";

/**
 * Create a new onboarding request.
 * @param {{ title: string, description?: string }} data
 */
export function createOnboardingRequest(data) {
  return apiFetch("/api/onboarding-requests", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * List onboarding requests (filtered by status, page, limit).
 * @param {{ status?: string, page?: number, limit?: number }} params
 */
export function getOnboardingRequests({ status, page = 1, limit = 20 } = {}) {
  const q = new URLSearchParams();
  if (status) q.set("status", status);
  q.set("page", page);
  q.set("limit", limit);
  return apiFetch(`/api/onboarding-requests?${q}`);
}

/**
 * Get a single onboarding request by ID.
 * @param {string} id
 */
export function getOnboardingRequest(id) {
  return apiFetch(`/api/onboarding-requests/${id}`);
}

/**
 * Update an onboarding request (partial).
 * @param {string} id
 * @param {object} updates
 */
export function updateOnboardingRequest(id, updates) {
  return apiFetch(`/api/onboarding-requests/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

/**
 * Delete an onboarding request.
 * @param {string} id
 */
export function deleteOnboardingRequest(id) {
  return apiFetch(`/api/onboarding-requests/${id}`, { method: "DELETE" });
}

/**
 * Add photos to an onboarding request.
 * @param {string} id
 * @param {string[]} photoIds
 */
export function addPhotosToRequest(id, photoIds) {
  return apiFetch(`/api/onboarding-requests/${id}/photos`, {
    method: "POST",
    body: JSON.stringify({ photoIds }),
  });
}

/**
 * Remove a photo from an onboarding request.
 * @param {string} id
 * @param {string} photoId
 */
export function removePhotoFromRequest(id, photoId) {
  return apiFetch(`/api/onboarding-requests/${id}/photos/${photoId}`, {
    method: "DELETE",
  });
}

/**
 * Submit an onboarding request for review.
 * @param {string} id
 */
export function submitOnboardingRequest(id) {
  return apiFetch(`/api/onboarding-requests/${id}/submit`, { method: "POST" });
}

/**
 * Approve an onboarding request (admin only).
 * @param {string} id
 */
export function approveOnboardingRequest(id) {
  return apiFetch(`/api/onboarding-requests/${id}/approve`, { method: "POST" });
}

/**
 * Reject an onboarding request (admin only).
 * @param {string} id
 * @param {string} [reason]
 */
export function rejectOnboardingRequest(id, reason) {
  return apiFetch(`/api/onboarding-requests/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

/**
 * Assign a reviewer to an onboarding request (admin only).
 * @param {string} id
 * @param {string} reviewerId
 */
export function assignReviewer(id, reviewerId) {
  return apiFetch(`/api/onboarding-requests/${id}/assign`, {
    method: "PATCH",
    body: JSON.stringify({ reviewerId }),
  });
}
