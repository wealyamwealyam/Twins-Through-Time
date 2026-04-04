/**
 * adminRoutes.js
 * --------------
 * Routes for the Admin API (§8 in docs/apis.md).
 * Mounted at /api/admin in server.js.
 *
 * All routes are admin-only (🔴) — enforced via authorize('admin').
 *
 *   POST  /invite-link           generateInviteLink
 *   GET   /users                 listUsers
 *   PATCH /users/:id/deactivate  deactivateUser
 *   GET   /dashboard/stats       getDashboardStats
 */

import { Router }   from 'express';
import authenticate from '../middleware/authenticate.js';
import authorize    from '../middleware/authorize.js';
import {
  generateInviteLink,
  listUsers,
  deactivateUser,
  getDashboardStats,
} from '../controllers/adminController.js';

const router = Router();

// All admin routes require a valid JWT and the admin role
router.use(authenticate, authorize('admin'));

router.post(  '/invite-link',           generateInviteLink);
router.get(   '/users',                 listUsers);
router.patch( '/users/:id/deactivate',  deactivateUser);
router.get(   '/dashboard/stats',       getDashboardStats);

export default router;
