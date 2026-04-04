/**
 * onboardingRequestController.js
 * --------------------------------
 * Handlers for the Onboarding Requests API (§6 in docs/apis.md).
 *
 * Routes (mounted at /api/onboarding-requests):
 *   POST   /                        🔒  createOnboardingReq
 *   GET    /                        🔒  listOnboardingReqs
 *   GET    /:id                     🔒  getOnboardingReq
 *   PATCH  /:id                     🔒  updateOnboardingReq  (submitter, pending only)
 *   POST   /:id/photos              🔒  addPhotos
 *   DELETE /:id/photos/:photoId     🔒  removePhoto
 *   DELETE /:id                     🔒  deleteOnboardingReq  (submitter or admin, pending only)
 *   POST   /:id/submit              🔒  submitOnboardingReq
 *   POST   /:id/approve             🔴  approveOnboardingReq
 *   POST   /:id/reject              🔴  rejectOnboardingReq
 *   PATCH  /:id/assign              🔴  assignReviewer
 */

import {
  createOnboardingRequest,
  findOnboardingRequestById,
  findOnboardingRequests,
  updateOnboardingRequest,
  deleteOnboardingRequest,
} from '../models/onboardingRequestModel.js';

import { findPhotoById, updatePhoto } from '../models/photoModel.js';
import { findById as findUserById   } from '../models/userModel.js';
import { findSuggestionsByRequestId } from '../models/suggestionModel.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const VALID_STATUSES = ['pending', 'under_review', 'approved', 'rejected', 'onboarded'];

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
const errBody = (code, message, details = null) => ({
  error: { code, message, details },
});

/** Resolve an OnboardingRequest's photoIds → full Photo objects. */
const hydratePhotos = async (req) => {
  const photos = await Promise.all(req.photoIds.map((id) => findPhotoById(id)));
  return photos.filter(Boolean);
};

/** Attach hydrated photos and hydrated suggestions for the detail view. */
const toDetail = async (req) => ({
  ...req,
  photos:      await hydratePhotos(req),
  suggestions: await findSuggestionsByRequestId(req.id),
});

// ---------------------------------------------------------------------------
// POST /onboarding-requests  🔒
// ---------------------------------------------------------------------------
export const createOnboardingReq = async (req, res) => {
  const { onboardingRequestTitle, onboardingRequestNotes, photoIds } = req.body ?? {};

  // ── Validate title ────────────────────────────────────────────────────────
  if (!onboardingRequestTitle || typeof onboardingRequestTitle !== 'string' || !onboardingRequestTitle.trim()) {
    return res.status(400).json(errBody('VALIDATION_ERROR', '`onboardingRequestTitle` is required.'));
  }
  if (onboardingRequestTitle.trim().length > 255) {
    return res.status(400).json(errBody('VALIDATION_ERROR', '`onboardingRequestTitle` must be 255 characters or fewer.'));
  }

  // ── Validate notes (optional) ─────────────────────────────────────────────
  if (onboardingRequestNotes !== undefined && onboardingRequestNotes !== null) {
    if (typeof onboardingRequestNotes !== 'string') {
      return res.status(400).json(errBody('VALIDATION_ERROR', '`onboardingRequestNotes` must be a string.'));
    }
    if (onboardingRequestNotes.length > 2000) {
      return res.status(400).json(errBody('VALIDATION_ERROR', '`onboardingRequestNotes` must be 2000 characters or fewer.'));
    }
  }

  // ── Validate photoIds ─────────────────────────────────────────────────────
  if (!Array.isArray(photoIds) || photoIds.length === 0) {
    return res.status(400).json(errBody('VALIDATION_ERROR', '`photoIds` must be a non-empty array.'));
  }

  const { id: userId, accountType } = req.user;
  const errors = [];

  for (const photoId of photoIds) {
    const photo = await findPhotoById(photoId);
    if (!photo) {
      errors.push(`Photo ${photoId} not found.`);
      continue;
    }
    if (accountType !== 'admin' && photo.submittedBy !== userId) {
      errors.push(`Photo ${photoId} does not belong to you.`);
      continue;
    }
    if (photo.status !== 'reviewed') {
      errors.push(`Photo ${photoId} must have status \`reviewed\` (currently \`${photo.status}\`).`);
    }
  }

  if (errors.length) {
    return res.status(422).json(errBody('UNPROCESSABLE', 'One or more photos failed validation.', errors));
  }

  const newReq = await createOnboardingRequest({
    onboardingRequestTitle: onboardingRequestTitle.trim(),
    onboardingRequestNotes: onboardingRequestNotes ?? null,
    submittedBy: userId,
    photoIds,
  });

  return res.status(201).json({
    id: newReq.id,
    onboardingRequestTitle: newReq.onboardingRequestTitle,
    status: newReq.status,
    submittedBy: newReq.submittedBy,
    photoCount: newReq.photoIds.length,
    createdAt: newReq.createdAt,
  });
};

