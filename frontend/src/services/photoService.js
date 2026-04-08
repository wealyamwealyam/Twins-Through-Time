/**
 * photoService.js
 * ---------------
 * Wraps the §5 Photos API endpoints.
 */

import { apiFetch } from "./api.js";

/**
 * List photos with optional filters and pagination.
 * @param {{ scrapeJobId?, status?, isDuplicate?, tags?, page?, limit? }} params
 */
export async function getPhotos({
  scrapeJobId,
  status,
  isDuplicate,
  tags,
  page  = 1,
  limit = 20,
} = {}) {
  const qs = new URLSearchParams();
  if (scrapeJobId !== undefined) qs.set("scrapeJobId", scrapeJobId);
  if (status      !== undefined) qs.set("status",      status);
  if (isDuplicate !== undefined) qs.set("isDuplicate",  String(isDuplicate));
  if (tags?.length)              qs.set("tags",         tags.join(","));
  qs.set("page",  String(page));
  qs.set("limit", String(limit));
  return apiFetch(`/api/photos?${qs}`);
}

/**
 * Fetch a single photo by id.
 * @param {string} id
 */
export async function getPhoto(id) {
  return apiFetch(`/api/photos/${id}`);
}

/**
 * Update editable metadata fields on a photo.
 * @param {string} id
 * @param {{ name?, regiment?, age?, dateTaken?, location?, photographer?, collection?, photoNotes?, tags?, license? }} updates
 */
export async function updatePhotoMetadata(id, updates) {
  return apiFetch(`/api/photos/${id}`, {
    method: "PATCH",
    body:   JSON.stringify(updates),
  });
}

/**
 * Update a photo's status.
 * @param {string} id
 * @param {'pending_review'|'reviewed'|'rejected'} status
 */
export async function updatePhotoStatus(id, status) {
  return apiFetch(`/api/photos/${id}/status`, {
    method: "PATCH",
    body:   JSON.stringify({ status }),
  });
}
