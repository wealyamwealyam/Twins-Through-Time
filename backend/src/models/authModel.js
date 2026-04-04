/**
 * authModel.js
 * ------------
 * In-memory stores for refresh tokens and password-reset tokens.
 * Replace with Redis / DB-backed equivalents in production.
 *
 * Refresh token shape:  { userId, expiresAt ISO }
 * Reset token shape:    { userId, expiresAt ISO, used boolean }
 */

import { randomBytes } from 'crypto';

// ---------------------------------------------------------------------------
// Refresh tokens
// ---------------------------------------------------------------------------
const refreshTokens = new Map(); // token → { userId, expiresAt }

export const createRefreshToken = (userId, ttlDays = 30) => {
  const token     = randomBytes(40).toString('hex');
  const expiresAt = new Date(Date.now() + ttlDays * 86_400_000).toISOString();
  refreshTokens.set(token, { userId, expiresAt });
  return token;
};

export const findRefreshToken  = (token) => refreshTokens.get(token) ?? null;
export const deleteRefreshToken = (token) => refreshTokens.delete(token);

/** Invalidate ALL refresh tokens for a user (e.g. on account deactivation). */
export const deleteAllUserRefreshTokens = (userId) => {
  for (const [token, data] of refreshTokens) {
    if (data.userId === userId) refreshTokens.delete(token);
  }
};

// ---------------------------------------------------------------------------
// Password-reset tokens
// ---------------------------------------------------------------------------
const resetTokens = new Map(); // token → { userId, expiresAt, used }

export const createResetToken = (userId, ttlMinutes = 60) => {
  const token     = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000).toISOString();
  resetTokens.set(token, { userId, expiresAt, used: false });
  return token;
};

export const findResetToken    = (token) => resetTokens.get(token) ?? null;
export const markResetTokenUsed = (token) => {
  const entry = resetTokens.get(token);
  if (entry) resetTokens.set(token, { ...entry, used: true });
};
