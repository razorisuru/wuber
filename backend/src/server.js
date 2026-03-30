require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const { updateDriverLocation, findNearbyDrivers, setDriverStatus } = require('./redis');
const ridesRouter = require('./routes/rides');
const usersRouter = require('./routes/users');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH'],
  },
});

app.use(cors());
app.use(express.json());

// Attach io instance so routes can emit events
app.set('io', io);

app.use('/api/rides', ridesRouter);
app.use('/api/users', usersRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Track which socket belongs to which user/driver
const driverSockets = new Map(); // driverId -> socketId
const riderSockets = new Map();  // riderId  -> socketId

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Track the authenticated userId for this socket
  let authenticatedUserId = null;

  // Client registers itself as rider or driver
  socket.on('register', ({ userId, role }) => {
    authenticatedUserId = userId;
    if (role === 'driver') {
      driverSockets.set(userId, socket.id);
      socket.join(`driver:${userId}`);
    } else {
      riderSockets.set(userId, socket.id);
      socket.join(`rider:${userId}`);
    }
    console.log(`Registered ${role} ${userId} -> ${socket.id}`);
  });

  // Driver sends their location
  socket.on('driver-location', async ({ driverId, lat, lng }) => {
    // Validate that the sender is the driver they claim to be
    if (!authenticatedUserId || driverId !== authenticatedUserId) {
      console.warn(`Blocked spoofed driver-location from socket ${socket.id}`);
      return;
    }
    try {
      await updateDriverLocation(driverId, lat, lng);

      // Broadcast updated location to any rider currently in a ride with this driver
      socket.broadcast.emit(`driver-location:${driverId}`, { lat, lng });
    } catch (err) {
      console.error('driver-location error:', err.message);
    }
  });

  // Rider requests a ride (also handled via REST, but socket path supported)
  socket.on('request-ride', async ({ riderId, originLat, originLng, destLat, destLng }) => {
    try {
      const nearbyDrivers = await findNearbyDrivers(originLng, originLat, 10);
      nearbyDrivers.forEach((driver) => {
        const driverSocketId = driverSockets.get(driver.name);
        if (driverSocketId) {
          io.to(driverSocketId).emit('ride-request', {
            riderId,
            originLat,
            originLng,
            destLat,
            destLng,
          });
        }
      });
    } catch (err) {
      console.error('request-ride error:', err.message);
    }
  });

  // Driver accepts a ride
  socket.on('accept-ride', ({ rideId, driverId, riderId }) => {
    const riderSocketId = riderSockets.get(riderId);
    if (riderSocketId) {
      io.to(riderSocketId).emit('ride-accepted', { rideId, driverId });
    }
  });

  // Ride completed
  socket.on('complete-ride', ({ rideId, riderId }) => {
    const riderSocketId = riderSockets.get(riderId);
    if (riderSocketId) {
      io.to(riderSocketId).emit('ride-completed', { rideId });
    }
  });

  socket.on('disconnect', () => {
    // Remove from tracking maps
    for (const [id, sid] of driverSockets.entries()) {
      if (sid === socket.id) {
        driverSockets.delete(id);
        setDriverStatus(id, 'offline').catch(() => {});
        break;
      }
    }
    for (const [id, sid] of riderSockets.entries()) {
      if (sid === socket.id) {
        riderSockets.delete(id);
        break;
      }
    }
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Expose socket maps for use in route handlers
app.set('driverSockets', driverSockets);
app.set('riderSockets', riderSockets);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Wuber backend running on port ${PORT}`);
});

module.exports = { app, io };
