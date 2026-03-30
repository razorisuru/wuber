const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { apiLimiter, writeLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Apply rate limiting to all user routes
router.use(apiLimiter);

// POST /api/users – create or sync a user after Clerk auth
router.post('/', writeLimiter, requireAuth, async (req, res) => {
  const { email, role } = req.body;
  const clerkId = req.userId;

  try {
    const result = await query(
      `INSERT INTO users (clerk_id, email, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (clerk_id) DO UPDATE
         SET email = EXCLUDED.email
       RETURNING *`,
      [clerkId, email || req.user?.emailAddresses?.[0]?.emailAddress || null, role || 'rider']
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /users error:', err.message);
    return res.status(500).json({ error: 'Failed to create/sync user' });
  }
});

// GET /api/users/me – get current user profile
router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT u.*, d.car_type, d.rating
       FROM users u
       LEFT JOIN drivers d ON d.user_id = u.id
       WHERE u.clerk_id = $1`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('GET /users/me error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// PATCH /api/users/me – update current user profile
router.patch('/me', requireAuth, async (req, res) => {
  const { email, role, car_type } = req.body;

  try {
    // Update base user record
    const userResult = await query(
      `UPDATE users
       SET email = COALESCE($1, email),
           role  = COALESCE($2, role)
       WHERE clerk_id = $3
       RETURNING *`,
      [email, role, req.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // If car_type provided, upsert drivers record
    if (car_type !== undefined) {
      await query(
        `INSERT INTO drivers (user_id, car_type)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET car_type = EXCLUDED.car_type`,
        [user.id, car_type]
      );
    }

    return res.json(user);
  } catch (err) {
    console.error('PATCH /users/me error:', err.message);
    return res.status(500).json({ error: 'Failed to update user' });
  }
});

module.exports = router;
