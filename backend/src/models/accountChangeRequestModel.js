/**
 * accountChangeRequestModel.js
 * ----------------------------
 * In-memory store for AccountChangeRequest objects.
 * Replace with a real DB (Prisma / Mongoose) when one is connected.
 *
 * Shape of an AccountChangeRequest:
 * {
 *   id               : uuid
 *   userId           : uuid          – the requesting user
 *   currentAccount   : string        – role at time of submission
 *   requestingAccount: string        – 'contributor' | 'admin'
 *   reasonMessage    : string
 *   status           : 'pending' | 'approved' | 'rejected'
 *   adminNote        : string | null – set on approve/reject
 *   reviewedBy       : uuid   | null – admin who acted
 *   reviewedAt       : ISO    | null
 *   createdAt        : ISO
 *   updatedAt        : ISO
 * }
 */

import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------
const requests = new Map(); // key: uuid → AccountChangeRequest

// ---------------------------------------------------------------------------
// CRUD helpers
// ---------------------------------------------------------------------------

/** Create and persist a new request. Returns the stored object. */
export const createRequest = ({
  userId,
  currentAccount,
  requestingAccount,
  reasonMessage,
}) => {
  const now = new Date().toISOString();
  const req = {
    id: randomUUID(),
    userId,
    currentAccount,
    requestingAccount,
    reasonMessage,
    status: 'pending',
    adminNote: null,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  requests.set(req.id, req);
  return req;
};

/** Return a request by id, or null. */
export const findRequestById = (id) => requests.get(id) ?? null;

/**
 * Return all requests, with optional status filter.
 * Supports pagination via `page` (1-based) and `limit`.
 */
export const findAllRequests = ({ status, page = 1, limit = 20 } = {}) => {
  let all = [...requests.values()];
  if (status) all = all.filter((r) => r.status === status);
  const total = all.length;
  const safeLimit = Math.min(Math.max(1, limit), 100);
  const safePage  = Math.max(1, page);
  const data = all.slice((safePage - 1) * safeLimit, safePage * safeLimit);
  return { data, total, page: safePage, limit: safeLimit };
};

/** Return all requests belonging to a specific user. */
export const findRequestsByUserId = (userId) =>
  [...requests.values()].filter((r) => r.userId === userId);

/**
 * Partially update a request.
 * Returns the updated request, or null if not found.
 */
export const updateRequest = (id, updates) => {
  const existing = requests.get(id);
  if (!existing) return null;
  const updated = {
    ...existing,
    ...updates,
    id,
    updatedAt: new Date().toISOString(),
  };
  requests.set(id, updated);
  return updated;
};
