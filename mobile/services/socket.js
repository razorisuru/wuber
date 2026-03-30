import { io } from 'socket.io-client';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

let socket = null;

/**
 * Connect to the backend Socket.io server with a Clerk bearer token.
 * Idempotent – returns the existing socket if already connected.
 * @param {string|null} token
 * @returns {import('socket.io-client').Socket}
 */
export function connectSocket(token) {
  if (socket?.connected) return socket;

  socket = io(BASE_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => console.log('[Socket] connected:', socket.id));
  socket.on('disconnect', (reason) => console.log('[Socket] disconnected:', reason));
  socket.on('connect_error', (err) => console.warn('[Socket] connect error:', err.message));

  return socket;
}

/**
 * Gracefully disconnect and clear the socket reference.
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Returns the active socket instance (or null if not connected).
 */
export function getSocket() {
  return socket;
}

/**
 * Emit a driver-location event.
 * @param {import('socket.io-client').Socket} s
 * @param {string} driverId
 * @param {number} lat
 * @param {number} lng
 */
export function emitDriverLocation(s, driverId, lat, lng) {
  s.emit('driver-location', { driverId, lat, lng });
}

/**
 * Subscribe to aggregated driver location updates (broadcast by the server).
 * The callback receives an array of driver objects built from individual updates.
 * @param {Function} onUpdate  - called with the latest driver array
 * @returns {Function} unsubscribe
 */
export function subscribeToDriverUpdates(onUpdate) {
  if (!socket) return () => {};

  const driversMap = new Map();

  const anyHandler = (event, data) => {
    if (event.startsWith('driver-location:')) {
      const driverId = event.split(':')[1];
      driversMap.set(driverId, { id: driverId, coordinates: { lat: data.lat, lng: data.lng } });
      onUpdate(Array.from(driversMap.values()));
    }
  };

  socket.onAny(anyHandler);

  return () => socket?.offAny(anyHandler);
}

/**
 * Subscribe to ride lifecycle events (for riders).
 * @param {{ onAccepted: Function, onCompleted: Function }} handlers
 * @returns {Function} unsubscribe function
 */
export function subscribeToRideEvents({ onAccepted, onCompleted }) {
  if (!socket) return () => {};

  socket.on('ride-accepted', onAccepted);
  socket.on('ride-completed', onCompleted);

  return () => {
    socket?.off('ride-accepted', onAccepted);
    socket?.off('ride-completed', onCompleted);
  };
}

/**
 * Subscribe to incoming ride request events (for drivers).
 * @param {import('socket.io-client').Socket} s
 * @param {Function} onRequest
 */
export function subscribeToRideRequests(s, onRequest) {
  s.on('ride-request', onRequest);
}
