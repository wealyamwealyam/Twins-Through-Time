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

const DEFAULT_METADATA = Object.freeze({
  "First Name": "",
  "Middle Name or Initial": "",
  "Last Name": "",
  "Military Unit": "",
  "Regiment Number": "",
  "Regiment State": "",
  "Branch": "",
  "Company": "",
  "Age": 0,
  "Year Born": 0,
  "Transcript": "",
  "Confidence": 0.0,
  "Source": "",
  "Other": {},
});

const cloneDefaultMetadata = () =>
  JSON.parse(JSON.stringify(DEFAULT_METADATA));

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const normalizeMetadata = (value) => {
  const base = cloneDefaultMetadata();

  if (!isPlainObject(value)) return base;

  return {
    ...base,
    ...value,
    Other: isPlainObject(value.Other) ? value.Other : {},
  };
};

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
  ...(obj.metadata !== undefined && { metadata: normalizeMetadata(obj.metadata) }),
});

const fromDb = (row) => {
  if (!row) return null;
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
    createdAt:        row.created_at,
    updatedAt:        row.updated_at,
    metadata:         normalizeMetadata(row.metadata),
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
  metadata = undefined,
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
      metadata: metadata === undefined ? cloneDefaultMetadata() : normalizeMetadata(metadata),
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
