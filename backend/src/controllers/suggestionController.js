/**
 * suggestionController.js
 * -----------------------
 * Handlers for the Onboarding Request Suggestions API (§7 in docs/apis.md).
 *
 * All routes are nested under /api/onboarding-requests/:id/suggestions
 * and registered inside onboardingRequestRoutes.js.
 *
 *   POST   /:id/suggestions                                    🔴  createSuggestion
 *   GET    /:id/suggestions                                    🔒  listSuggestions
 *   GET    /:id/suggestions/:suggestionId                      🔒  getSuggestion
 *   POST   /:id/suggestions/:sid/photo-edits/:eid/apply        🔒  applyPhotoEdit
 *   POST   /:id/suggestions/:sid/photo-edits/:eid/note         🔒  addPhotoEditNote
 */

import {
  createSuggestion,
  findSuggestionById,
  findSuggestionsByRequestId,
  findPhotoEditById,
  updatePhotoEdit,
} from '../models/suggestionModel.js';
import {
  findOnboardingRequestById,
  updateOnboardingRequest,
} from '../models/onboardingRequestModel.js';

import { findPhotoById, updatePhoto } from '../models/photoModel.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const errBody = (code, message, details = null) => ({
  error: { code, message, details },
});

/**
 * Shared guard: find the onboarding request, verify caller can see it
 * (admin or the request's submitter), and return it.
 * Returns null and sends the appropriate error response if access is denied.
 */
const resolveRequest = async (reqParam, res, user) => {
  const onbReq = await findOnboardingRequestById(reqParam);
  if (!onbReq) {
    res.status(404).json(errBody('NOT_FOUND', 'Onboarding request not found.'));
    return null;
  }
  if (user.accountType !== 'admin' && onbReq.submittedBy !== user.id) {
    res.status(403).json(errBody('FORBIDDEN', 'You do not have permission to access this request.'));
    return null;
  }
  return onbReq;
};

// ---------------------------------------------------------------------------
// POST /:id/suggestions  🔴  (admin only — enforced in routes file)
// ---------------------------------------------------------------------------
export const createSuggestionHandler = async (req, res) => {
  const onbReq = await findOnboardingRequestById(req.params.id);
  if (!onbReq) {
    return res.status(404).json(errBody('NOT_FOUND', 'Onboarding request not found.'));
  }

  const { onboardingRequestNote, photoEdits: rawEdits } = req.body ?? {};

  const hasNote  = onboardingRequestNote && typeof onboardingRequestNote === 'string' && onboardingRequestNote.trim();
  const hasEdits = Array.isArray(rawEdits) && rawEdits.length > 0;

  if (!hasNote && !hasEdits) {
    return res.status(400).json(
      errBody('VALIDATION_ERROR', 'Provide at least one of `onboardingRequestNote` or `photoEdits`.')
    );
  }

  if (hasEdits) {
    const errors = [];
    const seenPhotoIds = new Set();

    for (let i = 0; i < rawEdits.length; i++) {
      const edit = rawEdits[i];

      if (!edit.originalPhotoId) {
        errors.push(`photoEdits[${i}]: \`originalPhotoId\` is required.`);
        continue;
      }
      if (seenPhotoIds.has(edit.originalPhotoId)) {
        errors.push(`photoEdits[${i}]: duplicate originalPhotoId ${edit.originalPhotoId}.`);
        continue;
      }
      seenPhotoIds.add(edit.originalPhotoId);

      if (!await findPhotoById(edit.originalPhotoId)) {
        errors.push(`photoEdits[${i}]: Photo ${edit.originalPhotoId} not found.`);
        continue;
      }
      if (!onbReq.photoIds.includes(edit.originalPhotoId)) {
        errors.push(`photoEdits[${i}]: Photo ${edit.originalPhotoId} is not part of this request.`);
      }
    }

    if (errors.length) {
      return res.status(422).json(errBody('UNPROCESSABLE', 'Photo edit validation failed.', errors));
    }
  }

  const suggestion = await createSuggestion({
    onboardingRequestId:   onbReq.id,
    reviewerId:            req.user.id,
    onboardingRequestNote: hasNote ? onboardingRequestNote.trim() : null,
    photoEdits:            hasEdits ? rawEdits : [],
  });

  await updateOnboardingRequest(onbReq.id, {
    hasReceivedSuggestions: true,
    suggestionIds: [...onbReq.suggestionIds, suggestion.id],
  });

  return res.status(201).json(await findSuggestionById(suggestion.id));
};

