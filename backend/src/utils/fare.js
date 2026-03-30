/**
 * Haversine formula – returns the distance in kilometres between two GPS points.
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} distance in km
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate the ride fare.
 * Formula: base(100) + distance(km)*50 + estimatedTime(min)*10
 * @param {number} distance  - in km
 * @param {number} time      - estimated minutes (defaults to distance * 3 if omitted)
 * @returns {number} fare amount
 */
function calculateFare(distance, time) {
  const base = 100;
  const estimatedTime = time !== undefined ? time : distance * 3;
  return base + distance * 50 + estimatedTime * 10;
}

module.exports = { haversineDistance, calculateFare };
