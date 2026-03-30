import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { api } from '../../services/api';

export default function RequestsScreen() {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRides = async () => {
    try {
      const { data } = await api.get('/rides/history');
      // Show rides that were assigned to this driver
      setRides(data.filter((r) => r.status !== 'pending'));
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to load rides');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRides();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRides();
  };

  const statusColor = (status) => {
    switch (status) {
      case 'completed': return '#34C759';
      case 'accepted':  return '#007AFF';
      default:          return '#8E8E93';
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={rides}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        contentContainerStyle={rides.length === 0 && styles.empty}
        ListEmptyComponent={
          <View style={styles.emptyInner}>
            <Text style={styles.emptyTitle}>No rides yet</Text>
            <Text style={styles.emptySubtitle}>Accepted rides will appear here.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.rideId}>#{item.id.slice(0, 8)}</Text>
              <View style={[styles.badge, { backgroundColor: statusColor(item.status) }]}>
                <Text style={styles.badgeText}>{item.status}</Text>
              </View>
            </View>
            <Text style={styles.info}>
              From: {item.origin_lat?.toFixed(4)}, {item.origin_lng?.toFixed(4)}
            </Text>
            <Text style={styles.info}>
              To: {item.dest_lat?.toFixed(4)}, {item.dest_lng?.toFixed(4)}
            </Text>
            <Text style={styles.fare}>₦{item.fare?.toFixed(0)}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111' },
  card: {
    backgroundColor: '#222',
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 14,
    marginTop: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rideId: { color: '#888', fontFamily: 'monospace', fontSize: 12 },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  info: { color: '#ccc', fontSize: 13, marginBottom: 3 },
  fare: { color: '#FFD60A', fontSize: 18, fontWeight: '800', marginTop: 6 },
  empty: { flex: 1 },
  emptyInner: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 80 },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySubtitle: { color: '#888', fontSize: 14 },
});
