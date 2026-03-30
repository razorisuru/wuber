import axios from 'axios';
import { useAuth } from '@clerk/clerk-expo';
import { useEffect, useRef } from 'react';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

export const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Call this once after Clerk is initialised to attach the token interceptor.
 * Pass the `getToken` function from `useAuth()`.
 * @param {Function} getToken
 * @returns {number} interceptor id (use api.interceptors.request.eject(id) to remove)
 */
export function attachAuthInterceptor(getToken) {
  return api.interceptors.request.use(async (config) => {
    try {
      const token = await getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Continue without token if getToken throws
    }
    return config;
  });
}

/**
 * Hook that wires up the auth interceptor for the current Clerk session.
 * Registers once and cleans up on unmount or when getToken changes.
 */
export function useApiAuth() {
  const { getToken } = useAuth();
  const interceptorId = useRef(null);

  useEffect(() => {
    if (interceptorId.current !== null) {
      api.interceptors.request.eject(interceptorId.current);
    }
    interceptorId.current = attachAuthInterceptor(getToken);

    return () => {
      if (interceptorId.current !== null) {
        api.interceptors.request.eject(interceptorId.current);
        interceptorId.current = null;
      }
    };
  }, [getToken]);
}
