/**
 * onboardingRequestModel.js
 * -------------------------
 * Supabase-backed store for OnboardingRequest objects.
 *
 * Table: onboarding_requests
 * Columns: id (uuid pk), onboarding_request_title, onboarding_request_notes,
 *          submitted_by, status, photo_ids (uuid[]), has_received_suggestions,
 *          reviewer_id, reviewed_by, reviewed_at, admin_note,
 *          suggestion_ids (uuid[]), created_at, updated_at
 */

import { supabase } from '../config/supabase.js';

// ---------------------------------------------------------------------------
// Column mapping helpers
// ---------------------------------------------------------------------------

const toDb = (obj) => ({
  ...(obj.onboardingRequestTitle  !== undefined && { onboarding_request_title:  obj.onboardingRequestTitle }),
  ...(obj.onboardingRequestNotes  !== undefined && { onboarding_request_notes:  obj.onboardingRequestNotes }),
  ...(obj.submittedBy             !== undefined && { submitted_by:              obj.submittedBy }),
  ...(obj.status                  !== undefined && { status:                    obj.status }),
  ...(obj.photoIds                !== undefined && { photo_ids:                 obj.photoIds }),
  ...(obj.hasReceivedSuggestions  !== undefined && { has_received_suggestions:  obj.hasReceivedSuggestions }),
  ...(obj.reviewerId              !== undefined && { reviewer_id:               obj.reviewerId }),
  ...(obj.reviewedBy              !== undefined && { reviewed_by:               obj.reviewedBy }),
  ...(obj.reviewedAt              !== undefined && { reviewed_at:               obj.reviewedAt }),
  ...(obj.adminNote               !== undefined && { admin_note:                obj.adminNote }),
  ...(obj.suggestionIds           !== undefined && { suggestion_ids:            obj.suggestionIds }),
});

const fromDb = (row) => {
  if (!row) return null;
  return {
    id:                     row.id,
    onboardingRequestTitle: row.onboarding_request_title,
    onboardingRequestNotes: row.onboarding_request_notes,
    submittedBy:            row.submitted_by,
    status:                 row.status,
    photoIds:               row.photo_ids ?? [],
    hasReceivedSuggestions: row.has_received_suggestions,
    reviewerId:             row.reviewer_id,
    reviewedBy:             row.reviewed_by,
    reviewedAt:             row.reviewed_at,
    adminNote:              row.admin_note,
    suggestionIds:          row.suggestion_ids ?? [],
    createdAt:              row.created_at,
    updatedAt:              row.updated_at,
  };
};

// ---------------------------------------------------------------------------
// CRUD helpers
// ---------------------------------------------------------------------------

/** Create and persist a new onboarding request. */
export const createOnboardingRequest = async ({
  onboardingRequestTitle,
  onboardingRequestNotes = null,
  submittedBy,
  photoIds = [],
}) => {
  const { data, error } = await supabase
    .from('onboarding_requests')
    .insert([toDb({
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
    })])
    .select()
    .single();

  if (error) throw error;
  return fromDb(data);
};

/** Return a request by id, or null. */
export const findOnboardingRequestById = async (id) => {
  const { data, error } = await supabase
    .from('onboarding_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) return null;
  return fromDb(data);
};

/**
 * Return requests with optional filters and pagination.
 */
export const findOnboardingRequests = async ({
  submittedBy,
  status,
  reviewerId,
  page  = 1,
  limit = 20,
} = {}) => {
  const safeLimit = Math.min(Math.max(1, limit), 100);
  const safePage  = Math.max(1, page);

  let query = supabase
    .from('onboarding_requests')
    .select('*', { count: 'exact' });

  if (submittedBy !== undefined) query = query.eq('submitted_by', submittedBy);
  if (status      !== undefined) query = query.eq('status', status);
  if (reviewerId  !== undefined) query = query.eq('reviewer_id', reviewerId);

  query = query
    .order('created_at', { ascending: false })
    .range((safePage - 1) * safeLimit, safePage * safeLimit - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  return { data: (data ?? []).map(fromDb), total: count ?? 0, page: safePage, limit: safeLimit };
};

/**
 * Partially update a request.
 * Returns the updated request, or null if not found.
 */
export const updateOnboardingRequest = async (id, updates) => {
  const { data, error } = await supabase
    .from('onboarding_requests')
    .update(toDb(updates))
    .eq('id', id)
    .select()
    .single();

  if (error) return null;
  return fromDb(data);
};

/** Delete a request by id. Returns true if deleted, false if not found. */
export const deleteOnboardingRequest = async (id) => {
  const { error } = await supabase
    .from('onboarding_requests')
    .delete()
    .eq('id', id);

  return !error;
};
