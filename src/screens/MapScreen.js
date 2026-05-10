import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity,
  Dimensions, FlatList, Animated, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { COLORS, SPACING, RADIUS } from '../theme/theme';
import {
  ArrowLeft, Navigation, MapPin, ChevronUp, RefreshCw,
  Package, Building, Building2, Bike
} from 'lucide-react-native';
import client from '../api/client';
import * as Location from 'expo-location';
import { useAuth } from '../context/AuthContext';

const { width, height } = Dimensions.get('window');
const PICKUP_COLOR = '#0DA65A';
const DROP_COLOR = '#E53E3E';

// Professional marker pin (No cropping)
const SitePin = ({ type, isSelected }) => {
  const isPickup = type === 'collection';
  const color = isPickup ? PICKUP_COLOR : DROP_COLOR;
  const IconComponent = isPickup ? Package : Building2;

  return (
    <View style={styles.markerContainer}>
      <View style={[
        styles.markerPin,
        { backgroundColor: color, borderColor: '#fff' },
        isSelected && styles.markerSelected
      ]}>
        <IconComponent color="#fff" size={isSelected ? 20 : 16} strokeWidth={2.5} />
      </View>
      <View style={[styles.markerTail, { borderTopColor: color }]} />
    </View>
  );
};

const MapScreen = ({ navigation }) => {
  const { user } = useAuth();
  const mapRef = useRef(null);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedSite, setSelectedSite] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [showRiderDetail, setShowRiderDetail] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const listAnim = useRef(new Animated.Value(0)).current;

  const fetchSites = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const response = await client.post(`${user.baseUrl}/api/collection_places`, { params: {} });
      const result = response.data?.result;
      if (result?.status === 'success') {
        const valid = (result.data || []).filter(s => s.lat && s.lng);
        setSites(valid);
        if (valid.length === 0) {
          setErrorMsg('No locations found. Ensure Odoo contacts have coordinates set and correct site tags.');
        }
      } else {
        setErrorMsg('Server returned no data. Check if the module is installed on Odoo.');
      }
    } catch (e) {
      setErrorMsg('Connection failed. Check internet and Odoo server status.');
      console.error('MapScreen fetch error:', e?.message);
    } finally {
      setLoading(false);
    }
  };

  const fitAllMarkers = (siteList) => {
    if (!mapRef.current || !siteList.length) return;
    mapRef.current.fitToCoordinates(
      siteList.map(s => ({ latitude: s.lat, longitude: s.lng })),
      { edgePadding: { top: 80, right: 40, bottom: 250, left: 40 }, animated: true }
    );
  };

  useEffect(() => {
    fetchSites();

    // Watch user location for custom bike marker
    (async () => {
      let { status: locPerm } = await Location.requestForegroundPermissionsAsync();
      if (locPerm !== 'granted') return;

      try {
        const initialLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (initialLoc) {
          setUserLocation(initialLoc.coords);
        }

        await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
          (newLoc) => {
            if (newLoc && newLoc.coords) {
              setUserLocation(newLoc.coords);
            }
          }
        );
      } catch (err) {
        console.warn("Location fetch failed in MapScreen", err);
      }
    })();
  }, []);

  useEffect(() => {
    if (sites.length) fitAllMarkers(sites);
  }, [sites]);

  const toggleList = () => {
    const to = listOpen ? 0 : 1;
    Animated.spring(listAnim, { toValue: to, useNativeDriver: false }).start();
    setListOpen(!listOpen);
  };

  const flyToSite = (site) => {
    setSelectedSite(site.id);
    mapRef.current?.animateToRegion({
      latitude: site.lat,
      longitude: site.lng,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    }, 600);
    Animated.spring(listAnim, { toValue: 0, useNativeDriver: false }).start();
    setListOpen(false);
  };

  const listHeight = listAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, height * 0.44],
  });

  const pickupCount = sites.filter(s => s.type === 'collection').length;
  const dropCount = sites.filter(s => s.type !== 'collection').length;

  return (
    <View style={styles.container}>
      {/* Full screen map */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        googleMapsApiKey="AIzaSyBYSaFO3FMBDfUj7weAYdpiv6_jvJuUD50" // Explicit for web
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude: 30.3753, longitude: 69.3451, latitudeDelta: 15, longitudeDelta: 15 }}
        showsUserLocation={false} // Force false to hide blue dot
        showsMyLocationButton={false}
        showsCompass={false}
        onPress={() => {
          setSelectedSite(null);
          setShowRiderDetail(false);
        }}
      >
        {/* Rider Bike Marker (Same teardrop style as locations) */}
        {userLocation && userLocation.latitude && (
          <Marker
            coordinate={{ latitude: userLocation.latitude, longitude: userLocation.longitude }}
            onPress={(e) => {
              e.stopPropagation();
              setSelectedSite(null);
              setShowRiderDetail(true);
            }}
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={styles.markerContainer}>
              <View style={[styles.markerPin, { backgroundColor: COLORS.primary, borderColor: '#fff' }]}>
                <Bike color="#fff" size={20} strokeWidth={2.5} />
              </View>
              <View style={[styles.markerTail, { borderTopColor: COLORS.primary }]} />
            </View>
          </Marker>
        )}

        {sites.map((site) => (
          <Marker
            key={site.id}
            coordinate={{ latitude: site.lat, longitude: site.lng }}
            anchor={{ x: 0.5, y: 1 }}
            onPress={(e) => {
              e.stopPropagation();
              setShowRiderDetail(false);
              setSelectedSite(site.id);
            }}
          >
            <SitePin type={site.type} isSelected={selectedSite === site.id} />
          </Marker>
        ))}
      </MapView>

      {/* Selected Site Detail Card */}
      {selectedSite && (() => {
        const site = sites.find(s => s.id === selectedSite);
        if (!site) return null;
        const color = site.type === 'collection' ? PICKUP_COLOR : DROP_COLOR;
        return (
          <Animated.View style={styles.detailCard}>
            <View style={[styles.detailIcon, { backgroundColor: color }]}>
              {site.type === 'collection' ? <Package color="#fff" size={20} /> : <Building color="#fff" size={20} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailName}>{site.name}</Text>
              <Text style={[styles.detailType, { color }]}>
                {site.type === 'collection' ? 'Sample Collection Site' : 'Drop-off / Receiver Site'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.detailClose}
              onPress={() => setSelectedSite(null)}
            >
              <Text style={{ color: COLORS.textMuted, fontSize: 18 }}>×</Text>
            </TouchableOpacity>
          </Animated.View>
        );
      })()}

      {/* Floating back button — same as PickupScreen */}
      <SafeAreaView style={styles.absoluteHeader}>
        <TouchableOpacity
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main', { screen: 'Collections' })}
          style={styles.backBtnWrapper}
        >
          <ArrowLeft color="#fff" size={24} />
        </TouchableOpacity>
      </SafeAreaView>

      {/* Title card floating top center */}
      <SafeAreaView style={styles.titleCard} pointerEvents="none">
        <View style={styles.titleCardInner}>
          <Text style={styles.titleText}>Fleet & Site Map</Text>
          <Text style={styles.subText}>
            {loading ? 'Loading...' : `${sites.length} locations`}
          </Text>
        </View>
      </SafeAreaView>

      {/* Loading */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      )}

      {/* Error card */}
      {!loading && errorMsg !== '' && (
        <View style={styles.errorCard}>
          <MapPin color={DROP_COLOR} size={20} />
          <Text style={styles.errorCardText}>{errorMsg}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchSites}>
            <RefreshCw color="#fff" size={14} />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Fit all FAB */}
      {sites.length > 0 && (
        <TouchableOpacity style={[styles.fab, { bottom: 90 }]} onPress={() => fitAllMarkers(sites)}>
          <MapPin color="#fff" size={20} />
        </TouchableOpacity>
      )}

      {/* Bottom sheet */}
      <View style={styles.bottomSheet}>
        {/* Stats row + toggle */}
        <TouchableOpacity style={styles.statsRow} onPress={toggleList} activeOpacity={0.85}>
          <View style={styles.statsGroup}>
            <View style={[styles.badge, { borderColor: PICKUP_COLOR, backgroundColor: PICKUP_COLOR + '22' }]}>
              <Text style={[styles.badgeCount, { color: PICKUP_COLOR }]}>{pickupCount}</Text>
              <Text style={[styles.badgeLabel, { color: PICKUP_COLOR }]}>Pickups</Text>
            </View>
            <View style={[styles.badge, { borderColor: DROP_COLOR, backgroundColor: DROP_COLOR + '22' }]}>
              <Text style={[styles.badgeCount, { color: DROP_COLOR }]}>{dropCount}</Text>
              <Text style={[styles.badgeLabel, { color: DROP_COLOR }]}>Drop-offs</Text>
            </View>
          </View>
          <View style={styles.listToggle}>
            <Text style={styles.listToggleText}>{listOpen ? 'Hide' : 'All Sites'}</Text>
            <ChevronUp
              color={COLORS.textMuted} size={16}
              style={{ transform: [{ rotate: listOpen ? '0deg' : '180deg' }] }}
            />
          </View>
        </TouchableOpacity>

        {/* Expandable site list */}
        <Animated.View style={{ height: listHeight, overflow: 'hidden' }}>
          {sites.length === 0 ? (
            <View style={styles.emptyList}>
              <Text style={styles.emptyText}>No sites loaded.</Text>
              <Text style={styles.emptyHint}>
                Make sure Odoo contacts have "Sample Collection Sites / Location" or "Sample Receiver Sites / Location" tags, and have coordinates entered.
              </Text>
            </View>
          ) : (
            <FlatList
              data={sites}
              keyExtractor={item => item.id.toString()}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 12, paddingHorizontal: 12 }}
              renderItem={({ item }) => {
                const color = item.type === 'collection' ? PICKUP_COLOR : DROP_COLOR;
                const isSelected = selectedSite === item.id;
                return (
                  <TouchableOpacity
                    style={[styles.listItem, isSelected && { borderColor: color, backgroundColor: color + '11' }]}
                    onPress={() => flyToSite(item)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.listIcon, { backgroundColor: color }]}>
                      <Text style={styles.listIconText}>{item.type === 'collection' ? '⬆' : '⬇'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listName} numberOfLines={1}>{item.name}</Text>
                      <Text style={[styles.listType, { color }]}>
                        {item.type === 'collection' ? '📍 Pickup Point' : '🏥 Drop-off Point'}
                      </Text>
                    </View>
                    <ArrowLeft color={COLORS.textMuted} size={14} style={{ transform: [{ rotate: '180deg' }] }} />
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // Floating back button (same pattern as PickupScreen)
  absoluteHeader: {
    position: 'absolute',
    top: 50,
    left: SPACING.lg,
    zIndex: 100,
  },
  backBtnWrapper: {
    backgroundColor: COLORS.primary,
    borderRadius: 25,
    padding: SPACING.md,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },

  // Title floating card
  titleCard: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 90,
  },
  titleCardInner: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
  titleText: { fontSize: 15, fontWeight: '700', color: '#111' },
  subText: { fontSize: 11, color: '#555', marginTop: 1 },

  // Loading
  loadingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Error card
  errorCard: {
    position: 'absolute',
    top: 130, left: 20, right: 20,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  errorCardText: { color: '#333', fontSize: 13, textAlign: 'center', lineHeight: 18 },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 7,
    borderRadius: 20,
  },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  // Pin marker styles (Tight container with correct anchor)
  markerContainer: { 
    alignItems: 'center', 
    backgroundColor: 'transparent',
  },
  markerPin: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 3, elevation: 5,
  },
  markerSelected: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 2.5,
  },
  markerTail: {
    width: 0, height: 0,
    borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    marginTop: -1,
  },
  
  // bikeMarker style is now deprecated as we use markerContainer/Pin/Tail for consistency

  // Detail Card
  detailCard: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 1000,
  },
  detailIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  detailName: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  detailType: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  detailClose: { padding: 4 },

  // FAB
  fab: {
    position: 'absolute', bottom: 16, right: 16,
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    elevation: 6, shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6,
  },

  // Bottom sheet
  bottomSheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 10, elevation: 12,
  },
  statsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 12,
  },
  statsGroup: { flexDirection: 'row', gap: SPACING.sm },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1,
  },
  badgeCount: { fontSize: 16, fontWeight: '800' },
  badgeLabel: { fontSize: 11, fontWeight: '600' },
  listToggle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  listToggleText: { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },

  // List
  listItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.background,
    borderRadius: 10, padding: 10, marginTop: 8,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.07)',
  },
  listIcon: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  listIconText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  listName: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  listType: { fontSize: 11, fontWeight: '500', marginTop: 2 },

  // Empty
  emptyList: { padding: 24, alignItems: 'center', gap: 8 },
  emptyText: { color: COLORS.text, fontWeight: '600', fontSize: 14 },
  emptyHint: { color: COLORS.textMuted, fontSize: 11, textAlign: 'center', lineHeight: 17 },
});

export default MapScreen;
