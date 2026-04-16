/**
 * userModel.js
 * -----------
 * Supabase-backed user store.
 * Table: users
 * Columns: id (uuid pk), username, email, password_hash, first_name,
 *          last_name, account_type, age, gender, is_active,
 *          created_at, updated_at
 */

import { supabase } from '../config/supabase.js';

// ---------------------------------------------------------------------------
// Column mapping helpers (DB snake_case ↔ JS camelCase)
// ---------------------------------------------------------------------------

const toDb = (obj) => ({
  ...(obj.username       !== undefined && { username:       obj.username }),
  ...(obj.email          !== undefined && { email:          obj.email }),
  ...(obj.passwordHash   !== undefined && { password_hash:  obj.passwordHash }),
  ...(obj.firstName      !== undefined && { first_name:     obj.firstName }),
  ...(obj.lastName       !== undefined && { last_name:      obj.lastName }),
  ...(obj.accountType    !== undefined && { account_type:   obj.accountType }),
  ...(obj.age            !== undefined && { age:            obj.age }),
  ...(obj.gender         !== undefined && { gender:         obj.gender }),
  ...(obj.isActive       !== undefined && { is_active:      obj.isActive }),
});

const fromDb = (row) => {
  if (!row) return null;
  return {
    id:           row.id,
    username:     row.username,
    email:        row.email,
    passwordHash: row.password_hash,
    firstName:    row.first_name,
    lastName:     row.last_name,
    accountType:  row.account_type,
    age:          row.age,
    gender:       row.gender,
    isActive:     row.is_active,
    createdAt:    row.created_at,
    updatedAt:    row.updated_at,
  };
};

// ---------------------------------------------------------------------------
// CRUD helpers
// ---------------------------------------------------------------------------

/** Create and store a new user. Returns the stored user (with hashed password). */
export const createUser = async ({
  username,
  email,
  passwordHash,
  firstName,
  lastName,
  age = null,
  gender = null,
  accountType = 'community_member',
}) => {
  const { data, error } = await supabase
    .from('users')
    .insert([toDb({ username, email, passwordHash, firstName, lastName, age, gender, accountType, isActive: true })])
    .select()
    .single();

  if (error) throw error;
  return fromDb(data);
};

/** Return a user by id, or null. */
export const findById = async (id) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return fromDb(data);
};

/** Return a user by email (case-insensitive), or null. */
export const findByEmail = async (email) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .ilike('email', email)
    .maybeSingle();

  if (error) return null;
  return fromDb(data);
};

/** Return a user by username (case-insensitive), or null. */
export const findByUsername = async (username) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .ilike('username', username)
    .maybeSingle();

  if (error) return null;
  return fromDb(data);
};

/** Return all users. */
export const findAll = async () => {
  const { data, error } = await supabase.from('users').select('*');
  if (error) throw error;
  return (data ?? []).map(fromDb);
};

/**
 * Partially update a user by id.
 * Only the fields present in `updates` are changed.
 * Returns the updated user, or null if not found.
 */
export const updateUser = async (id, updates) => {
  const { data, error } = await supabase
    .from('users')
    .update(toDb(updates))
    .eq('id', id)
    .select()
    .single();

  if (error) return null;
  return fromDb(data);
};

/**
 * Strip sensitive fields before sending to a client.
 */
export const toPublic = (user) => {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
};

/**
 * Delete user id.
 */
export const deleteUserById = async (id) => {
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
};
