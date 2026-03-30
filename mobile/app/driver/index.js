import { useAuth } from '@clerk/clerk-expo';
import MapLibreGL from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
} from 'react-native';
import { useStore } from '../../store/useStore';
import { api } from '../../services/api';
import {
  connectSocket,
  disconnectSocket,
  emitDriverLocation,
  subscribeToRideRequests,
} from '../../services/socket';
import { setDriverStatus } from '../../services/driverStatus';

MapLibreGL.setAccessToken(null);

export default function DriverMapScreen() {
  const { getToken, userId } = useAuth();
  const { isOnline, setIsOnline } = useStore();

  const [driverLocation, setDriverLocation] = useState(null);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [activeRide, setActiveRide] = useState(null);
  const [processing, setProcessing] = useState(false);
  const locationIntervalRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required.');
      }

      const loc = await Location.getCurrentPositionAsync({});
      setDriverLocation(loc.coords);
    })();

    return () => {
      stopLocationBroadcast();
      disconnectSocket();
    };
  }, []);

  const startLocationBroadcast = () => {
    if (locationIntervalRef.current) return;
    locationIntervalRef.current = setInterval(async () => {
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setDriverLocation(loc.coords);
        if (socketRef.current && userId) {
          emitDriverLocation(socketRef.current, userId, loc.coords.latitude, loc.coords.longitude);
        }
      } catch (err) {
        console.warn('Location broadcast error:', err.message);
      }
    }, 3000);
  };

  const stopLocationBroadcast = () => {
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
  };

  const handleGoOnline = async () => {
    try {
      const token = await getToken();
      const socket = connectSocket(token);
      socketRef.current = socket;

      socket.emit('register', { userId, role: 'driver' });

      subscribeToRideRequests(socket, (request) => {
        setIncomingRequests((prev) => {
          const exists = prev.find((r) => r.rideId === request.rideId);
          return exists ? prev : [request, ...prev];
        });
      });

      startLocationBroadcast();
      setIsOnline(true);
      await api.patch('/users/me', { role: 'driver' });
    } catch (err) {
      Alert.alert('Error', 'Failed to go online');
    }
  };

  const handleGoOffline = () => {
    stopLocationBroadcast();
    disconnectSocket();
    socketRef.current = null;
    setIsOnline(false);
    setIncomingRequests([]);
  };

  const handleAccept = async (request) => {
    setProcessing(true);
    try {
      const { data } = await api.post(`/rides/${request.rideId}/accept`);
      setActiveRide(data);
      setIncomingRequests((prev) => prev.filter((r) => r.rideId !== request.rideId));
      Alert.alert('Ride Accepted', `Heading to pickup: ${request.originLat?.toFixed(4)}, ${request.originLng?.toFixed(4)}`);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to accept ride');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = (request) => {
    setIncomingRequests((prev) => prev.filter((r) => r.rideId !== request.rideId));
  };

  const handleCompleteRide = async () => {
    if (!activeRide) return;
    setProcessing(true);
    try {
      await api.post(`/rides/${activeRide.id}/complete`);
      setActiveRide(null);
      Alert.alert('Ride Completed', 'Great job! Ready for the next ride.');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to complete ride');
    } finally {
      setProcessing(false);
    }
  };

  const centerCoord = driverLocation
    ? [driverLocation.longitude, driverLocation.latitude]
    : [3.3792, 6.5244];

  return (
    <View style={styles.container}>
      <MapLibreGL.MapView
        style={styles.map}
        styleURL="https://demotiles.maplibre.org/style.json"
      >
        <MapLibreGL.Camera
          zoomLevel={14}
          centerCoordinate={centerCoord}
          animationMode="flyTo"
          animationDuration={800}
        />

        {driverLocation && (
          <MapLibreGL.PointAnnotation
            id="driver-self"
            coordinate={[driverLocation.longitude, driverLocation.latitude]}
          >
            <View style={[styles.driverMarker, isOnline && styles.driverMarkerOnline]} />
          </MapLibreGL.PointAnnotation>
        )}
      </MapLibreGL.MapView>

      {/* Online/Offline toggle */}
      <View style={styles.toggleBar}>
        <TouchableOpacity
          style={[styles.toggleButton, isOnline ? styles.onlineButton : styles.offlineButton]}
          onPress={isOnline ? handleGoOffline : handleGoOnline}
        >
          <Text style={styles.toggleText}>
            {isOnline ? '● ONLINE – Tap to go offline' : '○ OFFLINE – Tap to go online'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Active ride card */}
      {activeRide && (
        <View style={styles.activeRideCard}>
          <Text style={styles.activeRideTitle}>Active Ride</Text>
          <Text style={styles.activeRideInfo}>
            From: {activeRide.origin_lat?.toFixed(4)}, {activeRide.origin_lng?.toFixed(4)}
          </Text>
          <Text style={styles.activeRideInfo}>
            To: {activeRide.dest_lat?.toFixed(4)}, {activeRide.dest_lng?.toFixed(4)}
          </Text>
          <Text style={styles.activeRideFare}>₦{activeRide.fare?.toFixed(0)}</Text>
          <TouchableOpacity
            style={[styles.completeButton, processing && styles.buttonDisabled]}
            onPress={handleCompleteRide}
            disabled={processing}
          >
            {processing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.completeButtonText}>Complete Ride</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Incoming ride requests */}
      {!activeRide && incomingRequests.length > 0 && (
        <View style={styles.requestsContainer}>
          <Text style={styles.requestsTitle}>Incoming Requests</Text>
          <FlatList
            data={incomingRequests}
            keyExtractor={(item) => item.rideId}
            renderItem={({ item }) => (
              <View style={styles.requestCard}>
                <Text style={styles.requestInfo}>
                  From: {item.originLat?.toFixed(4)}, {item.originLng?.toFixed(4)}
                </Text>
                <Text style={styles.requestInfo}>
                  To: {item.destLat?.toFixed(4)}, {item.destLng?.toFixed(4)}
                </Text>
                {item.fare && <Text style={styles.requestFare}>₦{item.fare?.toFixed(0)}</Text>}
                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={() => handleAccept(item)}
                    disabled={processing}
                  >
                    <Text style={styles.acceptText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.rejectButton}
                    onPress={() => handleReject(item)}
                  >
                    <Text style={styles.rejectText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  driverMarker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#8E8E93',
    borderWidth: 2,
    borderColor: '#fff',
  },
  driverMarkerOnline: { backgroundColor: '#34C759' },
  toggleBar: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
  },
  toggleButton: {
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  onlineButton: { backgroundColor: '#34C759' },
  offlineButton: { backgroundColor: '#111' },
  toggleText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  activeRideCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#111',
    padding: 20,
    paddingBottom: 36,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  activeRideTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 8 },
  activeRideInfo: { color: '#ccc', fontSize: 14, marginBottom: 4 },
  activeRideFare: { color: '#34C759', fontSize: 22, fontWeight: '800', marginVertical: 8 },
  completeButton: {
    backgroundColor: '#34C759',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  completeButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  buttonDisabled: { opacity: 0.6 },
  requestsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: 320,
    backgroundColor: '#111',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 32,
  },
  requestsTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 10 },
  requestCard: {
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  requestInfo: { color: '#ccc', fontSize: 13, marginBottom: 4 },
  requestFare: { color: '#FFD60A', fontSize: 18, fontWeight: '800', marginVertical: 4 },
  requestActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  acceptButton: {
    flex: 1,
    backgroundColor: '#34C759',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  acceptText: { color: '#fff', fontWeight: '700' },
  rejectButton: {
    flex: 1,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  rejectText: { color: '#fff', fontWeight: '700' },
});
