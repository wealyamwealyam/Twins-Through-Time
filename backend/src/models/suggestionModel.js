/**
 * suggestionModel.js
 * ------------------
 * In-memory store for OnboardingRequestSuggestion and SuggestedPhotoEdit objects.
 * Replace with a real DB (Prisma / Mongoose) when one is connected.
 *
 * OnboardingRequestSuggestion shape:
 * {
 *   id                    : uuid
 *   onboardingRequestId   : uuid
 *   reviewerId            : uuid          – admin who created the suggestion
 *   onboardingRequestNote : string | null – overall note for the request
 *   photoEditIds          : uuid[]        – ordered list of SuggestedPhotoEdit ids
 *   createdAt             : ISO
 * }
 *
 * SuggestedPhotoEdit shape:
 * {
 *   id              : uuid
 *   suggestionId    : uuid
 *   originalPhotoId : uuid
 *   suggestedName   : string | null
 *   suggestedRegiment : string | null
 *   suggestedTags   : string[] | null
 *   suggestedNotes  : string | null
 *   appliedAt       : ISO    | null
 *   appliedBy       : uuid   | null
 *   responderNote   : string | null   – submitter's response note
 * }
 */

import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// In-memory stores
// ---------------------------------------------------------------------------
const suggestions = new Map(); // key: uuid → OnboardingRequestSuggestion
const photoEdits  = new Map(); // key: uuid → SuggestedPhotoEdit

// ---------------------------------------------------------------------------
// Suggestion CRUD
// ---------------------------------------------------------------------------

/**
 * Create a suggestion (with its nested photoEdits) in one call.
 *
 * @param {object} opts
 * @param {string}   opts.onboardingRequestId
 * @param {string}   opts.reviewerId
 * @param {string}   [opts.onboardingRequestNote]
 * @param {Array}    [opts.photoEdits]  – raw edit objects from the request body
 */
export const createSuggestion = ({
  onboardingRequestId,
  reviewerId,
  onboardingRequestNote = null,
  photoEdits: rawEdits  = [],
}) => {
  const now = new Date().toISOString();

  // Create each SuggestedPhotoEdit first so we have their ids
  const editIds = rawEdits.map((edit) => {
    const e = {
      id: randomUUID(),
      suggestionId: null,        // filled in below after suggestion id is known
      originalPhotoId: edit.originalPhotoId,
      suggestedName:     edit.suggestedName     ?? null,
      suggestedRegiment: edit.suggestedRegiment ?? null,
      suggestedTags:     edit.suggestedTags     ?? null,
      suggestedNotes:    edit.suggestedNotes    ?? null,
      appliedAt:   null,
      appliedBy:   null,
      responderNote: null,
    };
    photoEdits.set(e.id, e);
    return e.id;
  });

  const suggestion = {
    id: randomUUID(),
    onboardingRequestId,
    reviewerId,
    onboardingRequestNote,
    photoEditIds: editIds,
    createdAt: now,
  };
  suggestions.set(suggestion.id, suggestion);

  // Back-fill suggestionId on each edit
  editIds.forEach((eid) => {
    const e = photoEdits.get(eid);
    photoEdits.set(eid, { ...e, suggestionId: suggestion.id });
  });

  return suggestion;
};

/** Return a suggestion by id (with nested photoEdits hydrated), or null. */
export const findSuggestionById = (id) => {
  const s = suggestions.get(id);
  if (!s) return null;
  return hydrateSuggestion(s);
};

/** Return all suggestions for a given onboarding request (hydrated). */
export const findSuggestionsByRequestId = (onboardingRequestId) =>
  [...suggestions.values()]
    .filter((s) => s.onboardingRequestId === onboardingRequestId)
    .map(hydrateSuggestion);

/** Hydrate a suggestion: replace photoEditIds with full SuggestedPhotoEdit objects. */
const hydrateSuggestion = (s) => ({
  ...s,
  photoEdits: s.photoEditIds.map((id) => photoEdits.get(id)).filter(Boolean),
});

// ---------------------------------------------------------------------------
// SuggestedPhotoEdit CRUD
// ---------------------------------------------------------------------------

/** Return a single SuggestedPhotoEdit by id, or null. */
export const findPhotoEditById = (id) => photoEdits.get(id) ?? null;

/** Partially update a SuggestedPhotoEdit. Returns updated edit or null. */
export const updatePhotoEdit = (id, updates) => {
  const existing = photoEdits.get(id);
  if (!existing) return null;
  const updated = { ...existing, ...updates, id };
  photoEdits.set(id, updated);
  return updated;
};
