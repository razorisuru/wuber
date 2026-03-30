import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { api } from '../../services/api';

export default function EarningsScreen() {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEarnings = async () => {
    try {
      const { data } = await api.get('/rides/history');
      setRides(data.filter((r) => r.status === 'completed'));
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to load earnings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEarnings();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchEarnings();
  };

  const total = rides.reduce((sum, r) => sum + (r.fare || 0), 0);
  const today = rides.filter(
    (r) => new Date(r.created_at).toDateString() === new Date().toDateString()
  );
  const todayTotal = today.reduce((sum, r) => sum + (r.fare || 0), 0);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
    >
      {/* Summary cards */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Today</Text>
          <Text style={styles.summaryAmount}>₦{todayTotal.toFixed(0)}</Text>
          <Text style={styles.summaryCount}>{today.length} rides</Text>
        </View>
        <View style={[styles.summaryCard, styles.summaryCardAlt]}>
          <Text style={styles.summaryLabel}>All Time</Text>
          <Text style={styles.summaryAmount}>₦{total.toFixed(0)}</Text>
          <Text style={styles.summaryCount}>{rides.length} rides</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Recent Completed Rides</Text>

      {rides.length === 0 ? (
        <View style={styles.emptyInner}>
          <Text style={styles.emptyTitle}>No completed rides yet</Text>
          <Text style={styles.emptySubtitle}>Complete rides to see your earnings.</Text>
        </View>
      ) : (
        rides.slice(0, 20).map((item) => (
          <View key={item.id} style={styles.rideRow}>
            <View>
              <Text style={styles.rideId}>#{item.id.slice(0, 8)}</Text>
              <Text style={styles.rideDate}>
                {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </View>
            <Text style={styles.rideFare}>₦{item.fare?.toFixed(0)}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111' },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  summaryCard: {
    flex: 1,
    backgroundColor: '#222',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  summaryCardAlt: { backgroundColor: '#1a2a1a' },
  summaryLabel: { color: '#888', fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase' },
  summaryAmount: { color: '#34C759', fontSize: 26, fontWeight: '800' },
  summaryCount: { color: '#666', fontSize: 12, marginTop: 4 },
  sectionTitle: { color: '#888', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 12 },
  rideRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  rideId: { color: '#ccc', fontFamily: 'monospace', fontSize: 13 },
  rideDate: { color: '#666', fontSize: 12, marginTop: 3 },
  rideFare: { color: '#FFD60A', fontSize: 18, fontWeight: '800' },
  emptyInner: { alignItems: 'center', marginTop: 40 },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySubtitle: { color: '#888', fontSize: 14 },
});
