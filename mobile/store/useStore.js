import { create } from 'zustand';

export const useStore = create((set, get) => ({
  user: null,
  setUser: (user) => set({ user }),

  currentRide: null,
  setCurrentRide: (ride) =>
    set((state) => ({
      currentRide: typeof ride === 'function' ? ride(state.currentRide) : ride,
    })),

  nearbyDrivers: [],
  setNearbyDrivers: (drivers) => set({ nearbyDrivers: drivers }),

  driverLocation: null,
  setDriverLocation: (location) => set({ driverLocation: location }),

  isOnline: false,
  setIsOnline: (isOnline) => set({ isOnline }),
}));
