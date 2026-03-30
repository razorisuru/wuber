const { clerkClient } = require('@clerk/clerk-sdk-node');

/**
 * Middleware that verifies a Clerk session token from the Authorization header.
 * On success, attaches req.userId and req.user to the request object.
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);

  try {
    // Verify the session token with Clerk
    const payload = await clerkClient.verifyToken(token);

    if (!payload || !payload.sub) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    req.userId = payload.sub;

    // Optionally fetch the full user object from Clerk
    try {
      req.user = await clerkClient.users.getUser(payload.sub);
    } catch (_userErr) {
      // Non-fatal: continue without the full user object
      req.user = { id: payload.sub };
    }

    return next();
  } catch (err) {
    console.error('Auth middleware error:', err.message);
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

module.exports = { requireAuth };
