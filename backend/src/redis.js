require('dotenv').config();
const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  lazyConnect: true,
  retryStrategy: (times) => Math.min(times * 100, 3000),
});

redis.on('connect', () => console.log('Redis connected'));
redis.on('error', (err) => console.error('Redis error:', err.message));

const GEO_KEY = 'drivers:geo';

/**
 * Store or update a driver's geo position.
 * @param {string} driverId
 * @param {number} lat
 * @param {number} lng
 */
async function updateDriverLocation(driverId, lat, lng) {
  await redis.geoadd(GEO_KEY, lng, lat, driverId);
}

/**
 * Find drivers within `radiusKm` kilometres of a point.
 * Returns an array of objects with `name` (driverId) and `coordinates`.
 * @param {number} lng
 * @param {number} lat
 * @param {number} radiusKm
 */
async function findNearbyDrivers(lng, lat, radiusKm = 5) {
  // GEOSEARCH FROMLONLAT <lng> <lat> BYRADIUS <r> km ASC WITHCOORD
  const results = await redis.call(
    'GEOSEARCH',
    GEO_KEY,
    'FROMLONLAT', lng, lat,
    'BYRADIUS', radiusKm, 'km',
    'ASC',
    'WITHCOORD'
  );

  return results.map(([name, [memberLng, memberLat]]) => ({
    name,
    coordinates: { lat: parseFloat(memberLat), lng: parseFloat(memberLng) },
  }));
}

/**
 * Persist a driver's online/offline status.
 * @param {string} driverId
 * @param {'online'|'offline'} status
 */
async function setDriverStatus(driverId, status) {
  await redis.set(`driver:status:${driverId}`, status, 'EX', 3600);
}

/**
 * Retrieve a driver's current status.
 * @param {string} driverId
 * @returns {Promise<string|null>}
 */
async function getDriverStatus(driverId) {
  return redis.get(`driver:status:${driverId}`);
}

module.exports = {
  default: redis,
  redis,
  updateDriverLocation,
  findNearbyDrivers,
  setDriverStatus,
  getDriverStatus,
};
