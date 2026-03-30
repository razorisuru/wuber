import { useAuth, useUser } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Switch,
} from 'react-native';
import { api } from '../../services/api';
import { useStore } from '../../store/useStore';

export default function ProfileScreen() {
  const { signOut } = useAuth();
  const { user: clerkUser } = useUser();
  const router = useRouter();
  const { setUser } = useStore();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDriver, setIsDriver] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/users/me');
        setProfile(data);
        setIsDriver(data.role === 'driver');
        setUser(data);
      } catch (err) {
        // If user not synced yet, create them
        try {
          const { data } = await api.post('/users', {
            email: clerkUser?.primaryEmailAddress?.emailAddress,
            role: 'rider',
          });
          setProfile(data);
        } catch (createErr) {
          Alert.alert('Error', 'Failed to load profile');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleRoleToggle = async (value) => {
    const newRole = value ? 'driver' : 'rider';
    setIsDriver(value);
    try {
      const { data } = await api.patch('/users/me', { role: newRole });
      setProfile(data);
      setUser(data);
    } catch (err) {
      Alert.alert('Error', 'Failed to update role');
      setIsDriver(!value);
    }
  };

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/sign-in');
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {clerkUser?.firstName?.[0] ?? clerkUser?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ?? 'U'}
          </Text>
        </View>
        <Text style={styles.name}>
          {clerkUser?.fullName ?? clerkUser?.emailAddresses?.[0]?.emailAddress}
        </Text>
        <Text style={styles.email}>{profile?.email}</Text>
      </View>

      {/* Role card */}
      <View style={styles.card}>
        <View style={styles.row}>
          <View>
            <Text style={styles.rowLabel}>Driver Mode</Text>
            <Text style={styles.rowSub}>Switch to earn by driving</Text>
          </View>
          <Switch
            value={isDriver}
            onValueChange={handleRoleToggle}
            trackColor={{ false: '#e0e0e0', true: '#000' }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {isDriver && (
        <TouchableOpacity
          style={styles.driverButton}
          onPress={() => router.push('/driver')}
        >
          <Text style={styles.driverButtonText}>Open Driver Dashboard →</Text>
        </TouchableOpacity>
      )}

      {/* Info card */}
      <View style={styles.card}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Account ID</Text>
          <Text style={styles.infoValue} numberOfLines={1}>
            {profile?.id?.slice(0, 16)}…
          </Text>
        </View>
        <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.infoLabel}>Member since</Text>
          <Text style={styles.infoValue}>
            {profile?.created_at
              ? new Date(profile.created_at).toLocaleDateString()
              : '—'}
          </Text>
        </View>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  avatarContainer: { alignItems: 'center', paddingVertical: 24 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '700' },
  name: { fontSize: 20, fontWeight: '700', color: '#000', marginBottom: 4 },
  email: { fontSize: 14, color: '#666' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { fontSize: 16, fontWeight: '600', color: '#000' },
  rowSub: { fontSize: 13, color: '#999', marginTop: 2 },
  driverButton: {
    backgroundColor: '#000',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  driverButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: { fontSize: 14, color: '#666' },
  infoValue: { fontSize: 14, color: '#333', fontWeight: '500', maxWidth: '60%' },
  signOutButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  signOutText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
