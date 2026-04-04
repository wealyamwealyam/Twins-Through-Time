/**
 * onboardingRequestModel.js
 * -------------------------
 * In-memory store for OnboardingRequest objects.
 * Replace with a real DB (Prisma / Mongoose) when one is connected.
 *
 * OnboardingRequest shape:
 * {
 *   id                      : uuid
 *   onboardingRequestTitle  : string
 *   onboardingRequestNotes  : string | null
 *   submittedBy             : uuid          – user who created the request
 *   status                  : 'pending' | 'under_review' | 'approved' | 'rejected' | 'onboarded'
 *   photoIds                : uuid[]        – ordered list of photo ids in this request
 *   hasReceivedSuggestions  : boolean
 *   reviewerId              : uuid | null   – admin assigned to review
 *   reviewedBy              : uuid | null   – admin who approved/rejected
 *   reviewedAt              : ISO   | null
 *   adminNote               : string | null
 *   suggestionIds           : uuid[]        – ids of OnboardingRequestSuggestion objects
 *   createdAt               : ISO
 *   updatedAt               : ISO
 * }
 */

import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------
const onboardingRequests = new Map(); // key: uuid → OnboardingRequest

// ---------------------------------------------------------------------------
// CRUD helpers
// ---------------------------------------------------------------------------

/** Create and persist a new onboarding request. */
export const createOnboardingRequest = ({
  onboardingRequestTitle,
  onboardingRequestNotes = null,
  submittedBy,
  photoIds = [],
}) => {
  const now = new Date().toISOString();
  const req = {
    id: randomUUID(),
    onboardingRequestTitle,
    onboardingRequestNotes,
    submittedBy,
    status: 'pending',
    photoIds: [...photoIds],
    hasReceivedSuggestions: false,
    reviewerId: null,
    reviewedBy: null,
    reviewedAt: null,
    adminNote: null,
    suggestionIds: [],
    createdAt: now,
    updatedAt: now,
  };
  onboardingRequests.set(req.id, req);
  return req;
};

/** Return a request by id, or null. */
export const findOnboardingRequestById = (id) =>
  onboardingRequests.get(id) ?? null;

/**
 * Return requests with optional filters and pagination.
 *
 * @param {object} opts
 * @param {string}   [opts.submittedBy]  – filter to this user's requests
 * @param {string}   [opts.status]       – filter by status
 * @param {string}   [opts.reviewerId]   – filter by assigned reviewer
 * @param {number}   [opts.page]         – 1-based (default 1)
 * @param {number}   [opts.limit]        – (default 20, max 100)
 */
export const findOnboardingRequests = ({
  submittedBy,
  status,
  reviewerId,
  page  = 1,
  limit = 20,
} = {}) => {
  let all = [...onboardingRequests.values()];

  if (submittedBy !== undefined) all = all.filter((r) => r.submittedBy === submittedBy);
  if (status      !== undefined) all = all.filter((r) => r.status      === status);
  if (reviewerId  !== undefined) all = all.filter((r) => r.reviewerId  === reviewerId);

  const total     = all.length;
  const safeLimit = Math.min(Math.max(1, limit), 100);
  const safePage  = Math.max(1, page);
  const data      = all.slice((safePage - 1) * safeLimit, safePage * safeLimit);

  return { data, total, page: safePage, limit: safeLimit };
};

/**
 * Partially update a request.
 * Returns the updated request, or null if not found.
 */
export const updateOnboardingRequest = (id, updates) => {
  const existing = onboardingRequests.get(id);
  if (!existing) return null;
  const updated = {
    ...existing,
    ...updates,
    id,
    updatedAt: new Date().toISOString(),
  };
  onboardingRequests.set(id, updated);
  return updated;
};

/** Delete a request by id. Returns true if deleted, false if not found. */
export const deleteOnboardingRequest = (id) => {
  if (!onboardingRequests.has(id)) return false;
  onboardingRequests.delete(id);
  return true;
};
