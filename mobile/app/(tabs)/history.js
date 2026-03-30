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

export default function HistoryScreen() {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = async () => {
    try {
      const { data } = await api.get('/rides/history');
      setRides(data);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to load history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

  const statusColor = (status) => {
    switch (status) {
      case 'completed': return '#34C759';
      case 'accepted':  return '#007AFF';
      case 'pending':   return '#FF9500';
      default:          return '#8E8E93';
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.rideId}>Ride #{item.id.slice(0, 8)}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>

      <View style={styles.coords}>
        <Text style={styles.coordLabel}>From</Text>
        <Text style={styles.coordValue}>
          {item.origin_lat?.toFixed(4)}, {item.origin_lng?.toFixed(4)}
        </Text>
      </View>

      <View style={styles.coords}>
        <Text style={styles.coordLabel}>To</Text>
        <Text style={styles.coordValue}>
          {item.dest_lat?.toFixed(4)}, {item.dest_lng?.toFixed(4)}
        </Text>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.fare}>₦{item.fare?.toFixed(0) ?? '—'}</Text>
        <Text style={styles.date}>
          {new Date(item.created_at).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={rides}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={rides.length === 0 && styles.empty}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyInner}>
            <Text style={styles.emptyTitle}>No rides yet</Text>
            <Text style={styles.emptySubtitle}>Your ride history will appear here.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  rideId: { fontSize: 13, color: '#666', fontFamily: 'monospace' },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  coords: { flexDirection: 'row', marginBottom: 6 },
  coordLabel: { width: 40, fontSize: 13, color: '#999', fontWeight: '600' },
  coordValue: { fontSize: 13, color: '#333' },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 10,
  },
  fare: { fontSize: 16, fontWeight: '800', color: '#000' },
  date: { fontSize: 13, color: '#999' },
  empty: { flex: 1 },
  emptyInner: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#999' },
});
