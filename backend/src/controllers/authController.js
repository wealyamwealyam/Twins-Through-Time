/**
 * authController.js
 * -----------------
 * Handles §1 Auth API (docs/apis.md):
 *
 *   POST /auth/register              🔓  register with native credentials
 *   POST /auth/register/admin-invite 🔓  register via admin invite token
 *   POST /auth/login                 🔓  native email + password login
 *   POST /auth/login/google          🔓  Google OAuth login / auto-register
 *   POST /auth/refresh               🔓  exchange refresh token for new access token
 *   POST /auth/forgot-password       🔓  request password reset email
 *   POST /auth/reset-password        🔓  complete password reset
 *   POST /auth/logout                🔒  invalidate refresh token
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

import {
  createUser,
  findByEmail,
  findByUsername,
  findById,
  updateUser,
} from '../models/userModel.js';

import {
  createRefreshToken,
  findRefreshToken,
  deleteRefreshToken,
  createResetToken,
  findResetToken,
  markResetTokenUsed,
} from '../models/authModel.js';

import { createRequest } from '../models/accountChangeRequestModel.js';

// consumeInviteToken is imported from adminController — that module exports it
// for exactly this purpose (avoids duplicating the invite-token store logic).
import { consumeInviteToken } from './adminController.js';

const getSecret    = () => process.env.JWT_SECRET || 'change-me-in-production';
const SALT_ROUNDS  = 10;

const errBody = (code, message, details = null) => ({ error: { code, message, details } });

const issueAccessToken = (user) =>
  jwt.sign(
    { id: user.id, username: user.username, accountType: user.accountType },
    getSecret(),
    { expiresIn: '1h' }
  );

// ---------------------------------------------------------------------------
// POST /auth/register  🔓
// ---------------------------------------------------------------------------
export const register = async (req, res) => {
  try {
    const {
      username, email, password,
      firstName, lastName,
      age, gender,
      requestContributor = false,
    } = req.body ?? {};

    // Required fields
    const missing = ['username', 'email', 'password', 'firstName', 'lastName']
      .filter((f) => !req.body?.[f]);
    if (missing.length) {
      return res.status(400).json(errBody('VALIDATION_ERROR', `Missing required fields: ${missing.join(', ')}.`));
    }

    if (typeof username !== 'string' || username.length < 3 || username.length > 30) {
      return res.status(400).json(errBody('VALIDATION_ERROR', 'username must be 3–30 characters.'));
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json(errBody('VALIDATION_ERROR', 'password must be at least 8 characters.'));
    }

    if (findByEmail(email)) {
      return res.status(409).json(errBody('CONFLICT', 'Email is already registered.'));
    }
    if (findByUsername(username)) {
      return res.status(409).json(errBody('CONFLICT', 'Username is already taken.'));
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = createUser({ username, email, passwordHash, firstName, lastName, age, gender });

    if (requestContributor === true) {
      createRequest({
        userId:            user.id,
        currentAccount:    user.accountType,
        requestingAccount: 'contributor',
        reasonMessage:     'Requested at registration.',
      });
    }

    const token        = issueAccessToken(user);
    const refreshToken = createRefreshToken(user.id);

    return res.status(201).json({
      user: { id: user.id, username: user.username, email: user.email, accountType: user.accountType },
      token,
      refreshToken,
    });
  } catch (err) {
    console.error('[auth] register error:', err);
    return res.status(500).json(errBody('INTERNAL_ERROR', 'Registration failed.'));
  }
};

// ---------------------------------------------------------------------------
// POST /auth/register/admin-invite  🔓
// ---------------------------------------------------------------------------
export const registerAdminInvite = async (req, res) => {
  try {
    const { inviteToken, username, email, password, firstName, lastName } = req.body ?? {};

    if (!inviteToken) {
      return res.status(400).json(errBody('VALIDATION_ERROR', 'inviteToken is required.'));
    }

    // Validate & consume — consumeInviteToken marks the token as used atomically
    const invite = consumeInviteToken(inviteToken);
    if (!invite) {
      return res.status(400).json(errBody('VALIDATION_ERROR', 'Invalid, expired, or already-used invite token.'));
    }

    const missing = ['username', 'email', 'password', 'firstName', 'lastName']
      .filter((f) => !req.body?.[f]);
    if (missing.length) {
      return res.status(400).json(errBody('VALIDATION_ERROR', `Missing required fields: ${missing.join(', ')}.`));
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json(errBody('VALIDATION_ERROR', 'password must be at least 8 characters.'));
    }
    if (findByEmail(email)) {
      return res.status(409).json(errBody('CONFLICT', 'Email is already registered.'));
    }
    if (findByUsername(username)) {
      return res.status(409).json(errBody('CONFLICT', 'Username is already taken.'));
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = createUser({ username, email, passwordHash, firstName, lastName, accountType: 'admin' });

    const token        = issueAccessToken(user);
    const refreshToken = createRefreshToken(user.id);

    return res.status(201).json({
      user: { id: user.id, username: user.username, email: user.email, accountType: user.accountType },
      token,
      refreshToken,
    });
  } catch (err) {
    console.error('[auth] registerAdminInvite error:', err);
    return res.status(500).json(errBody('INTERNAL_ERROR', 'Registration failed.'));
  }
};

// ---------------------------------------------------------------------------
// POST /auth/login  🔓
// ---------------------------------------------------------------------------
export const login = async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json(errBody('VALIDATION_ERROR', 'email and password are required.'));
    }

    const user = findByEmail(email);

    // Deliberate: same message for unknown user vs wrong password (user enumeration prevention)
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json(errBody('UNAUTHORIZED', 'Invalid email or password.'));
    }
    if (!user.isActive) {
      return res.status(401).json(errBody('UNAUTHORIZED', 'Account is deactivated.'));
    }

    const token        = issueAccessToken(user);
    const refreshToken = createRefreshToken(user.id);

    return res.status(200).json({
      token,
      refreshToken,
      user: { id: user.id, username: user.username, accountType: user.accountType },
    });
  } catch (err) {
    console.error('[auth] login error:', err);
    return res.status(500).json(errBody('INTERNAL_ERROR', 'Login failed.'));
  }
};

// ---------------------------------------------------------------------------
// POST /auth/login/google  🔓
// Verifies the googleIdToken against Google's public tokeninfo endpoint.
// In production consider using google-auth-library for offline JWT verification.
// ---------------------------------------------------------------------------
export const loginGoogle = async (req, res) => {
  try {
    const { googleIdToken } = req.body ?? {};
    if (!googleIdToken) {
      return res.status(400).json(errBody('VALIDATION_ERROR', 'googleIdToken is required.'));
    }

    let googlePayload;
    try {
      const resp = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(googleIdToken)}`
      );
      if (!resp.ok) throw new Error('Google rejected token');
      googlePayload = await resp.json();
    } catch {
      return res.status(401).json(errBody('UNAUTHORIZED', 'Invalid Google ID token.'));
    }

    const { email, given_name, family_name, sub } = googlePayload;
    if (!email) {
      return res.status(401).json(errBody('UNAUTHORIZED', 'Google token did not include an email.'));
    }

    let user = findByEmail(email);
    let isNewUser = false;

    if (!user) {
      // Auto-register from Google profile
      const base     = (given_name || 'user').toLowerCase().replace(/\s+/g, '') + sub.slice(-4);
      const username = findByUsername(base) ? base + randomUUID().slice(0, 4) : base;
      user = createUser({
        username,
        email,
        passwordHash: '',           // no native password for OAuth accounts
        firstName:    given_name  || '',
        lastName:     family_name || '',
      });
      isNewUser = true;
    }

    if (!user.isActive) {
      return res.status(401).json(errBody('UNAUTHORIZED', 'Account is deactivated.'));
    }

    const token        = issueAccessToken(user);
    const refreshToken = createRefreshToken(user.id);

    return res.status(200).json({
      token,
      refreshToken,
      isNewUser,
      user: { id: user.id, username: user.username, accountType: user.accountType },
    });
  } catch (err) {
    console.error('[auth] loginGoogle error:', err);
    return res.status(500).json(errBody('INTERNAL_ERROR', 'Google login failed.'));
  }
};

// ---------------------------------------------------------------------------
// POST /auth/refresh  🔓
// ---------------------------------------------------------------------------
export const refreshAccessToken = (req, res) => {
  const { refreshToken } = req.body ?? {};
  if (!refreshToken) {
    return res.status(400).json(errBody('VALIDATION_ERROR', 'refreshToken is required.'));
  }

  const entry = findRefreshToken(refreshToken);
  if (!entry) {
    return res.status(401).json(errBody('UNAUTHORIZED', 'Invalid or expired refresh token.'));
  }
  if (new Date(entry.expiresAt) < new Date()) {
    deleteRefreshToken(refreshToken);
    return res.status(401).json(errBody('UNAUTHORIZED', 'Refresh token has expired.'));
  }

  const user = findById(entry.userId);
  if (!user || !user.isActive) {
    return res.status(401).json(errBody('UNAUTHORIZED', 'User not found or deactivated.'));
  }

  return res.status(200).json({ token: issueAccessToken(user) });
};

// ---------------------------------------------------------------------------
// POST /auth/forgot-password  🔓
// ---------------------------------------------------------------------------
export const forgotPassword = (req, res) => {
  const { email } = req.body ?? {};
  if (!email) {
    return res.status(400).json(errBody('VALIDATION_ERROR', 'email is required.'));
  }

  const user = findByEmail(email);
  if (user && user.isActive) {
    const resetToken = createResetToken(user.id);
    // Production: send an email with a link containing the resetToken.
    // For now, log it so tests can read it from server output.
    console.log(`[auth] password-reset token for ${email}: ${resetToken}`);
  }

  // Always 200 — prevents user enumeration
  return res.status(200).json({ message: 'Password reset email sent if account exists.' });
};

// ---------------------------------------------------------------------------
// POST /auth/reset-password  🔓
// ---------------------------------------------------------------------------
export const resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body ?? {};
    if (!resetToken || !newPassword) {
      return res.status(400).json(errBody('VALIDATION_ERROR', 'resetToken and newPassword are required.'));
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json(errBody('VALIDATION_ERROR', 'newPassword must be at least 8 characters.'));
    }

    const entry = findResetToken(resetToken);
    if (!entry || entry.used) {
      return res.status(400).json(errBody('VALIDATION_ERROR', 'Invalid or already-used reset token.'));
    }
    if (new Date(entry.expiresAt) < new Date()) {
      return res.status(400).json(errBody('VALIDATION_ERROR', 'Reset token has expired.'));
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    updateUser(entry.userId, { passwordHash });
    markResetTokenUsed(resetToken);

    return res.status(200).json({ message: 'Password successfully reset.' });
  } catch (err) {
    console.error('[auth] resetPassword error:', err);
    return res.status(500).json(errBody('INTERNAL_ERROR', 'Password reset failed.'));
  }
};

// ---------------------------------------------------------------------------
// POST /auth/logout  🔒
// ---------------------------------------------------------------------------
export const logout = (req, res) => {
  const { refreshToken } = req.body ?? {};
  if (refreshToken) deleteRefreshToken(refreshToken);
  return res.status(204).send();
};
