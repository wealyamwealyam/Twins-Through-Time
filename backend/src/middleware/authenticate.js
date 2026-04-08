/**
 * authenticate.js
 * ---------------
 * Middleware that verifies the Bearer JWT in the Authorization header and
 * attaches the decoded payload to req.user.
 *
 * Expected header:
 *   Authorization: Bearer <token>
 *
 * Token payload shape (set at login/register):
 *   { id, username, accountType, iat, exp }
 */

import jwt from 'jsonwebtoken';
import { findById } from '../models/userModel.js';

// Read lazily so dotenv.config() in server.js has already run.
const getSecret = () => process.env.JWT_SECRET || 'change-me-in-production';

const authenticate = async (req, res, next) => {
  const authHeader = req.headers['authorization'] ?? '';

  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or malformed Authorization header.',
        details: null,
      },
    });
  }

  const token = authHeader.slice(7); // strip "Bearer "

  try {
    const decoded = jwt.verify(token, getSecret());

    const user = await findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not found or deactivated.',
          details: null,
        },
      });
    }

    req.user = {
      ...decoded,
      username: user.username,
      accountType: user.accountType,
    };

    next();
  } catch (err) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token.',
        details: null,
      },
    });
  }
};

export default authenticate;
