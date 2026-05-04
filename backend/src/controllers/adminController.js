/**
 * adminController.js
 * ------------------
 * Handlers for the Admin API (§8 in docs/apis.md).
 * All routes are admin-only (🔴).
 *
 *   POST  /admin/invite-link         generateInviteLink
 *   GET   /admin/users               listUsers
 *   PATCH /admin/users/:id/deactivate deactivateUser
 *   PATCH /admin/users/:id/reactivate reactivateUser
 *   GET   /admin/dashboard/stats     getDashboardStats
 */

import { randomBytes } from 'crypto';
import {
  findAll,
  findById,
  updateUser,
  deleteUserById,
  toPublic,
} from '../models/userModel.js';
import { findPhotos } from '../models/photoModel.js';
import { countScrapeJobs } from '../models/scrapeJobModel.js';
import { deleteAllUserRefreshTokens } from '../models/authModel.js';

// ---------------------------------------------------------------------------
// In-memory invite token store  (swap for DB when available)
// key: token string → { accountType, expiresAt ISO, usedAt ISO|null }
// ---------------------------------------------------------------------------
const inviteTokens = new Map();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const errBody = (code, message, details = null) => ({
  error: { code, message, details },
});

// ---------------------------------------------------------------------------
// POST /admin/invite-link  🔴
// ---------------------------------------------------------------------------
export const generateInviteLink = (req, res) => {
  const { expiresInHours = 48 } = req.body ?? {};

  const hours = Number(expiresInHours);
  if (!Number.isInteger(hours) || hours < 1 || hours > 720) {
    return res.status(400).json(
      errBody('VALIDATION_ERROR', '`expiresInHours` must be an integer between 1 and 720.')
    );
  }

  const inviteToken = randomBytes(16).toString('hex');
  const expiresAt   = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

  inviteTokens.set(inviteToken, { accountType: 'admin', expiresAt, usedAt: null });

  const inviteUrl = `https://app.civilwarsleuth.dev/register?invite=${inviteToken}`;

  return res.status(201).json({ inviteToken, inviteUrl, expiresAt });
};

/**
 * Exported so the Auth API can consume invite tokens during registration.
 * Returns the token record or null if not found / expired / already used.
 */
export const consumeInviteToken = (token) => {
  const record = inviteTokens.get(token);
  if (!record)                          return null;
  if (record.usedAt)                    return null;  // already used
  if (new Date(record.expiresAt) < new Date()) return null;  // expired

  inviteTokens.set(token, { ...record, usedAt: new Date().toISOString() });
  return record;
};

// ---------------------------------------------------------------------------
// GET /admin/users  🔴
// ---------------------------------------------------------------------------
export const listUsers = async (req, res) => {
  const { accountType, isActive, search, page, limit } = req.query;

  // Validate accountType filter
  const validRoles = ['community_member', 'contributor', 'admin'];
  if (accountType && !validRoles.includes(accountType)) {
    return res.status(400).json(
      errBody('VALIDATION_ERROR', `\`accountType\` must be one of: ${validRoles.join(', ')}.`)
    );
  }

  let all = await findAll();

  // Filter by accountType
  if (accountType) {
    all = all.filter((u) => u.accountType === accountType);
  }

  // Filter by isActive (boolean query param)
  if (isActive !== undefined) {
    if (isActive !== 'true' && isActive !== 'false') {
      return res.status(400).json(
        errBody('VALIDATION_ERROR', '`isActive` must be true or false.')
      );
    }
    const activeFlag = isActive === 'true';
    all = all.filter((u) => u.isActive === activeFlag);
  }

  // Search by username or email (case-insensitive substring)
  if (search) {
    const q = search.toLowerCase();
    all = all.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
    );
  }

  const total     = all.length;
  const safeLimit = Math.min(Math.max(1, limit ? parseInt(limit, 10) : 20), 100);
  const safePage  = Math.max(1, page ? parseInt(page, 10) : 1);
  const data      = all
    .slice((safePage - 1) * safeLimit, safePage * safeLimit)
    .map(toPublic);

  return res.status(200).json({ data, total, page: safePage, limit: safeLimit });
};

// ---------------------------------------------------------------------------
// PATCH /admin/users/:id/deactivate  🔴
// ---------------------------------------------------------------------------
export const deactivateUser = async (req, res) => {
  const user = await findById(req.params.id);
  if (!user) {
    return res.status(404).json(errBody('NOT_FOUND', 'User not found.'));
  }

  // Prevent an admin from deactivating themselves
  if (user.id === req.user.id) {
    return res.status(422).json(
      errBody('UNPROCESSABLE', 'You cannot deactivate your own account.')
    );
  }

  if (!user.isActive) {
    return res.status(422).json(
      errBody('UNPROCESSABLE', 'User is already deactivated.')
    );
  }

  await updateUser(user.id, { isActive: false });
  return res.status(200).json({ id: user.id, isActive: false });
};

// ---------------------------------------------------------------------------
// PATCH /admin/users/:id/reactivate  🔴
// ---------------------------------------------------------------------------
export const reactivateUser = async (req, res) => {
  const user = await findById(req.params.id);
  if (!user) {
    return res.status(404).json(errBody('NOT_FOUND', 'User not found.'));
  }

  if (user.isActive) {
    return res.status(422).json(
      errBody('UNPROCESSABLE', 'User is already active.')
    );
  }

  await updateUser(user.id, { isActive: true });
  return res.status(200).json({ id: user.id, isActive: true });
};

export const deleteUser = async (req, res) => {
  const user = await findById(req.params.id);

  if (!user) {
    return res.status(404).json(errBody('NOT_FOUND', 'User not found.'));
  }

  // Prevent admins from deleting themselves from the admin panel
  if (user.id === req.user.id) {
    return res.status(422).json(
      errBody('UNPROCESSABLE', 'You cannot delete your own account from the admin panel.')
    );
  }

  try {
    await deleteAllUserRefreshTokens(user.id);
    await deleteUserById(user.id);

    return res.status(200).json({
      id: user.id,
      deleted: true,
    });
  } catch (error) {
    console.error('deleteUser error:', error);
    return res.status(500).json(
      errBody('INTERNAL_SERVER_ERROR', 'Unable to delete user.')
    );
  }
};

// ---------------------------------------------------------------------------
// GET /admin/dashboard/stats  🔴
// ---------------------------------------------------------------------------
export const getDashboardStats = async (req, res) => {
  const [allUsers, allPhotosResult, totalScrapeJobs] =
    await Promise.all([
      findAll(),
      findPhotos({ limit: 100000 }),
      countScrapeJobs(),
    ]);

  return res.status(200).json({
    totalUsers:      allUsers.length,
    totalScrapeJobs,
    totalPhotos:     allPhotosResult.total,
  });
};