// ---------------------------------------------------------------------------
// GET /onboarding-requests  🔒
// ---------------------------------------------------------------------------
export const listOnboardingReqs = async (req, res) => {
  const { status, submittedBy, reviewerId, page, limit } = req.query;
  const { id: userId, accountType } = req.user;

  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json(
      errBody('VALIDATION_ERROR', `\`status\` must be one of: ${VALID_STATUSES.join(', ')}.`)
    );
  }

  if ((submittedBy || reviewerId) && accountType !== 'admin') {
    return res.status(403).json(errBody('FORBIDDEN', '`submittedBy` and `reviewerId` filters are admin only.'));
  }

  const ownerFilter =
    accountType === 'community_member' ? userId :
    submittedBy  ? submittedBy         : undefined;

  const result = await findOnboardingRequests({
    submittedBy: ownerFilter,
    status:      status     || undefined,
    reviewerId:  reviewerId || undefined,
    page:        page  ? parseInt(page,  10) : 1,
    limit:       limit ? parseInt(limit, 10) : 20,
  });

  result.data = result.data.map((r) => ({ ...r, photoCount: r.photoIds.length }));
  return res.status(200).json(result);
};

// ---------------------------------------------------------------------------
// GET /onboarding-requests/:id  🔒
// ---------------------------------------------------------------------------
export const getOnboardingReq = async (req, res) => {
  const onbReq = await findOnboardingRequestById(req.params.id);
  if (!onbReq) return res.status(404).json(errBody('NOT_FOUND', 'Onboarding request not found.'));

  const { id: userId, accountType } = req.user;
  if (accountType === 'community_member' && onbReq.submittedBy !== userId) {
    return res.status(403).json(errBody('FORBIDDEN', 'You do not have permission to view this request.'));
  }

  return res.status(200).json(await toDetail(onbReq));
};

// ---------------------------------------------------------------------------
// PATCH /onboarding-requests/:id  🔒  (submitter only, pending status only)
// ---------------------------------------------------------------------------
export const updateOnboardingReq = async (req, res) => {
  const onbReq = await findOnboardingRequestById(req.params.id);
  if (!onbReq) return res.status(404).json(errBody('NOT_FOUND', 'Onboarding request not found.'));

  if (onbReq.submittedBy !== req.user.id) {
    return res.status(403).json(errBody('FORBIDDEN', 'Only the submitter may edit this request.'));
  }
  if (onbReq.status !== 'pending') {
    return res.status(422).json(
      errBody('UNPROCESSABLE', `Only \`pending\` requests can be edited (current status: \`${onbReq.status}\`).`)
    );
  }

  const updates = {};
  const { onboardingRequestTitle, onboardingRequestNotes } = req.body ?? {};

  if (onboardingRequestTitle !== undefined) {
    if (typeof onboardingRequestTitle !== 'string' || !onboardingRequestTitle.trim()) {
      return res.status(400).json(errBody('VALIDATION_ERROR', '`onboardingRequestTitle` must be a non-empty string.'));
    }
    if (onboardingRequestTitle.trim().length > 255) {
      return res.status(400).json(errBody('VALIDATION_ERROR', '`onboardingRequestTitle` must be 255 characters or fewer.'));
    }
    updates.onboardingRequestTitle = onboardingRequestTitle.trim();
  }

  if (onboardingRequestNotes !== undefined) {
    if (onboardingRequestNotes !== null && typeof onboardingRequestNotes !== 'string') {
      return res.status(400).json(errBody('VALIDATION_ERROR', '`onboardingRequestNotes` must be a string or null.'));
    }
    if (typeof onboardingRequestNotes === 'string' && onboardingRequestNotes.length > 2000) {
      return res.status(400).json(errBody('VALIDATION_ERROR', '`onboardingRequestNotes` must be 2000 characters or fewer.'));
    }
    updates.onboardingRequestNotes = onboardingRequestNotes;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json(
      errBody('VALIDATION_ERROR', 'Provide at least one of: `onboardingRequestTitle`, `onboardingRequestNotes`.')
    );
  }

  return res.status(200).json(await toDetail(await updateOnboardingRequest(onbReq.id, updates)));
};

