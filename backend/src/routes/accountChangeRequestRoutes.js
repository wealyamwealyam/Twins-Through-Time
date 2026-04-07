/**
 * accountChangeRequestRoutes.js
 * ------------------------------
 * Routes for the Account Change Request API (§3 in docs/apis.md).
 * Mounted at /api/account-change-requests in server.js.
 *
 * POST   /                  🔒  any authenticated user
 * GET    /me                🔒  any authenticated user (own requests)
 * GET    /                  🔴  admin only
 * GET    /:id               🔴  admin only
 * PATCH  /:id               🔴  admin only
 *
 * NOTE: /me must be registered BEFORE /:id so Express matches it correctly.
 */

import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import authorize    from '../middleware/authorize.js';
import {
  submitRequest,
  listRequests,
  getOwnRequests,
  getRequestById,
  reviewRequest,
} from '../controllers/accountChangeRequestController.js';

const router = Router();

// 🔒 Authenticated — any role
router.post('/',    authenticate,                         submitRequest);
router.get('/me',   authenticate,                         getOwnRequests);

// 🔴 Admin only
router.get('/',     authenticate, authorize('admin'),     listRequests);
router.get('/:id',  authenticate, authorize('admin'),     getRequestById);
router.patch('/:id',authenticate, authorize('admin'),     reviewRequest);

export default router;
