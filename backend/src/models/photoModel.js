/**
 * photoModel.js
 * -------------
 * Supabase-backed store for Photo objects.
 *
 * Table: photos
 * Columns: id (uuid pk), scrape_job_id, submitted_by, image_url, status,
 *          is_duplicate, duplicate_of_id, is_auto_extracted,
 *          metadata_edited_by, metadata_edited_at,
 *          name, regiment, age, date_taken, location, photographer,
 *          collection, photo_notes, tags (text[]), license,
 *          created_at, updated_at
 */

import { supabase } from '../config/supabase.js';

// ---------------------------------------------------------------------------
// Column mapping helpers
// ---------------------------------------------------------------------------

const toDb = (obj) => ({
  ...(obj.scrapeJobId        !== undefined && { scrape_job_id:       obj.scrapeJobId }),
  ...(obj.submittedBy        !== undefined && { submitted_by:        obj.submittedBy }),
  ...(obj.imageUrl           !== undefined && { image_url:           obj.imageUrl }),
  ...(obj.status             !== undefined && { status:              obj.status }),
  ...(obj.isDuplicate        !== undefined && { is_duplicate:        obj.isDuplicate }),
  ...(obj.duplicateOfId      !== undefined && { duplicate_of_id:     obj.duplicateOfId }),
  ...(obj.isAutoExtracted    !== undefined && { is_auto_extracted:   obj.isAutoExtracted }),
  ...(obj.metadataEditedBy   !== undefined && { metadata_edited_by:  obj.metadataEditedBy }),
  ...(obj.metadataEditedAt   !== undefined && { metadata_edited_at:  obj.metadataEditedAt }),
  ...(obj.name               !== undefined && { name:                obj.name }),
  ...(obj.regiment           !== undefined && { regiment:            obj.regiment }),
  ...(obj.age                !== undefined && { age:                 obj.age }),
  ...(obj.dateTaken          !== undefined && { date_taken:          obj.dateTaken }),
  ...(obj.location           !== undefined && { location:            obj.location }),
  ...(obj.photographer       !== undefined && { photographer:        obj.photographer }),
  ...(obj.collection         !== undefined && { collection:          obj.collection }),
  ...(obj.photoNotes         !== undefined && { photo_notes:         obj.photoNotes }),
  ...(obj.tags               !== undefined && { tags:                obj.tags }),
  ...(obj.license            !== undefined && { license:             obj.license }),
});

const parsePhotoNotes = (value) => {
  if (!value || typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return { Notes: value };
  }
};

const buildScrapedMetadata = (row) => {
  const other = parsePhotoNotes(row.photo_notes);
  const nameParts = String(row.name || '').trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts.length > 1 ? nameParts[0] : null;
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : (row.name || null);

  return {
    'First Name': firstName,
    'Middle Name or Initial': null,
    'Last Name': lastName,
    'Military Unit': row.regiment,
    'Regiment Number': null,
    'Regiment State': '',
    Branch: '',
    Company: '',
    Age: row.age,
    'Year Born': null,
    Transcript: other.Transcript || other.descri || other.Notes || '',
    Confidence: 0,
    Source: other['Source URL'] || other.Source || '',
    Other: other,
  };
};

const fromDb = (row) => {
  if (!row) return null;
  const scrapedMetadata = buildScrapedMetadata(row);
  return {
    id:               row.id,
    scrapeJobId:      row.scrape_job_id,
    submittedBy:      row.submitted_by,
    imageUrl:         row.image_url,
    status:           row.status,
    isDuplicate:      row.is_duplicate,
    duplicateOfId:    row.duplicate_of_id,
    isAutoExtracted:  row.is_auto_extracted,
    metadataEditedBy: row.metadata_edited_by,
    metadataEditedAt: row.metadata_edited_at,
    name:             row.name,
    regiment:         row.regiment,
    age:              row.age,
    dateTaken:        row.date_taken,
    location:         row.location,
    photographer:     row.photographer,
    collection:       row.collection,
    photoNotes:       row.photo_notes,
    tags:             row.tags ?? [],
    license:          row.license,
    scrapedMetadata,
    metadataJson:      scrapedMetadata,
    createdAt:        row.created_at,
    updatedAt:        row.updated_at,
  };
};

// ---------------------------------------------------------------------------
// CRUD helpers
// ---------------------------------------------------------------------------

/** Create and persist a new photo. Returns the stored object. */
export const createPhoto = async ({
  scrapeJobId,
  submittedBy,
  imageUrl,
  name         = null,
  regiment     = null,
  age          = null,
  dateTaken    = null,
  location     = null,
  photographer = null,
  collection   = null,
  photoNotes   = null,
  tags         = [],
  license      = null,
  isAutoExtracted = true,
}) => {
  const { data, error } = await supabase
    .from('photos')
    .insert([toDb({
      scrapeJobId, submittedBy, imageUrl,
      status: 'pending_review',
      isDuplicate: false, duplicateOfId: null,
      isAutoExtracted, metadataEditedBy: null, metadataEditedAt: null,
      name, regiment, age, dateTaken, location, photographer,
      collection, photoNotes, tags: Array.isArray(tags) ? tags : [], license,
    })])
    .select()
    .single();

  if (error) throw error;
  return fromDb(data);
};

/** Return a photo by id, or null. */
export const findPhotoById = async (id) => {
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) return null;
  return fromDb(data);
};

/**
 * Return photos with optional filters and pagination.
 *
 * @param {object} opts
 * @param {string}  [opts.submittedBy]   – filter to this user's photos
 * @param {string}  [opts.scrapeJobId]   – filter by parent scrape job
 * @param {string}  [opts.status]        – filter by status
 * @param {boolean} [opts.isDuplicate]   – filter by duplicate flag
 * @param {string[]}[opts.tags]          – filter: photo must have ALL of these tags
 * @param {number}  [opts.page]          – 1-based (default 1)
 * @param {number}  [opts.limit]         – (default 20, max 100)
 */
export const findPhotos = async ({
  submittedBy,
  scrapeJobId,
  status,
  isDuplicate,
  tags,
  page  = 1,
  limit = 20,
} = {}) => {
  const safeLimit = Math.min(Math.max(1, limit), 100);
  const safePage  = Math.max(1, page);

  let query = supabase.from('photos').select('*', { count: 'exact' });

  if (submittedBy !== undefined) query = query.eq('submitted_by', submittedBy);
  if (scrapeJobId !== undefined) query = query.eq('scrape_job_id', scrapeJobId);
  if (status      !== undefined) query = query.eq('status', status);
  if (isDuplicate !== undefined) query = query.eq('is_duplicate', isDuplicate);
  if (tags && tags.length)       query = query.contains('tags', tags);

  query = query.range((safePage - 1) * safeLimit, safePage * safeLimit - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  return { data: (data ?? []).map(fromDb), total: count ?? 0, page: safePage, limit: safeLimit };
};

/**
 * Partially update a photo.
 * Returns the updated photo, or null if not found.
 */
export const updatePhoto = async (id, updates) => {
  const { data, error } = await supabase
    .from('photos')
    .update(toDb(updates))
    .eq('id', id)
    .select()
    .single();

  if (error) return null;
  return fromDb(data);
};