// ---------------------------------------------------------------------------
// POST /onboarding-requests/:id/photos  🔒
// ---------------------------------------------------------------------------
export const addPhotos = async (req, res) => {
  const onbReq = await findOnboardingRequestById(req.params.id);
  if (!onbReq) return res.status(404).json(errBody('NOT_FOUND', 'Onboarding request not found.'));

  if (onbReq.submittedBy !== req.user.id && req.user.accountType !== 'admin') {
    return res.status(403).json(errBody('FORBIDDEN', 'You do not have permission to modify this request.'));
  }
  if (onbReq.status !== 'pending') {
    return res.status(422).json(errBody('UNPROCESSABLE', 'Photos can only be added to a `pending` request.'));
  }

  const { photoIds } = req.body ?? {};
  if (!Array.isArray(photoIds) || photoIds.length === 0) {
    return res.status(400).json(errBody('VALIDATION_ERROR', '`photoIds` must be a non-empty array.'));
  }

  const { id: userId, accountType } = req.user;
  const errors = [];

  for (const photoId of photoIds) {
    if (onbReq.photoIds.includes(photoId)) {
      errors.push(`Photo ${photoId} is already in this request.`);
      continue;
    }
    const photo = await findPhotoById(photoId);
    if (!photo) { errors.push(`Photo ${photoId} not found.`); continue; }
    if (accountType !== 'admin' && photo.submittedBy !== userId) {
      errors.push(`Photo ${photoId} does not belong to you.`);
      continue;
    }
    if (photo.status !== 'reviewed') {
      errors.push(`Photo ${photoId} must have status \`reviewed\` (currently \`${photo.status}\`).`);
    }
  }

  if (errors.length) {
    return res.status(422).json(errBody('UNPROCESSABLE', 'One or more photos failed validation.', errors));
  }

  const updated = await updateOnboardingRequest(onbReq.id, {
    photoIds: [...onbReq.photoIds, ...photoIds],
  });

  return res.status(200).json(await toDetail(updated));
};

// ---------------------------------------------------------------------------
// DELETE /onboarding-requests/:id/photos/:photoId  🔒
// ---------------------------------------------------------------------------
export const removePhoto = async (req, res) => {
  const onbReq = await findOnboardingRequestById(req.params.id);
  if (!onbReq) return res.status(404).json(errBody('NOT_FOUND', 'Onboarding request not found.'));

  if (onbReq.submittedBy !== req.user.id && req.user.accountType !== 'admin') {
    return res.status(403).json(errBody('FORBIDDEN', 'You do not have permission to modify this request.'));
  }
  if (onbReq.status !== 'pending') {
    return res.status(422).json(errBody('UNPROCESSABLE', 'Photos can only be removed from a `pending` request.'));
  }

  const { photoId } = req.params;
  if (!onbReq.photoIds.includes(photoId)) {
    return res.status(404).json(errBody('NOT_FOUND', 'Photo not found in this onboarding request.'));
  }

  await updateOnboardingRequest(onbReq.id, {
    photoIds: onbReq.photoIds.filter((id) => id !== photoId),
  });

  return res.status(204).send();
};

// ---------------------------------------------------------------------------
// DELETE /onboarding-requests/:id  🔒  (submitter or admin, pending only)
// ---------------------------------------------------------------------------
export const deleteOnboardingReq = async (req, res) => {
  const onbReq = await findOnboardingRequestById(req.params.id);
  if (!onbReq) return res.status(404).json(errBody('NOT_FOUND', 'Onboarding request not found.'));

  if (onbReq.submittedBy !== req.user.id && req.user.accountType !== 'admin') {
    return res.status(403).json(errBody('FORBIDDEN', 'Only the submitter or an admin may delete this request.'));
  }
  if (onbReq.status !== 'pending') {
    return res.status(422).json(errBody('UNPROCESSABLE', 'Only `pending` requests can be deleted.'));
  }

  await deleteOnboardingRequest(onbReq.id);
  return res.status(204).send();
};

