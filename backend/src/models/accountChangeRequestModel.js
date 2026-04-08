/**
 * accountChangeRequestModel.js
 * ----------------------------
 * Supabase-backed store for AccountChangeRequest objects.
 *
 * Table: account_change_requests
 * Columns: id (uuid pk), user_id, current_account, requesting_account,
 *          reason_message, status, admin_note, reviewed_by, reviewed_at,
 *          created_at, updated_at
 */

import { supabase } from '../config/supabase.js';

// ---------------------------------------------------------------------------
// Column mapping helpers
// ---------------------------------------------------------------------------

const toDb = (obj) => ({
  ...(obj.userId             !== undefined && { user_id:            obj.userId }),
  ...(obj.currentAccount     !== undefined && { current_account:    obj.currentAccount }),
  ...(obj.requestingAccount  !== undefined && { requesting_account: obj.requestingAccount }),
  ...(obj.reasonMessage      !== undefined && { reason_message:     obj.reasonMessage }),
  ...(obj.status             !== undefined && { status:             obj.status }),
  ...(obj.adminNote          !== undefined && { admin_note:         obj.adminNote }),
  ...(obj.reviewedBy         !== undefined && { reviewed_by:        obj.reviewedBy }),
  ...(obj.reviewedAt         !== undefined && { reviewed_at:        obj.reviewedAt }),
});

const fromDb = (row) => {
  if (!row) return null;
  return {
    id:                row.id,
    userId:            row.user_id,
    currentAccount:    row.current_account,
    requestingAccount: row.requesting_account,
    reasonMessage:     row.reason_message,
    status:            row.status,
    adminNote:         row.admin_note,
    reviewedBy:        row.reviewed_by,
    reviewedAt:        row.reviewed_at,
    createdAt:         row.created_at,
    updatedAt:         row.updated_at,
  };
};

// ---------------------------------------------------------------------------
// CRUD helpers
// ---------------------------------------------------------------------------

/** Create and persist a new request. Returns the stored object. */
export const createRequest = async ({
  userId,
  currentAccount,
  requestingAccount,
  reasonMessage,
}) => {
  const { data, error } = await supabase
    .from('account_change_requests')
    .insert([toDb({
      userId, currentAccount, requestingAccount, reasonMessage,
      status: 'pending', adminNote: null, reviewedBy: null, reviewedAt: null,
    })])
    .select()
    .single();

  if (error) throw error;
  return fromDb(data);
};

/** Return a request by id, or null. */
export const findRequestById = async (id) => {
  const { data, error } = await supabase
    .from('account_change_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) return null;
  return fromDb(data);
};

/**
 * Return all requests, with optional status filter and pagination.
 */
export const findAllRequests = async ({ status, page = 1, limit = 20 } = {}) => {
  const safeLimit = Math.min(Math.max(1, limit), 100);
  const safePage  = Math.max(1, page);

  let query = supabase
    .from('account_change_requests')
    .select('*', { count: 'exact' });

  if (status) query = query.eq('status', status);

  query = query.range((safePage - 1) * safeLimit, safePage * safeLimit - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  return { data: (data ?? []).map(fromDb), total: count ?? 0, page: safePage, limit: safeLimit };
};

/** Return all requests belonging to a specific user. */
export const findRequestsByUserId = async (userId) => {
  const { data, error } = await supabase
    .from('account_change_requests')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;
  return (data ?? []).map(fromDb);
};

/**
 * Partially update a request.
 * Returns the updated request, or null if not found.
 */
export const updateRequest = async (id, updates) => {
  const { data, error } = await supabase
    .from('account_change_requests')
    .update(toDb(updates))
    .eq('id', id)
    .select()
    .single();

  if (error) return null;
  return fromDb(data);
};
