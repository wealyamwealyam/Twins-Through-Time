/**
 * onboardingRequestRoutes.js
 * --------------------------
 * Routes for the Onboarding Requests API (§6 in docs/apis.md).
 * Mounted at /api/onboarding-requests in server.js.
 *
 * All routes require authentication (🔒 minimum).
 * Admin-only actions (🔴) are further guarded by authorize('admin').
 *
 * NOTE: specific sub-paths (/submit, /approve, /reject, /assign, /photos)
 * are registered BEFORE the bare /:id handlers to avoid Express swallowing them.
 */

import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import authorize    from '../middleware/authorize.js';
import {
  createOnboardingReq,
  listOnboardingReqs,
  getOnboardingReq,
  updateOnboardingReq,
  addPhotos,
  removePhoto,
  deleteOnboardingReq,
  submitOnboardingReq,
  approveOnboardingReq,
  rejectOnboardingReq,
  assignReviewer,
} from '../controllers/onboardingRequestController.js';
import {
  createSuggestionHandler,
  listSuggestionsHandler,
  getSuggestionHandler,
  applyPhotoEditHandler,
  addPhotoEditNoteHandler,
} from '../controllers/suggestionController.js';

const router = Router();

// All routes require a valid JWT
router.use(authenticate);

// ── Collection ──────────────────────────────────────────────────────────────
router.post('/',  createOnboardingReq);
router.get('/',   listOnboardingReqs);

// ── Sub-resource actions (must come before /:id) ────────────────────────────
router.post(  '/:id/photos',                addPhotos);
router.delete('/:id/photos/:photoId',       removePhoto);
router.post(  '/:id/submit',                submitOnboardingReq);
router.post(  '/:id/approve', authorize('admin'), approveOnboardingReq);
router.post(  '/:id/reject',  authorize('admin'), rejectOnboardingReq);
router.patch( '/:id/assign',  authorize('admin'), assignReviewer);

// ── Suggestions (§7) — nested under /:id/suggestions ────────────────────────
// Deep routes (apply / note) must come before /:id/suggestions/:suggestionId
router.post('/:id/suggestions',                                              authorize('admin'), createSuggestionHandler);
router.get( '/:id/suggestions',                                              listSuggestionsHandler);
router.post('/:id/suggestions/:sid/photo-edits/:eid/apply',                  applyPhotoEditHandler);
router.post('/:id/suggestions/:sid/photo-edits/:eid/note',                   addPhotoEditNoteHandler);
router.get( '/:id/suggestions/:suggestionId',                                getSuggestionHandler);

// ── Item ─────────────────────────────────────────────────────────────────────
router.get(   '/:id',  getOnboardingReq);
router.patch( '/:id',  updateOnboardingReq);
router.delete('/:id',  deleteOnboardingReq);

export default router;
