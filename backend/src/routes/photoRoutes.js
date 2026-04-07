/**
 * photoRoutes.js
 * --------------
 * Routes for the Photos API (§5 in docs/apis.md).
 * Mounted at /api/photos in server.js.
 *
 * GET    /                  🔒  list photos
 * GET    /:id               🔒  get single photo
 * PATCH  /:id               🔒  update metadata
 * PATCH  /:id/status        🔒  update status
 * PATCH  /:id/duplicate     🔒  flag/unflag as duplicate
 * GET    /:id/download      🔒  get pre-signed download URL
 *
 * NOTE: sub-routes (/download, /status, /duplicate) are registered before
 * the plain /:id handler so Express matches them correctly.
 */

import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import {
  listPhotos,
  getPhoto,
  updatePhotoMetadata,
  updatePhotoStatus,
  updatePhotoDuplicate,
  getDownloadUrl,
} from '../controllers/photoController.js';

const router = Router();

// All photo routes require authentication
router.use(authenticate);

router.get('/',                  listPhotos);
router.get('/:id/download',      getDownloadUrl);
router.get('/:id',               getPhoto);
router.patch('/:id/status',      updatePhotoStatus);
router.patch('/:id/duplicate',   updatePhotoDuplicate);
router.patch('/:id',             updatePhotoMetadata);

export default router;
