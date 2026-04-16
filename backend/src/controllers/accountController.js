/**
 * accountController.js
 * --------------------
 * Handlers for the Account API (docs/apis.md §2):
 *
 *   GET    /account/profile          – get own profile         🔒
 *   PATCH  /account/profile          – update own profile      🔒
 *   GET    /account/users/:id        – get any user by id      🔴 admin
 *   PATCH  /account/users/:id/role   – update a user's role    🔴 admin
 */

import {
  findById,
  findAll,
  updateUser,
  deleteUserById,
  toPublic,
} from '../models/userModel.js';

import {
  validateUsername,
  validateFirstName,
  validateLastName,
  validateAge,
  validateGender,
  validateAccountType,
} from '../utils/validators.js';

import { deleteAllUserRefreshTokens } from '../models/authModel.js';

// ---------------------------------------------------------------------------
// GET /account/profile  🔒
// ---------------------------------------------------------------------------
export const getOwnProfile = async (req, res) => {
  const user = await findById(req.user.id);

  if (!user) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'User not found.', details: null },
    });
  }

  return res.status(200).json(toPublic(user));
};

// ---------------------------------------------------------------------------
// PATCH /account/profile  🔒
// ---------------------------------------------------------------------------

// Fields the user is allowed to update on their own profile.
// Password and accountType require dedicated endpoints.
const ALLOWED_SELF_UPDATE_FIELDS = [
  'username',
  'firstName',
  'lastName',
  'age',
  'gender',
];

export const updateOwnProfile = async (req, res) => {
  const user = await findById(req.user.id);

  if (!user) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'User not found.', details: null },
    });
  }

  // Only accept whitelisted fields
  const updates = {};
  for (const field of ALLOWED_SELF_UPDATE_FIELDS) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: `No updatable fields provided. Allowed: ${ALLOWED_SELF_UPDATE_FIELDS.join(', ')}`,
        details: null,
      },
    });
  }

  // Validate each provided field
  const errors = {};

  if (updates.username !== undefined) {
    const r = validateUsername(updates.username);
    if (!r.isValid) errors.username = r.errors;
  }
  if (updates.firstName !== undefined) {
    const r = validateFirstName(updates.firstName);
    if (!r.isValid) errors.firstName = r.errors;
  }
  if (updates.lastName !== undefined) {
    const r = validateLastName(updates.lastName);
    if (!r.isValid) errors.lastName = r.errors;
  }
  if (updates.age !== undefined) {
    const r = validateAge(updates.age);
    if (!r.isValid) errors.age = r.errors;
    else updates.age = Number(updates.age);
  }
  if (updates.gender !== undefined) {
    const r = validateGender(updates.gender);
    if (!r.isValid) errors.gender = r.errors;
    else updates.gender = updates.gender.toLowerCase();
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed.',
        details: errors,
      },
    });
  }

  const updated = await updateUser(req.user.id, updates);
  return res.status(200).json(toPublic(updated));
};

export const deleteOwnAccount = async (req, res) => {
  const user = await findById(req.user.id);

  if (!user) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'User not found.', details: null },
    });
  }

  try {
    // Invalidate refresh tokens explicitly before deleting the user.
    await deleteAllUserRefreshTokens(req.user.id);

    // Delete the user row. Related rows are handled by schema FK rules.
    await deleteUserById(req.user.id);

    return res.status(200).json({
      message: 'Account deleted successfully.',
    });
  } catch (error) {
    console.error('deleteOwnAccount error:', error);

    return res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Unable to delete account.',
        details: null,
      },
    });
  }
};

// ---------------------------------------------------------------------------
// GET /account/users/:id  🔴 admin
// ---------------------------------------------------------------------------
export const getUserById = async (req, res) => {
  const user = await findById(req.params.id);

  if (!user) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'User not found.', details: null },
    });
  }

  return res.status(200).json(toPublic(user));
};

// ---------------------------------------------------------------------------
// PATCH /account/users/:id/role  🔴 admin
// ---------------------------------------------------------------------------
const VALID_ROLES = ['community_member', 'contributor', 'admin'];

export const updateUserRole = async (req, res) => {
  const { accountType } = req.body;

  if (!accountType) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'accountType is required.',
        details: null,
      },
    });
  }

  if (!VALID_ROLES.includes(accountType)) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: `accountType must be one of: ${VALID_ROLES.join(', ')}`,
        details: null,
      },
    });
  }

  const user = await findById(req.params.id);

  if (!user) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'User not found.', details: null },
    });
  }

  const updated = await updateUser(req.params.id, { accountType });
  return res.status(200).json(toPublic(updated));
};
