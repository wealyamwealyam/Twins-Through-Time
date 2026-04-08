/**
 * authenticateWorker.js
 * ---------------------
 * Middleware that authenticates requests from the internal Python scraper worker.
 *
 * Expected header:
 *   X-Worker-Secret: <WORKER_SECRET from .env>
 *
 * This is intentionally separate from the JWT-based `authenticate` middleware so
 * that internal worker endpoints are never accidentally exposed to normal users.
 */

const authenticateWorker = (req, res, next) => {
  const secret = process.env.WORKER_SECRET;

  if (!secret) {
    return res.status(500).json({
      error: {
        code: 'SERVER_MISCONFIGURED',
        message: 'WORKER_SECRET is not set on the server.',
        details: null,
      },
    });
  }

  const provided = req.headers['x-worker-secret'];

  if (!provided || provided !== secret) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or missing worker secret.',
        details: null,
      },
    });
  }

  next();
};

export default authenticateWorker;
