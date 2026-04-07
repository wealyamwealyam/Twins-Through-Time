/**
 * userModel.js
 * -----------
 * In-memory user store. Replace with a real database (e.g. Mongoose / Prisma)
 * when a DB is connected. The shape of every user object matches the Account API
 * response documented in docs/apis.md.
 */

import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------
const users = new Map(); // key: uuid, value: user object

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create and store a new user. Returns the stored user (with hashed password). */
export const createUser = ({
  username,
  email,
  passwordHash,
  firstName,
  lastName,
  age = null,
  gender = null,
  accountType = 'community_member',
}) => {
  const user = {
    id: randomUUID(),
    username,
    email,
    passwordHash,        // never returned in responses — stripped by toPublic()
    firstName,
    lastName,
    accountType,         // 'community_member' | 'contributor' | 'admin'
    age,
    gender,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  users.set(user.id, user);
  return user;
};

/** Return a user by id, or null. */
export const findById = (id) => users.get(id) ?? null;

/** Return a user by email (case-insensitive), or null. */
export const findByEmail = (email) =>
  [...users.values()].find(
    (u) => u.email.toLowerCase() === email.toLowerCase()
  ) ?? null;

/** Return a user by username (case-insensitive), or null. */
export const findByUsername = (username) =>
  [...users.values()].find(
    (u) => u.username.toLowerCase() === username.toLowerCase()
  ) ?? null;

/** Return all users. */
export const findAll = () => [...users.values()];

/**
 * Partially update a user by id.
 * Only the fields present in `updates` are changed.
 * Returns the updated user, or null if not found.
 */
export const updateUser = (id, updates) => {
  const user = users.get(id);
  if (!user) return null;
  const updated = {
    ...user,
    ...updates,
    id,                            // id is immutable
    updatedAt: new Date().toISOString(),
  };
  users.set(id, updated);
  return updated;
};

/**
 * Strip sensitive fields before sending to a client.
 */
export const toPublic = (user) => {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
};
