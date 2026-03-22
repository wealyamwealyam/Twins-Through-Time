/**
 * accountChangeRequestController.js
 * ----------------------------------
 * Handlers for the Account Change Request API (§3 in docs/apis.md).
 *
 * Routes (mounted at /api/account-change-requests):
 *   POST   /                    🔒  submitRequest
 *   GET    /                    🔴  listRequests
 *   GET    /me                  🔒  getOwnRequests
 *   GET    /:id                 🔴  getRequestById
 *   PATCH  /:id                 🔴  reviewRequest
 */

import {
  createRequest,
  findAllRequests,
  findRequestById,
  findRequestsByUserId,
  updateRequest,
} from '../models/accountChangeRequestModel.js';

import { findById as findUserById, updateUser } from '../models/userModel.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ALLOWED_REQUESTING_ACCOUNTS = ['contributor', 'admin'];
const ALLOWED_REVIEW_STATUSES     = ['approved', 'rejected'];

// ---------------------------------------------------------------------------
// Shared error helper
// ---------------------------------------------------------------------------
const errBody = (code, message, details = null) => ({
  error: { code, message, details },
});

// ---------------------------------------------------------------------------
// POST /account-change-requests  🔒
// ---------------------------------------------------------------------------
export const submitRequest = (req, res) => {
  const { requestingAccount, reasonMessage } = req.body ?? {};

  // ── Validate requestingAccount ──────────────────────────────────────────
  if (!requestingAccount) {
    return res.status(400).json(
      errBody('VALIDATION_ERROR', '`requestingAccount` is required.')
    );
  }
  if (!ALLOWED_REQUESTING_ACCOUNTS.includes(requestingAccount)) {
    return res.status(400).json(
      errBody(
        'VALIDATION_ERROR',
        `\`requestingAccount\` must be one of: ${ALLOWED_REQUESTING_ACCOUNTS.join(', ')}.`
      )
    );
  }

  // ── Validate reasonMessage ──────────────────────────────────────────────
  if (!reasonMessage || typeof reasonMessage !== 'string' || !reasonMessage.trim()) {
    return res.status(400).json(
      errBody('VALIDATION_ERROR', '`reasonMessage` is required and must be a non-empty string.')
    );
  }
  if (reasonMessage.trim().length > 1000) {
    return res.status(400).json(
      errBody('VALIDATION_ERROR', '`reasonMessage` must be 1000 characters or fewer.')
    );
  }

  // ── Business rule: can't request the role you already have ─────────────
  const { id: userId, accountType: currentAccount } = req.user;
  if (requestingAccount === currentAccount) {
    return res.status(422).json(
      errBody(
        'UNPROCESSABLE',
        `Your account is already \`${currentAccount}\`.`
      )
    );
  }

  // ── Business rule: community_member can only request contributor ────────
  //    contributor can only request admin
  const hierarchy = ['community_member', 'contributor', 'admin'];
  const currentIdx  = hierarchy.indexOf(currentAccount);
  const requestedIdx = hierarchy.indexOf(requestingAccount);
  if (requestedIdx <= currentIdx) {
    return res.status(422).json(
      errBody(
        'UNPROCESSABLE',
        'You may only request a role that is higher than your current role.'
      )
    );
  }

  // ── Business rule: no duplicate pending requests ────────────────────────
  const existing = findRequestsByUserId(userId).find(
    (r) => r.status === 'pending' && r.requestingAccount === requestingAccount
  );
  if (existing) {
    return res.status(409).json(
      errBody(
        'CONFLICT',
        `You already have a pending request for \`${requestingAccount}\`.`
      )
    );
  }

  const newRequest = createRequest({
    userId,
    currentAccount,
    requestingAccount,
    reasonMessage: reasonMessage.trim(),
  });

  return res.status(201).json(newRequest);
};

// ---------------------------------------------------------------------------
// GET /account-change-requests  🔴  (admin only)
// ---------------------------------------------------------------------------
export const listRequests = (req, res) => {
  const { status, page, limit } = req.query;

  if (status && !['pending', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json(
      errBody(
        'VALIDATION_ERROR',
        '`status` must be one of: pending, approved, rejected.'
      )
    );
  }

  const result = findAllRequests({
    status: status || undefined,
    page:  page  ? parseInt(page,  10) : 1,
    limit: limit ? parseInt(limit, 10) : 20,
  });

  return res.status(200).json(result);
};

// ---------------------------------------------------------------------------
// GET /account-change-requests/me  🔒
// ---------------------------------------------------------------------------
export const getOwnRequests = (req, res) => {
  const requests = findRequestsByUserId(req.user.id);
  return res.status(200).json(requests);
};

// ---------------------------------------------------------------------------
// GET /account-change-requests/:id  🔴  (admin only)
// ---------------------------------------------------------------------------
export const getRequestById = (req, res) => {
  const request = findRequestById(req.params.id);
  if (!request) {
    return res.status(404).json(
      errBody('NOT_FOUND', 'Account change request not found.')
    );
  }
  return res.status(200).json(request);
};

// ---------------------------------------------------------------------------
// PATCH /account-change-requests/:id  🔴  (admin only)
// ---------------------------------------------------------------------------
export const reviewRequest = (req, res) => {
  const { status } = req.body ?? {};

  if (!status) {
    return res.status(400).json(
      errBody('VALIDATION_ERROR', '`status` is required.')
    );
  }
  if (!ALLOWED_REVIEW_STATUSES.includes(status)) {
    return res.status(400).json(
      errBody(
        'VALIDATION_ERROR',
        `\`status\` must be one of: ${ALLOWED_REVIEW_STATUSES.join(', ')}.`
      )
    );
  }

  const request = findRequestById(req.params.id);
  if (!request) {
    return res.status(404).json(
      errBody('NOT_FOUND', 'Account change request not found.')
    );
  }

  if (request.status !== 'pending') {
    return res.status(422).json(
      errBody(
        'UNPROCESSABLE',
        `This request has already been \`${request.status}\` and cannot be changed.`
      )
    );
  }

  const now = new Date().toISOString();

  const updated = updateRequest(request.id, {
    status,
    reviewedBy: req.user.id,
    reviewedAt: now,
  });

  // ── On approval: promote the user's accountType ────────────────────────
  if (status === 'approved') {
    updateUser(request.userId, { accountType: request.requestingAccount });
  }

  return res.status(200).json(updated);
};
