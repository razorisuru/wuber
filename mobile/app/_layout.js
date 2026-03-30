import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { Slot } from 'expo-router';
import { useEffect, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import { api, attachAuthInterceptor } from '../services/api';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

// Clerk token cache backed by expo-secure-store
const tokenCache = {
  async getToken(key) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key, value) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // ignore
    }
  },
};

// Wire the Clerk token into every axios request (registered once per session)
function ApiAuthProvider({ children }) {
  const { getToken } = useAuth();
  const interceptorId = useRef(null);

  useEffect(() => {
    // Only attach once; eject the previous one if getToken reference changes
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

  return children;
}

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ApiAuthProvider>
        <Slot />
      </ApiAuthProvider>
    </ClerkProvider>
  );
}
