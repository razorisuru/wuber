import { useAuth } from '@clerk/clerk-expo';
import MapLibreGL from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useStore } from '../../store/useStore';
import { api } from '../../services/api';
import {
  connectSocket,
  disconnectSocket,
  subscribeToDriverUpdates,
  subscribeToRideEvents,
} from '../../services/socket';

MapLibreGL.setAccessToken(null);

export default function RiderMapScreen() {
  const { getToken } = useAuth();
  const { nearbyDrivers, setNearbyDrivers, currentRide, setCurrentRide } = useStore();

  const [userLocation, setUserLocation] = useState(null);
  const [destination, setDestination] = useState('');
  const [destCoords, setDestCoords] = useState(null);
  const [fareEstimate, setFareEstimate] = useState(null);
  const [requesting, setRequesting] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const cameraRef = useRef(null);

  useEffect(() => {
    let locationSub;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setUserLocation(loc.coords);

      locationSub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 20 },
        (l) => setUserLocation(l.coords)
      );
    })();

    // Connect socket and subscribe to updates
    let unsubDriverUpdates = () => {};
    let unsubRideEvents = () => {};

    (async () => {
      const token = await getToken();
      connectSocket(token);

      unsubDriverUpdates = subscribeToDriverUpdates((drivers) => setNearbyDrivers(drivers));
      unsubRideEvents = subscribeToRideEvents({
        onAccepted: (data) => {
          Alert.alert('Ride Accepted', `Driver is on the way! Ride ID: ${data.rideId}`);
          setCurrentRide((prev) => ({ ...prev, ...data, status: 'accepted' }));
        },
        onCompleted: () => {
          Alert.alert('Ride Completed', 'Thanks for riding with Wuber!');
          setCurrentRide(null);
        },
      });
    })();

    return () => {
      locationSub?.remove();
      unsubDriverUpdates();
      unsubRideEvents();
      disconnectSocket();
    };
  }, []);

  // Rough fare estimate whenever destination coords are set
  useEffect(() => {
    if (!userLocation || !destCoords) return;
    const dist = haversine(
      userLocation.latitude,
      userLocation.longitude,
      destCoords.lat,
      destCoords.lng
    );
    const fare = 100 + dist * 50 + dist * 3 * 10;
    setFareEstimate(Math.round(fare));
  }, [destCoords, userLocation]);

  const handleRequestRide = async () => {
    if (!userLocation) {
      Alert.alert('Location unavailable', 'Please wait for your location to load.');
      return;
    }
    if (!destCoords) {
      Alert.alert('No destination', 'Please enter a destination first.');
      return;
    }

    setRequesting(true);
    try {
      const { data } = await api.post('/rides', {
        origin_lat: userLocation.latitude,
        origin_lng: userLocation.longitude,
        dest_lat: destCoords.lat,
        dest_lng: destCoords.lng,
      });
      setCurrentRide(data);
      Alert.alert('Ride Requested', `Fare: ₦${data.fare?.toFixed(0)}. Looking for drivers...`);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to request ride');
    } finally {
      setRequesting(false);
    }
  };

  // Parse a simple "lat,lng" destination string
  const handleDestinationSubmit = () => {
    const parts = destination.split(',').map((s) => parseFloat(s.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      setDestCoords({ lat: parts[0], lng: parts[1] });
    } else {
      Alert.alert('Invalid format', 'Enter destination as: lat, lng');
    }
  };

  const centerCoord = userLocation
    ? [userLocation.longitude, userLocation.latitude]
    : [3.3792, 6.5244]; // Lagos default

  return (
    <View style={styles.container}>
      <MapLibreGL.MapView
        style={styles.map}
        styleURL="https://demotiles.maplibre.org/style.json"
        onDidFinishLoadingMap={() => setMapReady(true)}
      >
        <MapLibreGL.Camera
          ref={cameraRef}
          zoomLevel={14}
          centerCoordinate={centerCoord}
          animationMode="flyTo"
          animationDuration={1000}
        />

        {/* User location marker */}
        {userLocation && (
          <MapLibreGL.PointAnnotation
            id="user-location"
            coordinate={[userLocation.longitude, userLocation.latitude]}
          >
            <View style={styles.userMarker} />
          </MapLibreGL.PointAnnotation>
        )}

        {/* Destination marker */}
        {destCoords && (
          <MapLibreGL.PointAnnotation
            id="destination"
            coordinate={[destCoords.lng, destCoords.lat]}
          >
            <View style={styles.destMarker} />
          </MapLibreGL.PointAnnotation>
        )}

        {/* Nearby driver markers */}
        {nearbyDrivers.map((driver) => (
          <MapLibreGL.PointAnnotation
            key={driver.id}
            id={`driver-${driver.id}`}
            coordinate={[driver.coordinates.lng, driver.coordinates.lat]}
          >
            <View style={styles.driverMarker} />
          </MapLibreGL.PointAnnotation>
        ))}
      </MapLibreGL.MapView>

      {/* Bottom panel */}
      <View style={styles.panel}>
        <TextInput
          style={styles.destInput}
          placeholder="Enter destination (lat, lng)"
          placeholderTextColor="#999"
          value={destination}
          onChangeText={setDestination}
          onSubmitEditing={handleDestinationSubmit}
          returnKeyType="search"
        />

        {fareEstimate != null && (
          <Text style={styles.fareText}>Estimated fare: ₦{fareEstimate}</Text>
        )}

        {currentRide ? (
          <View style={styles.rideStatusCard}>
            <Text style={styles.rideStatusText}>
              Ride status: {currentRide.status?.toUpperCase()}
            </Text>
            {currentRide.status === 'accepted' && (
              <Text style={styles.rideSubText}>Driver is on the way!</Text>
            )}
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.requestButton, requesting && styles.buttonDisabled]}
            onPress={handleRequestRide}
            disabled={requesting}
          >
            {requesting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.requestButtonText}>Request Ride</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  userMarker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    borderWidth: 2,
    borderColor: '#fff',
  },
  destMarker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF3B30',
    borderWidth: 2,
    borderColor: '#fff',
  },
  driverMarker: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#34C759',
    borderWidth: 2,
    borderColor: '#fff',
  },
  panel: {
    backgroundColor: '#fff',
    padding: 16,
    paddingBottom: 32,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  destInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: '#000',
    backgroundColor: '#fafafa',
    marginBottom: 12,
  },
  fareText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  requestButton: {
    backgroundColor: '#000',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  requestButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  rideStatusCard: {
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  rideStatusText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
  },
  rideSubText: {
    fontSize: 13,
    color: '#555',
    marginTop: 4,
  },
});