// ---------------------------------------------------------------------------
// POST /onboarding-requests/:id/submit  🔒
// ---------------------------------------------------------------------------
export const submitOnboardingReq = async (req, res) => {
  const onbReq = await findOnboardingRequestById(req.params.id);
  if (!onbReq) return res.status(404).json(errBody('NOT_FOUND', 'Onboarding request not found.'));

  if (onbReq.submittedBy !== req.user.id) {
    return res.status(403).json(errBody('FORBIDDEN', 'Only the submitter may submit this request for review.'));
  }
  if (onbReq.status !== 'pending') {
    return res.status(422).json(
      errBody('UNPROCESSABLE', `Only \`pending\` requests can be submitted (current status: \`${onbReq.status}\`).`)
    );
  }
  if (onbReq.photoIds.length === 0) {
    return res.status(422).json(errBody('UNPROCESSABLE', 'Cannot submit an onboarding request with no photos.'));
  }

  const updated = await updateOnboardingRequest(onbReq.id, { status: 'under_review' });
  return res.status(200).json({ id: updated.id, status: updated.status, updatedAt: updated.updatedAt });
};

// ---------------------------------------------------------------------------
// POST /onboarding-requests/:id/approve  🔴  (admin only)
// ---------------------------------------------------------------------------
export const approveOnboardingReq = async (req, res) => {
  const onbReq = await findOnboardingRequestById(req.params.id);
  if (!onbReq) return res.status(404).json(errBody('NOT_FOUND', 'Onboarding request not found.'));

  if (onbReq.status !== 'under_review') {
    return res.status(422).json(
      errBody('UNPROCESSABLE', `Only \`under_review\` requests can be approved (current status: \`${onbReq.status}\`).`)
    );
  }

  const { adminNote } = req.body ?? {};
  const now = new Date().toISOString();

  const updated = await updateOnboardingRequest(onbReq.id, {
    status:     'approved',
    reviewedBy: req.user.id,
    reviewedAt: now,
    adminNote:  adminNote ?? null,
  });

  return res.status(200).json({
    id:         updated.id,
    status:     updated.status,
    reviewedBy: updated.reviewedBy,
    reviewedAt: updated.reviewedAt,
    adminNote:  updated.adminNote,
  });
};

// ---------------------------------------------------------------------------
// POST /onboarding-requests/:id/reject  🔴  (admin only)
// ---------------------------------------------------------------------------
export const rejectOnboardingReq = async (req, res) => {
  const onbReq = await findOnboardingRequestById(req.params.id);
  if (!onbReq) return res.status(404).json(errBody('NOT_FOUND', 'Onboarding request not found.'));

  if (!['under_review', 'pending'].includes(onbReq.status)) {
    return res.status(422).json(
      errBody('UNPROCESSABLE', `Cannot reject a request with status \`${onbReq.status}\`.`)
    );
  }

  const { adminNote } = req.body ?? {};
  const now = new Date().toISOString();

  const updated = await updateOnboardingRequest(onbReq.id, {
    status:     'rejected',
    reviewedBy: req.user.id,
    reviewedAt: now,
    adminNote:  adminNote ?? null,
  });

  return res.status(200).json(await toDetail(updated));
};

// ---------------------------------------------------------------------------
// PATCH /onboarding-requests/:id/assign  🔴  (admin only)
// ---------------------------------------------------------------------------
export const assignReviewer = async (req, res) => {
  const onbReq = await findOnboardingRequestById(req.params.id);
  if (!onbReq) return res.status(404).json(errBody('NOT_FOUND', 'Onboarding request not found.'));

  const { reviewerId } = req.body ?? {};
  if (!reviewerId) {
    return res.status(400).json(errBody('VALIDATION_ERROR', '`reviewerId` is required.'));
  }

  const reviewer = await findUserById(reviewerId);
  if (!reviewer) {
    return res.status(404).json(errBody('NOT_FOUND', `User ${reviewerId} not found.`));
  }
  if (reviewer.accountType !== 'admin') {
    return res.status(422).json(errBody('UNPROCESSABLE', 'Reviewer must be an admin.'));
  }

  return res.status(200).json(await toDetail(await updateOnboardingRequest(onbReq.id, { reviewerId })));
};
