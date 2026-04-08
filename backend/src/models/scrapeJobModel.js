/**
 * scrapeJobModel.js
 * -----------------
 * Supabase-backed store for ScrapedResult (scrape job) objects.
 *
 * Table: scrape_jobs
 * Columns: id (uuid pk), url, max_photos, status, submitted_by,
 *          photo_count, error_message, started_at, completed_at, created_at, updated_at
 */

import { supabase } from '../config/supabase.js';

const jobErrorMessages = new Map();

// ---------------------------------------------------------------------------
// Column mapping helpers
// ---------------------------------------------------------------------------

const toDb = (obj) => ({
  ...(obj.url         !== undefined && { url:          obj.url }),
  ...(obj.maxPhotos   !== undefined && { max_photos:   obj.maxPhotos }),
  ...(obj.status      !== undefined && { status:       obj.status }),
  ...(obj.submittedBy !== undefined && { submitted_by: obj.submittedBy }),
  ...(obj.photoCount  !== undefined && { photo_count:  obj.photoCount }),
  ...(obj.errorMessage !== undefined && { error_message: obj.errorMessage }),
  ...(obj.startedAt   !== undefined && { started_at:   obj.startedAt }),
  ...(obj.completedAt !== undefined && { completed_at: obj.completedAt }),
});

const fromDb = (row) => {
  if (!row) return null;
  return {
    id:          row.id,
    url:         row.url,
    maxPhotos:   row.max_photos,
    status:      row.status,
    submittedBy: row.submitted_by,
    photoCount:  row.photo_count,
    errorMessage: row.error_message ?? jobErrorMessages.get(row.id) ?? null,
    startedAt:   row.started_at,
    completedAt: row.completed_at,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  };
};

// ---------------------------------------------------------------------------
// CRUD helpers
// ---------------------------------------------------------------------------

export const createScrapeJob = async ({ url, maxPhotos = 50, submittedBy }) => {
  const { data, error } = await supabase
    .from('scrape_jobs')
    .insert([toDb({
      url,
      maxPhotos:   Math.min(Number(maxPhotos) || 50, 500),
      status:      'queued',
      submittedBy,
      photoCount:  0,
      startedAt:   null,
      completedAt: null,
    })])
    .select()
    .single();

  if (error) throw error;
  return fromDb(data);
};

export const findScrapeJobById = async (id) => {
  const { data, error } = await supabase
    .from('scrape_jobs')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) return null;
  return fromDb(data);
};

export const findScrapeJobs = async ({
  submittedBy = null,
  status      = null,
  page        = 1,
  limit       = 20,
} = {}) => {
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const safePage  = Math.max(1, Number(page) || 1);

  let query = supabase
    .from('scrape_jobs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (submittedBy) query = query.eq('submitted_by', submittedBy);
  if (status)      query = query.eq('status', status);

  query = query.range((safePage - 1) * safeLimit, safePage * safeLimit - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  return { data: (data ?? []).map(fromDb), total: count ?? 0, page: safePage, limit: safeLimit };
};

export const updateScrapeJob = async (id, updates) => {
  const changes = toDb(updates);
  if (Object.prototype.hasOwnProperty.call(updates, 'errorMessage')) {
    if (updates.errorMessage) {
      jobErrorMessages.set(id, updates.errorMessage);
    } else {
      jobErrorMessages.delete(id);
    }
  }

  const { data, error } = await supabase
    .from('scrape_jobs')
    .update(changes)
    .eq('id', id)
    .select()
    .single();

  if (error && Object.prototype.hasOwnProperty.call(changes, 'error_message')) {
    const { error_message, ...withoutErrorMessage } = changes;
    const { data: retryData, error: retryError } = await supabase
      .from('scrape_jobs')
      .update(withoutErrorMessage)
      .eq('id', id)
      .select()
      .single();

    if (retryError) return null;
    return fromDb(retryData);
  }

  if (error) return null;
  return fromDb(data);
};

/** Returns total count — used by Admin dashboard stats. */
export const countScrapeJobs = async () => {
  const { count, error } = await supabase
    .from('scrape_jobs')
    .select('*', { count: 'exact', head: true });

  if (error) throw error;
  return count ?? 0;
};
