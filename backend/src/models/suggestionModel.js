/**
 * suggestionModel.js
 * ------------------
 * Supabase-backed store for OnboardingRequestSuggestion and SuggestedPhotoEdit objects.
 *
 * Tables:
 *   suggestions      – id, onboarding_request_id, reviewer_id,
 *                      onboarding_request_note, created_at
 *   suggested_photo_edits – id, suggestion_id, original_photo_id,
 *                           suggested_name, suggested_regiment, suggested_tags (text[]),
 *                           suggested_notes, applied_at, applied_by, responder_note
 */

import { supabase } from '../config/supabase.js';

// ---------------------------------------------------------------------------
// Column mapping helpers
// ---------------------------------------------------------------------------

const editToDb = (obj) => ({
  ...(obj.suggestionId      !== undefined && { suggestion_id:       obj.suggestionId }),
  ...(obj.originalPhotoId   !== undefined && { original_photo_id:   obj.originalPhotoId }),
  ...(obj.suggestedName     !== undefined && { suggested_name:      obj.suggestedName }),
  ...(obj.suggestedRegiment !== undefined && { suggested_regiment:  obj.suggestedRegiment }),
  ...(obj.suggestedTags     !== undefined && { suggested_tags:      obj.suggestedTags }),
  ...(obj.suggestedNotes    !== undefined && { suggested_notes:     obj.suggestedNotes }),
  ...(obj.appliedAt         !== undefined && { applied_at:          obj.appliedAt }),
  ...(obj.appliedBy         !== undefined && { applied_by:          obj.appliedBy }),
  ...(obj.responderNote     !== undefined && { responder_note:      obj.responderNote }),
});

const editFromDb = (row) => {
  if (!row) return null;
  return {
    id:               row.id,
    suggestionId:     row.suggestion_id,
    originalPhotoId:  row.original_photo_id,
    suggestedName:    row.suggested_name,
    suggestedRegiment:row.suggested_regiment,
    suggestedTags:    row.suggested_tags ?? null,
    suggestedNotes:   row.suggested_notes,
    appliedAt:        row.applied_at,
    appliedBy:        row.applied_by,
    responderNote:    row.responder_note,
  };
};

const suggestionFromDb = (row, edits = []) => {
  if (!row) return null;
  return {
    id:                   row.id,
    onboardingRequestId:  row.onboarding_request_id,
    reviewerId:           row.reviewer_id,
    onboardingRequestNote:row.onboarding_request_note,
    photoEdits:           edits,
    createdAt:            row.created_at,
  };
};

// ---------------------------------------------------------------------------
// Suggestion CRUD
// ---------------------------------------------------------------------------

/**
 * Create a suggestion (with its nested photoEdits) in one call.
 */
export const createSuggestion = async ({
  onboardingRequestId,
  reviewerId,
  onboardingRequestNote = null,
  photoEdits: rawEdits  = [],
}) => {
  // 1. Insert the suggestion
  const { data: sRow, error: sErr } = await supabase
    .from('suggestions')
    .insert([{ onboarding_request_id: onboardingRequestId, reviewer_id: reviewerId, onboarding_request_note: onboardingRequestNote }])
    .select()
    .single();

  if (sErr) throw sErr;

  // 2. Insert each photo edit linked to this suggestion
  let edits = [];
  if (rawEdits.length > 0) {
    const editRows = rawEdits.map((edit) => editToDb({
      suggestionId:      sRow.id,
      originalPhotoId:   edit.originalPhotoId,
      suggestedName:     edit.suggestedName     ?? null,
      suggestedRegiment: edit.suggestedRegiment ?? null,
      suggestedTags:     edit.suggestedTags     ?? null,
      suggestedNotes:    edit.suggestedNotes    ?? null,
      appliedAt:         null,
      appliedBy:         null,
      responderNote:     null,
    }));

    const { data: eRows, error: eErr } = await supabase
      .from('suggested_photo_edits')
      .insert(editRows)
      .select();

    if (eErr) throw eErr;
    edits = (eRows ?? []).map(editFromDb);
  }

  return suggestionFromDb(sRow, edits);
};

/** Return a suggestion by id (with nested photoEdits hydrated), or null. */
export const findSuggestionById = async (id) => {
  const { data: sRow, error: sErr } = await supabase
    .from('suggestions')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (sErr || !sRow) return null;

  const { data: eRows } = await supabase
    .from('suggested_photo_edits')
    .select('*')
    .eq('suggestion_id', id);

  return suggestionFromDb(sRow, (eRows ?? []).map(editFromDb));
};

/** Return all suggestions for a given onboarding request (hydrated). */
export const findSuggestionsByRequestId = async (onboardingRequestId) => {
  const { data: sRows, error: sErr } = await supabase
    .from('suggestions')
    .select('*')
    .eq('onboarding_request_id', onboardingRequestId);

  if (sErr) throw sErr;

  // Fetch all edits for these suggestions in one query
  const ids = (sRows ?? []).map((s) => s.id);
  if (ids.length === 0) return [];

  const { data: eRows } = await supabase
    .from('suggested_photo_edits')
    .select('*')
    .in('suggestion_id', ids);

  const editsBySuggestion = {};
  (eRows ?? []).forEach((e) => {
    if (!editsBySuggestion[e.suggestion_id]) editsBySuggestion[e.suggestion_id] = [];
    editsBySuggestion[e.suggestion_id].push(editFromDb(e));
  });

  return sRows.map((s) => suggestionFromDb(s, editsBySuggestion[s.id] ?? []));
};

// ---------------------------------------------------------------------------
// SuggestedPhotoEdit CRUD
// ---------------------------------------------------------------------------

/** Return a single SuggestedPhotoEdit by id, or null. */
export const findPhotoEditById = async (id) => {
  const { data, error } = await supabase
    .from('suggested_photo_edits')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) return null;
  return editFromDb(data);
};

/** Partially update a SuggestedPhotoEdit. Returns updated edit or null. */
export const updatePhotoEdit = async (id, updates) => {
  const { data, error } = await supabase
    .from('suggested_photo_edits')
    .update(editToDb(updates))
    .eq('id', id)
    .select()
    .single();

  if (error) return null;
  return editFromDb(data);
};
