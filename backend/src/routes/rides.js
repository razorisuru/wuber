const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { apiLimiter, writeLimiter } = require('../middleware/rateLimiter');
const { haversineDistance, calculateFare } = require('../utils/fare');
const { findNearbyDrivers } = require('../redis');

const router = express.Router();

// Apply rate limiting to all ride routes
router.use(apiLimiter);

// All ride routes require authentication
router.use(requireAuth);

// POST /api/rides – create a new ride request
router.post('/', writeLimiter, async (req, res) => {
  const { origin_lat, origin_lng, dest_lat, dest_lng } = req.body;

  if (origin_lat == null || origin_lng == null || dest_lat == null || dest_lng == null) {
    return res.status(400).json({ error: 'origin_lat, origin_lng, dest_lat, dest_lng are required' });
  }

  try {
    const distance = haversineDistance(origin_lat, origin_lng, dest_lat, dest_lng);
    const fare = calculateFare(distance);

    // Resolve DB user id from clerk id
    const userResult = await query(
      'SELECT id FROM users WHERE clerk_id = $1',
      [req.userId]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found. Please sync your account first.' });
    }
    const riderId = userResult.rows[0].id;

    const result = await query(
      `INSERT INTO rides
        (rider_id, status, fare, origin_lat, origin_lng, dest_lat, dest_lng)
       VALUES ($1, 'pending', $2, $3, $4, $5, $6)
       RETURNING *`,
      [riderId, fare, origin_lat, origin_lng, dest_lat, dest_lng]
    );

    const ride = result.rows[0];

    // Notify nearby drivers via Socket.io
    try {
      const io = req.app.get('io');
      const driverSockets = req.app.get('driverSockets');
      const nearbyDrivers = await findNearbyDrivers(origin_lng, origin_lat, 10);

      nearbyDrivers.forEach((driver) => {
        const driverSocketId = driverSockets.get(driver.name);
        if (driverSocketId) {
          io.to(driverSocketId).emit('ride-request', {
            rideId: ride.id,
            riderId: ride.rider_id,
            originLat: ride.origin_lat,
            originLng: ride.origin_lng,
            destLat: ride.dest_lat,
            destLng: ride.dest_lng,
            fare: ride.fare,
          });
        }
      });
    } catch (socketErr) {
      console.error('Socket notification error:', socketErr.message);
    }

    return res.status(201).json(ride);
  } catch (err) {
    console.error('POST /rides error:', err.message);
    return res.status(500).json({ error: 'Failed to create ride' });
  }
});

// GET /api/rides/history – must come before /:id to avoid shadowing
router.get('/history', async (req, res) => {
  try {
    const userResult = await query('SELECT id FROM users WHERE clerk_id = $1', [req.userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const userId = userResult.rows[0].id;

    const result = await query(
      `SELECT r.*, 
              u.email AS driver_email
       FROM rides r
       LEFT JOIN users u ON u.id = r.driver_id
       WHERE r.rider_id = $1 OR r.driver_id = $1
       ORDER BY r.created_at DESC
       LIMIT 50`,
      [userId]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error('GET /rides/history error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// GET /api/rides/:id – get ride details
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query(
      `SELECT r.*,
              rider.email AS rider_email,
              driver.email AS driver_email
       FROM rides r
       LEFT JOIN users rider  ON rider.id  = r.rider_id
       LEFT JOIN users driver ON driver.id = r.driver_id
       WHERE r.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ride not found' });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('GET /rides/:id error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch ride' });
  }
});

// POST /api/rides/:id/accept – driver accepts a ride
router.post('/:id/accept', async (req, res) => {
  const { id } = req.params;

  try {
    const driverUserResult = await query(
      'SELECT id FROM users WHERE clerk_id = $1',
      [req.userId]
    );
    if (driverUserResult.rows.length === 0) {
      return res.status(404).json({ error: 'Driver user not found' });
    }
    const driverUserId = driverUserResult.rows[0].id;

    const result = await query(
      `UPDATE rides
       SET status = 'accepted', driver_id = $1
       WHERE id = $2 AND status = 'pending'
       RETURNING *`,
      [driverUserId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ride not found or already accepted' });
    }

    const ride = result.rows[0];

    // Notify the rider
    try {
      const io = req.app.get('io');
      const riderSockets = req.app.get('riderSockets');

      // Look up rider's clerk_id to find their socket
      const riderResult = await query('SELECT clerk_id FROM users WHERE id = $1', [ride.rider_id]);
      if (riderResult.rows.length > 0) {
        const riderClerkId = riderResult.rows[0].clerk_id;
        const riderSocketId = riderSockets.get(riderClerkId);
        if (riderSocketId) {
          io.to(riderSocketId).emit('ride-accepted', {
            rideId: ride.id,
            driverId: driverUserId,
          });
        }
      }
    } catch (socketErr) {
      console.error('Socket notification error:', socketErr.message);
    }

    return res.json(ride);
  } catch (err) {
    console.error('POST /rides/:id/accept error:', err.message);
    return res.status(500).json({ error: 'Failed to accept ride' });
  }
});

// POST /api/rides/:id/complete – complete a ride
router.post('/:id/complete', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query(
      `UPDATE rides
       SET status = 'completed'
       WHERE id = $1 AND status = 'accepted'
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ride not found or not in accepted state' });
    }

    const ride = result.rows[0];

    // Notify the rider
    try {
      const io = req.app.get('io');
      const riderSockets = req.app.get('riderSockets');

      const riderResult = await query('SELECT clerk_id FROM users WHERE id = $1', [ride.rider_id]);
      if (riderResult.rows.length > 0) {
        const riderClerkId = riderResult.rows[0].clerk_id;
        const riderSocketId = riderSockets.get(riderClerkId);
        if (riderSocketId) {
          io.to(riderSocketId).emit('ride-completed', { rideId: ride.id });
        }
      }
    } catch (socketErr) {
      console.error('Socket notification error:', socketErr.message);
    }

    return res.json(ride);
  } catch (err) {
    console.error('POST /rides/:id/complete error:', err.message);
    return res.status(500).json({ error: 'Failed to complete ride' });
  }
});

module.exports = router;
