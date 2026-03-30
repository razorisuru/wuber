/**
 * Thin helper module for driver status API calls.
 * Kept separate to avoid circular imports between socket.js and api.js.
 */
import { api } from './api';

/**
 * Update the driver's online/offline status via REST.
 * @param {'online'|'offline'} status
 */
export async function setDriverStatus(status) {
  try {
    await api.patch('/users/me', { status });
  } catch (err) {
    console.warn('setDriverStatus failed:', err.message);
  }
}
