/**
 * photoController.js
 * ------------------
 * Handlers for the Photos API (§5 in docs/apis.md).
 *
 * Routes (mounted at /api/photos):
 *   GET    /                     🔒  listPhotos
 *   GET    /:id                  🔒  getPhoto
 *   PATCH  /:id                  🔒  updatePhotoMetadata
 *   PATCH  /:id/status           🔒  updatePhotoStatus
 *   PATCH  /:id/duplicate        🔒  updatePhotoDuplicate
 *   GET    /:id/download         🔒  getDownloadUrl
 */

import {
  findPhotos,
  findPhotoById,
  updatePhoto,
} from '../models/photoModel.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const VALID_STATUSES   = ['pending_review', 'reviewed', 'rejected'];

/** Metadata fields the caller is allowed to set via PATCH /photos/:id */
const EDITABLE_META_FIELDS = [
  'name', 'regiment', 'age', 'dateTaken', 'location',
  'photographer', 'collection', 'photoNotes', 'tags', 'license',
];

// ---------------------------------------------------------------------------
// Shared error helper
// ---------------------------------------------------------------------------
const errBody = (code, message, details = null) => ({
  error: { code, message, details },
});

// ---------------------------------------------------------------------------
// GET /photos  🔒
// ---------------------------------------------------------------------------
export const listPhotos = async (req, res) => {
  const { scrapeJobId, status, isDuplicate, tags, page, limit } = req.query;
  const { id: userId, accountType } = req.user;

  // Validate status filter
  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json(
      errBody('VALIDATION_ERROR', `\`status\` must be one of: ${VALID_STATUSES.join(', ')}.`)
    );
  }

  // Admins see everything; other roles see only their own photos
  const submittedBy = accountType === 'admin' ? undefined : userId;

  // Parse isDuplicate boolean query param
  let dupFilter;
  if (isDuplicate !== undefined) {
    if (isDuplicate === 'true')       dupFilter = true;
    else if (isDuplicate === 'false') dupFilter = false;
    else return res.status(400).json(errBody('VALIDATION_ERROR', '`isDuplicate` must be true or false.'));
  }

  // Parse comma-separated tags
  const tagFilter = tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined;

  const result = await findPhotos({
    submittedBy,
    scrapeJobId: scrapeJobId || undefined,
    status:      status      || undefined,
    isDuplicate: dupFilter,
    tags:        tagFilter,
    page:        page  ? parseInt(page,  10) : 1,
    limit:       limit ? parseInt(limit, 10) : 20,
  });

  return res.status(200).json(result);
};

// ---------------------------------------------------------------------------
// GET /photos/:id  🔒
// ---------------------------------------------------------------------------
export const getPhoto = async (req, res) => {
  const photo = await findPhotoById(req.params.id);
  if (!photo) {
    return res.status(404).json(errBody('NOT_FOUND', 'Photo not found.'));
  }

  // Non-admins may only see their own photos
  if (req.user.accountType !== 'admin' && photo.submittedBy !== req.user.id) {
    return res.status(403).json(errBody('FORBIDDEN', 'You do not have permission to view this photo.'));
  }

  return res.status(200).json(photo);
};

// ---------------------------------------------------------------------------
// PATCH /photos/:id  🔒
// ---------------------------------------------------------------------------
export const updatePhotoMetadata = async (req, res) => {
  const photo = await findPhotoById(req.params.id);
  if (!photo) {
    return res.status(404).json(errBody('NOT_FOUND', 'Photo not found.'));
  }

  // Non-admins may only edit their own photos
  if (req.user.accountType !== 'admin' && photo.submittedBy !== req.user.id) {
    return res.status(403).json(errBody('FORBIDDEN', 'You do not have permission to edit this photo.'));
  }

  // Whitelist editable fields
  const updates = {};
  for (const field of EDITABLE_META_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      updates[field] = req.body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json(
      errBody('VALIDATION_ERROR', `No editable fields provided. Allowed: ${EDITABLE_META_FIELDS.join(', ')}.`)
    );
  }

  // Validate tags if provided
  if (updates.tags !== undefined) {
    if (!Array.isArray(updates.tags)) {
      return res.status(400).json(errBody('VALIDATION_ERROR', '`tags` must be an array of strings.'));
    }
    if (updates.tags.some((t) => typeof t !== 'string')) {
      return res.status(400).json(errBody('VALIDATION_ERROR', 'Each tag must be a string.'));
    }
  }

  // Record manual edit
  updates.isAutoExtracted   = false;
  updates.metadataEditedBy  = req.user.id;
  updates.metadataEditedAt  = new Date().toISOString();

  const updated = await updatePhoto(photo.id, updates);
  return res.status(200).json(updated);
};

