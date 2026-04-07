/**
 * authorize.js
 * ------------
 * Role-based access guard.  Must be used AFTER authenticate middleware.
 *
 * Usage:
 *   import authorize from '../middleware/authorize.js';
 *
 *   router.get('/admin-only', authenticate, authorize('admin'), handler);
 *   router.get('/contrib-or-admin', authenticate, authorize('contributor', 'admin'), handler);
 *
 * Roles (highest → lowest):
 *   admin  >  contributor  >  community_member
 */

const ROLE_RANK = {
  community_member: 0,
  contributor: 1,
  admin: 2,
};

/**
 * Returns middleware that allows only users whose accountType is one of
 * the provided *allowedRoles*.
 */
const authorize = (...allowedRoles) => (req, res, next) => {
  const userRole = req.user?.accountType;

  if (!userRole || !allowedRoles.includes(userRole)) {
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'You do not have permission to perform this action.',
        details: null,
      },
    });
  }

  next();
};

export default authorize;
