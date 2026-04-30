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

const EMPTY_SCRAPED_METADATA = {
  'First Name': null,
  'Middle Name or Initial': null,
  'Last Name': null,
  'Military Unit': null,
  'Regiment Number': null,
  'Regiment State': '',
  Branch: '',
  Company: '',
  Age: null,
  'Year Born': null,
  Transcript: '',
  Confidence: 0,
  Source: '',
  Other: {},
};

const STRUCTURED_METADATA_KEYS = Object.keys(EMPTY_SCRAPED_METADATA);

const hasStructuredMetadata = (value) =>
  value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  STRUCTURED_METADATA_KEYS.some((key) => Object.prototype.hasOwnProperty.call(value, key));

const hasValue = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed !== '' && trimmed.toLowerCase() !== 'null';
  }
  return true;
};

const valueOrFallback = (value, fallback) => (hasValue(value) ? value : fallback);

const splitName = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: null, middleName: null, lastName: null };
  }
  if (parts.length === 1) {
    return { firstName: null, middleName: null, lastName: parts[0] };
  }
  return {
    firstName: parts[0],
    middleName: parts.length > 2 ? parts.slice(1, -1).join(' ') : null,
    lastName: parts[parts.length - 1],
  };
};

const buildScrapedMetadata = (row) => {
  const parsedNotes = parsePhotoNotes(row.photo_notes);
  const { firstName, middleName, lastName } = splitName(row.name);

  if (hasStructuredMetadata(parsedNotes)) {
    const other =
      parsedNotes.Other && typeof parsedNotes.Other === 'object' && !Array.isArray(parsedNotes.Other)
        ? parsedNotes.Other
        : {};

    return {
      ...EMPTY_SCRAPED_METADATA,
      ...parsedNotes,
      'First Name': valueOrFallback(parsedNotes['First Name'], firstName),
      'Middle Name or Initial': valueOrFallback(parsedNotes['Middle Name or Initial'], middleName),
      'Last Name': valueOrFallback(parsedNotes['Last Name'], lastName),
      'Military Unit': valueOrFallback(parsedNotes['Military Unit'], row.regiment),
      Age: valueOrFallback(parsedNotes.Age, row.age),
      Source: valueOrFallback(parsedNotes.Source, other['Source URL'] || other.Source || ''),
      Other: other,
    };
  }

  return {
    ...EMPTY_SCRAPED_METADATA,
    'First Name': firstName,
    'Middle Name or Initial': middleName,
    'Last Name': lastName,
    'Military Unit': row.regiment,
    Age: row.age,
    Transcript: parsedNotes.Transcript || parsedNotes.descri || parsedNotes.Notes || '',
    Source: parsedNotes['Source URL'] || parsedNotes.Source || '',
    Other: parsedNotes,
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

const normalizeImageUrl = (value) => {
  if (!value || typeof value !== 'string') return '';
  try {
    const url = new URL(value.trim());
    url.hash = '';
    for (const key of ['token', 'expires', 'signature', 'download', 'dl']) {
      url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return value.trim();
  }
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
      scrapeJobId, submittedBy, imageUrl: normalizeImageUrl(imageUrl),
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

/** Return an existing photo for this user and image URL, or null. */
export const findPhotoByImageUrl = async ({ submittedBy, imageUrl }) => {
  const normalized = normalizeImageUrl(imageUrl);
  if (!submittedBy || !normalized) return null;

  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .eq('submitted_by', submittedBy)
    .eq('image_url', normalized)
    .order('created_at', { ascending: true })
    .limit(1);

  if (error) return null;
  return fromDb(data?.[0] ?? null);
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
