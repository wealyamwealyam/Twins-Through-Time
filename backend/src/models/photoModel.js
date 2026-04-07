/**
 * photoModel.js
 * -------------
 * In-memory store for Photo objects.
 * Replace with a real DB (Prisma / Mongoose) when one is connected.
 *
 * Photo shape:
 * {
 *   id                : uuid
 *   scrapeJobId       : uuid          – parent scrape job
 *   submittedBy       : uuid          – user who ran the scrape job
 *   imageUrl          : string        – original source URL of the image
 *   status            : 'pending_review' | 'reviewed' | 'rejected'
 *   isDuplicate       : boolean
 *   duplicateOfId     : uuid | null
 *   isAutoExtracted   : boolean       – false once metadata is manually edited
 *   metadataEditedBy  : uuid | null
 *   metadataEditedAt  : ISO  | null
 *   // metadata fields (all nullable)
 *   name              : string | null
 *   regiment          : string | null
 *   age               : string | null  (stored as string per the API spec)
 *   dateTaken         : string | null
 *   location          : string | null
 *   photographer      : string | null
 *   collection        : string | null
 *   photoNotes        : string | null
 *   tags              : string[]
 *   license           : string | null
 *   createdAt         : ISO
 *   updatedAt         : ISO
 * }
 */

import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------
const photos = new Map(); // key: uuid → Photo

// ---------------------------------------------------------------------------
// CRUD helpers
// ---------------------------------------------------------------------------

/** Create and persist a new photo. Returns the stored object. */
export const createPhoto = ({
  scrapeJobId,
  submittedBy,
  imageUrl,
  name        = null,
  regiment    = null,
  age         = null,
  dateTaken   = null,
  location    = null,
  photographer= null,
  collection  = null,
  photoNotes  = null,
  tags        = [],
  license     = null,
  isAutoExtracted = true,
}) => {
  const now = new Date().toISOString();
  const photo = {
    id: randomUUID(),
    scrapeJobId,
    submittedBy,
    imageUrl,
    status: 'pending_review',
    isDuplicate: false,
    duplicateOfId: null,
    isAutoExtracted,
    metadataEditedBy: null,
    metadataEditedAt: null,
    name,
    regiment,
    age,
    dateTaken,
    location,
    photographer,
    collection,
    photoNotes,
    tags: Array.isArray(tags) ? tags : [],
    license,
    createdAt: now,
    updatedAt: now,
  };
  photos.set(photo.id, photo);
  return photo;
};

/** Return a photo by id, or null. */
export const findPhotoById = (id) => photos.get(id) ?? null;

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
export const findPhotos = ({
  submittedBy,
  scrapeJobId,
  status,
  isDuplicate,
  tags,
  page  = 1,
  limit = 20,
} = {}) => {
  let all = [...photos.values()];

  if (submittedBy !== undefined) all = all.filter((p) => p.submittedBy === submittedBy);
  if (scrapeJobId  !== undefined) all = all.filter((p) => p.scrapeJobId  === scrapeJobId);
  if (status       !== undefined) all = all.filter((p) => p.status       === status);
  if (isDuplicate  !== undefined) all = all.filter((p) => p.isDuplicate  === isDuplicate);
  if (tags && tags.length)        all = all.filter((p) => tags.every((t) => p.tags.includes(t)));

  const total      = all.length;
  const safeLimit  = Math.min(Math.max(1, limit), 100);
  const safePage   = Math.max(1, page);
  const data       = all.slice((safePage - 1) * safeLimit, safePage * safeLimit);

  return { data, total, page: safePage, limit: safeLimit };
};

/**
 * Partially update a photo.
 * Returns the updated photo, or null if not found.
 */
export const updatePhoto = (id, updates) => {
  const existing = photos.get(id);
  if (!existing) return null;
  const updated = {
    ...existing,
    ...updates,
    id,
    updatedAt: new Date().toISOString(),
  };
  photos.set(id, updated);
  return updated;
};