// ---------------------------------------------------------------------------
// GET /:id/suggestions  🔒
// ---------------------------------------------------------------------------
export const listSuggestionsHandler = async (req, res) => {
  const onbReq = await resolveRequest(req.params.id, res, req.user);
  if (!onbReq) return;

  return res.status(200).json(await findSuggestionsByRequestId(onbReq.id));
};

// ---------------------------------------------------------------------------
// GET /:id/suggestions/:suggestionId  🔒
// ---------------------------------------------------------------------------
export const getSuggestionHandler = async (req, res) => {
  const onbReq = await resolveRequest(req.params.id, res, req.user);
  if (!onbReq) return;

  const suggestion = await findSuggestionById(req.params.suggestionId);
  if (!suggestion || suggestion.onboardingRequestId !== onbReq.id) {
    return res.status(404).json(errBody('NOT_FOUND', 'Suggestion not found.'));
  }

  return res.status(200).json(suggestion);
};

// ---------------------------------------------------------------------------
// POST /:id/suggestions/:sid/photo-edits/:eid/apply  🔒
// ---------------------------------------------------------------------------
export const applyPhotoEditHandler = async (req, res) => {
  const onbReq = await resolveRequest(req.params.id, res, req.user);
  if (!onbReq) return;

  if (onbReq.submittedBy !== req.user.id) {
    return res.status(403).json(errBody('FORBIDDEN', 'Only the request submitter may apply suggested edits.'));
  }

  const suggestion = await findSuggestionById(req.params.sid);
  if (!suggestion || suggestion.onboardingRequestId !== onbReq.id) {
    return res.status(404).json(errBody('NOT_FOUND', 'Suggestion not found.'));
  }

  const edit = await findPhotoEditById(req.params.eid);
  if (!edit || edit.suggestionId !== suggestion.id) {
    return res.status(404).json(errBody('NOT_FOUND', 'Photo edit not found.'));
  }

  if (edit.appliedAt) {
    return res.status(422).json(errBody('UNPROCESSABLE', 'This edit has already been applied.'));
  }

  const photo = await findPhotoById(edit.originalPhotoId);
  if (!photo) {
    return res.status(404).json(errBody('NOT_FOUND', 'Original photo not found.'));
  }

  const metaPatch = {};
  if (edit.suggestedName     !== null) metaPatch.name      = edit.suggestedName;
  if (edit.suggestedRegiment !== null) metaPatch.regiment   = edit.suggestedRegiment;
  if (edit.suggestedTags     !== null) metaPatch.tags       = edit.suggestedTags;
  if (edit.suggestedNotes    !== null) metaPatch.photoNotes = edit.suggestedNotes;

  const now = new Date().toISOString();

  const updatedPhoto = await updatePhoto(photo.id, {
    ...metaPatch,
    isAutoExtracted:  false,
    metadataEditedBy: req.user.id,
    metadataEditedAt: now,
  });

  const appliedEdit = await updatePhotoEdit(edit.id, {
    appliedAt: now,
    appliedBy: req.user.id,
  });

  return res.status(200).json({
    photoId: photo.id,
    appliedEdit: {
      id:        appliedEdit.id,
      appliedAt: appliedEdit.appliedAt,
      appliedBy: appliedEdit.appliedBy,
    },
    updatedPhoto,
  });
};

// ---------------------------------------------------------------------------
// POST /:id/suggestions/:sid/photo-edits/:eid/note  🔒
// ---------------------------------------------------------------------------
export const addPhotoEditNoteHandler = async (req, res) => {
  const onbReq = await resolveRequest(req.params.id, res, req.user);
  if (!onbReq) return;

  const suggestion = await findSuggestionById(req.params.sid);
  if (!suggestion || suggestion.onboardingRequestId !== onbReq.id) {
    return res.status(404).json(errBody('NOT_FOUND', 'Suggestion not found.'));
  }

  const edit = await findPhotoEditById(req.params.eid);
  if (!edit || edit.suggestionId !== suggestion.id) {
    return res.status(404).json(errBody('NOT_FOUND', 'Photo edit not found.'));
  }

  const { note } = req.body ?? {};

  if (!note || typeof note !== 'string' || !note.trim()) {
    return res.status(400).json(errBody('VALIDATION_ERROR', '`note` is required and must be a non-empty string.'));
  }

  const updated = await updatePhotoEdit(edit.id, { responderNote: note.trim() });
  return res.status(200).json(updated);
};
