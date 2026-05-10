import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/CustomAlertContext';
import { COLORS, SPACING, RADIUS } from '../theme/theme';
import { Play, Square, Package, Truck, LogOut, MapPin, AlertTriangle, Map as MapIcon, User } from 'lucide-react-native';
import client from '../api/client';
import Logo from '../components/Logo';
import * as Location from 'expo-location';
import { useTracking } from '../hooks/useTracking';
import { useSync } from '../hooks/useSync';

const HomeScreen = ({ navigation }) => {
  const { user, logout, updateUser } = useAuth();
  const { showAlert } = useAlert();
  const [trip, setTrip] = useState(user?.active_trip_id ? { id: user.active_trip_id } : null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ 
    pickups: 0, 
    collections: { cbc: 0, pcr: 0, total: 0 },
    deliveries: { cbc: 0, pcr: 0, total: 0 }
  });

  // Auto-start tracking and detect geofences
  const { status: trackingStatus, currentGeofence } = useTracking(user, !!trip);
  useSync(user);

  const fetchStats = async () => {
    try {
      const response = await client.post(`${user.baseUrl}/api/rider_stats`, {
        params: { rider_id: user.rider_id }
      });
      if (response.data.result?.status === 'success') {
        const res = response.data.result;
        setStats({
          pickups: res.pickups || 0,
          collections: res.collections || { cbc: 0, pcr: 0, total: 0 },
          deliveries: res.deliveries || { cbc: 0, pcr: 0, total: 0 }
        });
      }
    } catch (e) {
      // Silently fail to not disrupt rider flow if server hasn't been updated yet
      console.warn("Rider stats API not found or failed. Ensure Odoo server is restarted.");
    }
  };

  React.useEffect(() => {
    fetchStats();
    // Refresh stats when screen is focused
    const unsubscribe = navigation.addListener('focus', () => {
      fetchStats();
    });
    return unsubscribe;
  }, [navigation]);

  const startTrip = async () => {
    setLoading(true);
    try {
      const response = await client.post(`${user.baseUrl}/api/start_trip`, {
        params: { rider_id: user.rider_id }
      });
      if (response.data.result?.status === 'success') {
        const tripId = response.data.result.trip_id;
        setTrip({ id: tripId });
        updateUser({ active_trip_id: tripId });
      } else if (response.data.error) {
        const odooError = response.data.error.data?.message || response.data.error.message;
        showAlert('Odoo Server Error', odooError, 'error');
      } else {
        showAlert('Error', response.data.result?.message || 'Failed to start trip.', 'error');
      }
    } catch (e) {
      console.error(e);
      const isNetworkError = !e.response;
      if (isNetworkError) {
        const tempTripId = -Math.floor(Date.now() / 1000); // Temporary negative ID for offline
        const { savePendingSync } = await import('../store/offlineStore');
        await savePendingSync('start_trip', { rider_id: user.rider_id, temp_trip_id: tempTripId });
        
        setTrip({ id: tempTripId });
        updateUser({ active_trip_id: tempTripId });
        showAlert('Offline Mode', 'Trip started offline. It will sync automatically when internet is available.', 'warning');
      } else {
        showAlert('Error', 'Failed to start trip.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const requestHandover = async () => {
    showAlert(
      'Request Handover',
      'Are you sure you want to request an emergency handover due to delay?',
      'warning',
      [
        { text: 'Cancel', type: 'cancel' },
        { 
          text: 'Confirm', 
          onPress: async () => {
            setLoading(true);
            try {
              let lat = null, lng = null;
              try {
                let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, timeout: 5000 });
                lat = loc.coords.latitude;
                lng = loc.coords.longitude;
              } catch (e) {
                console.warn("Location fetch timeout/failed", e);
              }

              const response = await client.post(`${user.baseUrl}/api/request_handover`, {
                params: { rider_id: user.rider_id, trip_id: trip.id, latitude: lat, longitude: lng }
              });
              
              if (response.data.result?.status === 'success') {
                showAlert('Handover Requested', 'Admin has been notified to assign a new rider.', 'success');
              } else if (response.data.error) {
                const odooError = response.data.error.data?.message || response.data.error.message;
                showAlert('Odoo Server Error', odooError, 'error');
              } else {
                const msg = response.data.result?.message || 'Server error occurred.';
                showAlert('Request Failed', msg, 'error');
              }
            } catch (e) {
              console.error(e);
              const isNetworkError = !e.response;
              if (isNetworkError) {
                const { savePendingSync } = await import('../store/offlineStore');
                await savePendingSync('handover', { rider_id: user.rider_id, trip_id: trip.id, latitude: lat, longitude: lng });
                showAlert('Offline Mode', 'Handover request saved offline. It will be sent automatically when internet is available.', 'warning');
              } else {
                showAlert('Connection Error', 'Could not reach server. Please check your internet.', 'error');
              }
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const endTrip = async () => {
    setLoading(true);
    try {
      const response = await client.post(`${user.baseUrl}/api/end_trip`, {
        params: { trip_id: trip.id }
      });
      if (response.data.result?.status === 'success') {
        setTrip(null);
        updateUser({ active_trip_id: null });
      } else if (response.data.error) {
        const odooError = response.data.error.data?.message || response.data.error.message;
        showAlert('Odoo Server Error', odooError, 'error');
      } else {
        showAlert('Error', response.data.result?.message || 'Failed to end trip.', 'error');
      }
    } catch (e) {
      console.error(e);
      const isNetworkError = !e.response;
      if (isNetworkError) {
        const { savePendingSync } = await import('../store/offlineStore');
        await savePendingSync('end_trip', { trip_id: trip.id });
        
        setTrip(null);
        updateUser({ active_trip_id: null });
        showAlert('Offline Mode', 'Trip ended offline. It will sync automatically when internet is available.', 'warning');
      } else {
        showAlert('Error', 'Failed to end trip.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Logo size={40} />
            <View>
              <Text style={styles.welcome}>PK HCV Elimination Program</Text>
              <Text style={styles.riderName}>Samples Track</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.logoutBtn}>
            <User color={COLORS.primary} size={24} />
          </TouchableOpacity>
        </View>

        <View style={styles.riderInfo}>
            <Text style={styles.welcome}>Logged in as:</Text>
            <Text style={styles.riderSubName}>{user?.rider_name || 'Rider'}</Text>
        </View>

        {/* Geofence Alert Banner */}
        {trip && currentGeofence && (
          <TouchableOpacity 
            style={styles.geofenceBanner}
            onPress={() => navigation.navigate('Pickup', { tripId: trip.id, autoLocation: currentGeofence.name })}
          >
            <MapPin color="#fff" size={24} />
            <View style={{ flex: 1 }}>
              <Text style={styles.geofenceTitle}>Location Detected: {currentGeofence.name}</Text>
              <Text style={styles.geofenceSubtitle}>Tap to start pickup here</Text>
            </View>
            <Package color="#fff" size={24} />
          </TouchableOpacity>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsScroll} contentContainerStyle={styles.statsScrollContent}>
          <View style={styles.statCard}>
            <Package color={COLORS.primary} size={20} />
            <View style={styles.tubeCounts}>
               <View style={[styles.tubeBadge, {backgroundColor: '#fef3c7'}]}>
                  <Text style={styles.tubeBadgeLabel}>CBC</Text>
                  <Text style={styles.tubeBadgeValue}>{stats.collections.cbc}</Text>
               </View>
               <View style={[styles.tubeBadge, {backgroundColor: '#dcfce7'}]}>
                  <Text style={styles.tubeBadgeLabel}>PCR</Text>
                  <Text style={styles.tubeBadgeValue}>{stats.collections.pcr}</Text>
               </View>
            </View>
            <Text style={styles.statLabel}>Samples Pickup</Text>
          </View>

          <View style={styles.statCard}>
            <Truck color={COLORS.secondary} size={20} />
            <View style={styles.tubeCounts}>
               <View style={[styles.tubeBadge, {backgroundColor: '#fef3c7'}]}>
                  <Text style={styles.tubeBadgeLabel}>CBC</Text>
                  <Text style={styles.tubeBadgeValue}>{stats.deliveries.cbc}</Text>
               </View>
               <View style={[styles.tubeBadge, {backgroundColor: '#dcfce7'}]}>
                  <Text style={styles.tubeBadgeLabel}>PCR</Text>
                  <Text style={styles.tubeBadgeValue}>{stats.deliveries.pcr}</Text>
               </View>
            </View>
            <Text style={styles.statLabel}>Samples Delivery</Text>
          </View>

          <View style={styles.statCard}>
            <MapPin color={COLORS.secondary} size={20} />
            <Text style={styles.statValue}>{stats.pickups}</Text>
            <Text style={styles.statLabel}>Pickups Done</Text>
          </View>
        </ScrollView>

        {!trip ? (
          <View style={styles.actionContainer}>
            <Text style={styles.actionTitle}>Ready to start?</Text>
            <Text style={styles.actionSubtitle}>Start your shift to begin tracking and collecting samples.</Text>
            <TouchableOpacity style={styles.startBtn} onPress={startTrip} disabled={loading}>
              <Play color="#fff" size={24} fill="#fff" />
              <Text style={styles.startBtnText}>Start Shift</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.tripActions}>
            <View style={styles.statusRow}>
              <Text style={styles.tripActiveTitle}>Trip in Progress</Text>
              <View style={[styles.statusBadge, { 
                backgroundColor: trackingStatus === 'moving' ? '#dcfce7' : (trackingStatus === 'stopped' ? '#f3f4f6' : '#fff7ed') 
              }]}>
                <View style={[styles.statusDot, { 
                  backgroundColor: trackingStatus === 'moving' ? '#22c55e' : (trackingStatus === 'stopped' ? '#6b7280' : '#f59e0b') 
                }]} />
                <Text style={[styles.statusText, { 
                  color: trackingStatus === 'moving' ? '#166534' : (trackingStatus === 'stopped' ? '#374151' : '#9a3412') 
                }]}>
                  {trackingStatus === 'stopped' ? 'STATIONARY' : trackingStatus.toUpperCase()}
                </Text>
              </View>
            </View>
            <View style={styles.tripGrid}>
              <TouchableOpacity 
                style={styles.tripCard} 
                onPress={() => navigation.navigate('Pickup', { tripId: trip.id })}
              >
                <Package color={COLORS.primary} size={32} />
                <Text style={styles.tripCardText}>Samples Pickup</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.tripCard} 
                onPress={() => navigation.navigate('Deliveries', { tripId: trip.id })}
              >
                <Truck color={COLORS.secondary} size={32} />
                <Text style={styles.tripCardText}>Samples Delivery</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.tripGrid}>
              <TouchableOpacity 
                style={styles.tripCard} 
                onPress={() => navigation.navigate('Map')}
              >
                <MapIcon color={COLORS.secondary} size={32} />
                <Text style={styles.tripCardText}>View Fleet Map</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.tripCard} 
                onPress={() => navigation.navigate('ReportIssue', { tripId: trip.id })}
              >
                <AlertTriangle color={COLORS.danger} size={32} />
                <Text style={styles.tripCardText}>Emergency</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.endBtn} onPress={endTrip} disabled={loading}>
              <Square color={COLORS.danger} size={20} fill={COLORS.danger} />
              <Text style={styles.endBtnText}>End Shift</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: SPACING.lg, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xl, marginTop: SPACING.md },
  welcome: { color: COLORS.textMuted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700' },
  riderName: { color: COLORS.text, fontSize: 24, fontWeight: '900', letterSpacing: 0.5 },
  riderSubName: { color: COLORS.primary, fontSize: 18, fontWeight: '700' },
  riderInfo: { marginBottom: SPACING.lg, paddingHorizontal: SPACING.xs },
  logoutBtn: { padding: SPACING.md, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: RADIUS.full },
  statsScroll: { marginBottom: SPACING.xl },
  statsScrollContent: { gap: SPACING.md, paddingRight: SPACING.lg },
  statCard: { 
    width: 160, 
    backgroundColor: COLORS.card, 
    padding: SPACING.md, 
    borderRadius: RADIUS.lg, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3
  },
  statValue: { color: COLORS.text, fontSize: 24, fontWeight: '900', marginVertical: SPACING.xs },
  statLabel: { color: COLORS.text, fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: SPACING.xs, width: '100%' },
  tubeCounts: { flexDirection: 'row', gap: 8, marginVertical: SPACING.sm, width: '100%', justifyContent: 'center' },
  tubeBadge: { paddingHorizontal: 6, paddingVertical: 4, borderRadius: 4, alignItems: 'center', minWidth: 50 },
  tubeBadgeLabel: { fontSize: 8, fontWeight: '800', color: COLORS.textMuted, textTransform: 'uppercase' },
  tubeBadgeValue: { fontSize: 14, fontWeight: '900', color: COLORS.text },
  actionContainer: { 
    backgroundColor: COLORS.card, 
    padding: SPACING.xl, 
    borderRadius: RADIUS.lg, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  actionTitle: { color: COLORS.text, fontSize: 22, fontWeight: '800', marginBottom: SPACING.sm },
  actionSubtitle: { color: COLORS.textMuted, textAlign: 'center', marginBottom: SPACING.lg, lineHeight: 22 },
  startBtn: { 
    backgroundColor: COLORS.secondary, 
    flexDirection: 'row', 
    alignItems: 'center', 
    height: 56,
    paddingHorizontal: SPACING.xl, 
    borderRadius: RADIUS.full,
    gap: SPACING.sm,
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8
  },
  startBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold', letterSpacing: 0.5 },
  tripActions: { flex: 1 },
  geofenceBanner: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.lg,
    gap: SPACING.md,
    elevation: 6,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  geofenceTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  geofenceSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  statusRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  statusBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: SPACING.sm, 
    paddingVertical: 6, 
    borderRadius: RADIUS.full,
    gap: 6
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: 'bold', letterSpacing: 0.5 },
  tripActiveTitle: { color: COLORS.text, fontSize: 18, fontWeight: '800' },
  tripGrid: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md },
  tripCard: { 
    flex: 1, 
    backgroundColor: COLORS.card, 
    padding: SPACING.xl, 
    borderRadius: RADIUS.lg, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4
  },
  tripCardText: { color: COLORS.text, marginTop: SPACING.sm, fontWeight: '700', fontSize: 14 },
  endBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    height: 56,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.danger,
    borderRadius: RADIUS.md
  },
  endBtnText: { color: COLORS.danger, fontSize: 16, fontWeight: '700' },
});

export default HomeScreen;