// ---------------------------------------------------------------------------
// PATCH /photos/:id/status  🔒
// ---------------------------------------------------------------------------
export const updatePhotoStatus = async (req, res) => {
  const photo = await findPhotoById(req.params.id);
  if (!photo) {
    return res.status(404).json(errBody('NOT_FOUND', 'Photo not found.'));
  }

  // Non-admins may only update their own photos
  if (req.user.accountType !== 'admin' && photo.submittedBy !== req.user.id) {
    return res.status(403).json(errBody('FORBIDDEN', 'You do not have permission to update this photo.'));
  }

  const { status } = req.body ?? {};

  if (!status) {
    return res.status(400).json(errBody('VALIDATION_ERROR', '`status` is required.'));
  }
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json(
      errBody('VALIDATION_ERROR', `\`status\` must be one of: ${VALID_STATUSES.join(', ')}.`)
    );
  }

  const updated = await updatePhoto(photo.id, { status });
  return res.status(200).json(updated);
};

// ---------------------------------------------------------------------------
// PATCH /photos/:id/duplicate  🔒
// ---------------------------------------------------------------------------
export const updatePhotoDuplicate = async (req, res) => {
  const photo = await findPhotoById(req.params.id);
  if (!photo) {
    return res.status(404).json(errBody('NOT_FOUND', 'Photo not found.'));
  }

  // Non-admins may only update their own photos
  if (req.user.accountType !== 'admin' && photo.submittedBy !== req.user.id) {
    return res.status(403).json(errBody('FORBIDDEN', 'You do not have permission to update this photo.'));
  }

  const { isDuplicate, duplicateOfId } = req.body ?? {};

  if (typeof isDuplicate !== 'boolean') {
    return res.status(400).json(errBody('VALIDATION_ERROR', '`isDuplicate` must be a boolean.'));
  }

  // When flagging as duplicate, duplicateOfId is required and must exist
  if (isDuplicate) {
    if (!duplicateOfId) {
      return res.status(400).json(
        errBody('VALIDATION_ERROR', '`duplicateOfId` is required when `isDuplicate` is true.')
      );
    }
    if (!await findPhotoById(duplicateOfId)) {
      return res.status(404).json(
        errBody('NOT_FOUND', 'The photo referenced by `duplicateOfId` was not found.')
      );
    }
    if (duplicateOfId === photo.id) {
      return res.status(400).json(
        errBody('VALIDATION_ERROR', 'A photo cannot be a duplicate of itself.')
      );
    }
  }

  const updated = await updatePhoto(photo.id, {
    isDuplicate,
    duplicateOfId: isDuplicate ? duplicateOfId : null,
  });

  return res.status(200).json(updated);
};

// ---------------------------------------------------------------------------
// GET /photos/:id/download  🔒
// ---------------------------------------------------------------------------
export const getDownloadUrl = async (req, res) => {
  const photo = await findPhotoById(req.params.id);
  if (!photo) {
    return res.status(404).json(errBody('NOT_FOUND', 'Photo not found.'));
  }

  // Non-admins may only download their own photos
  if (req.user.accountType !== 'admin' && photo.submittedBy !== req.user.id) {
    return res.status(403).json(errBody('FORBIDDEN', 'You do not have permission to download this photo.'));
  }

  // In production this would generate a pre-signed URL from object storage (e.g. S3).
  // For now, return a placeholder URL that expires in 1 hour.
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const url = `https://storage.civilwarsleuth.dev/photos/${photo.id}/image?token=dev-placeholder&expires=${expiresAt}`;

  return res.status(200).json({ url, expiresAt });
};
