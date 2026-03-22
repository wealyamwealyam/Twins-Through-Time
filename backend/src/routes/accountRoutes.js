/**
 * accountRoutes.js
 * ----------------
 * Mounts the Account API routes documented in docs/apis.md §2:
 *
 *   GET    /account/profile          🔒  get own profile
 *   PATCH  /account/profile          🔒  update own profile
 *   GET    /account/users/:id        🔴  get any user by id (admin only)
 *   PATCH  /account/users/:id/role   🔴  update a user's role (admin only)
 */

import express from 'express';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import {
  getOwnProfile,
  updateOwnProfile,
  getUserById,
  updateUserRole,
} from '../controllers/accountController.js';

const router = express.Router();

// ── Own profile ──────────────────────────────────────────────────────────────

// GET  /account/profile   – any authenticated user
router.get('/profile', authenticate, getOwnProfile);

// PATCH /account/profile  – any authenticated user
router.patch('/profile', authenticate, updateOwnProfile);

// ── Admin: manage any user ───────────────────────────────────────────────────

// GET  /account/users/:id  – admin only
router.get('/users/:id', authenticate, authorize('admin'), getUserById);

// PATCH /account/users/:id/role  – admin only
router.patch('/users/:id/role', authenticate, authorize('admin'), updateUserRole);

export default router;
