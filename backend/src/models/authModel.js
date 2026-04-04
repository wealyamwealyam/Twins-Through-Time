/**
 * authModel.js
 * ------------
 * Supabase-backed stores for refresh tokens and password-reset tokens.
 *
 * Tables:
 *   refresh_tokens  – columns: token (text pk), user_id (uuid), expires_at (timestamptz)
 *   reset_tokens    – columns: token (text pk), user_id (uuid), expires_at (timestamptz), used (boolean)
 */

import { randomBytes } from 'crypto';
import { supabase } from '../config/supabase.js';

// ---------------------------------------------------------------------------
// Refresh tokens
// ---------------------------------------------------------------------------

export const createRefreshToken = async (userId, ttlDays = 30) => {
  const token     = randomBytes(40).toString('hex');
  const expiresAt = new Date(Date.now() + ttlDays * 86_400_000).toISOString();

  const { error } = await supabase
    .from('refresh_tokens')
    .insert([{ token, user_id: userId, expires_at: expiresAt }]);

  if (error) throw error;
  return token;
};

export const findRefreshToken = async (token) => {
  const { data, error } = await supabase
    .from('refresh_tokens')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (error || !data) return null;
  return { userId: data.user_id, expiresAt: data.expires_at };
};

export const deleteRefreshToken = async (token) => {
  const { error } = await supabase
    .from('refresh_tokens')
    .delete()
    .eq('token', token);

  if (error) throw error;
};

/** Invalidate ALL refresh tokens for a user (e.g. on account deactivation). */
export const deleteAllUserRefreshTokens = async (userId) => {
  const { error } = await supabase
    .from('refresh_tokens')
    .delete()
    .eq('user_id', userId);

  if (error) throw error;
};

// ---------------------------------------------------------------------------
// Password-reset tokens
// ---------------------------------------------------------------------------

export const createResetToken = async (userId, ttlMinutes = 60) => {
  const token     = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000).toISOString();

  const { error } = await supabase
    .from('reset_tokens')
    .insert([{ token, user_id: userId, expires_at: expiresAt, used: false }]);

  if (error) throw error;
  return token;
};

export const findResetToken = async (token) => {
  const { data, error } = await supabase
    .from('reset_tokens')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (error || !data) return null;
  return { userId: data.user_id, expiresAt: data.expires_at, used: data.used };
};

export const markResetTokenUsed = async (token) => {
  const { error } = await supabase
    .from('reset_tokens')
    .update({ used: true })
    .eq('token', token);

  if (error) throw error;
};
