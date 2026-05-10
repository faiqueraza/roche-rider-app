import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, SafeAreaView, Keyboard } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/CustomAlertContext';
import { COLORS, SPACING, RADIUS } from '../theme/theme';
import { Truck, Scan, ArrowLeft, CheckCircle, MapPin, Navigation, Package } from 'lucide-react-native';
import BarcodeScanner from '../components/BarcodeScanner';
import client from '../api/client';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import { Bike, Building2, Camera, Image as ImageIcon, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'react-native';

const GOOGLE_MAPS_APIKEY = "AIzaSyBYSaFO3FMBDfUj7weAYdpiv6_jvJuUD50";

// Helper to calculate distance between two GPS coordinates in metres
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const dphi = (lat2 - lat1) * Math.PI / 180;
  const dlambda = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dphi / 2) * Math.sin(dphi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(dlambda / 2) * Math.sin(dlambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const DeliveryScreen = ({ navigation, route }) => {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [boxBarcode, setBoxBarcode] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userLoc, setUserLoc] = useState(null);
  const [destLoc, setDestLoc] = useState(null);
  const [distanceKm, setDistanceKm] = useState(null);
  const [routeFailed, setRouteFailed] = useState(false);
  const [deliveryPhoto, setDeliveryPhoto] = useState(null);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    const fetchRouteData = async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        
        let loc = await Location.getCurrentPositionAsync({});
        const currentLat = loc.coords.latitude;
        const currentLng = loc.coords.longitude;
        setUserLoc({ latitude: currentLat, longitude: currentLng });

        // Use the new collection_places endpoint to find drop-off locations
        const response = await client.post(`${user.baseUrl}/api/collection_places`, { params: {} });
        
        if (response.data.result?.status === 'success') {
          const allPlaces = response.data.result.data || [];
          
          // Filter out only the receiver (drop-off) sites
          const dropOffSites = allPlaces.filter(p => p.type === 'receiver');
          
          let nearestDrop = null;
          let minDistance = Infinity;

          for (let site of dropOffSites) {
            const distance = getDistance(currentLat, currentLng, site.lat, site.lng);
            if (distance < minDistance) {
              minDistance = distance;
              nearestDrop = site;
            }
          }

          if (nearestDrop) {
            setDestLoc({ latitude: nearestDrop.lat, longitude: nearestDrop.lng, name: nearestDrop.name });
            setDistanceKm((minDistance / 1000).toFixed(2));
          }
        }
      } catch (e) {
        console.error("Failed to load route", e);
      }
    };
    fetchRouteData();
  }, []);

  const pickImage = async () => {
    try {
      // Request permissions first
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission Denied', 'Camera access is required to capture proof of delivery.', 'error');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.base64) {
          setDeliveryPhoto(`data:image/jpeg;base64,${asset.base64}`);
        } else {
          // Fallback if base64 is missing for some reason
          setDeliveryPhoto(asset.uri);
        }
      }
    } catch (error) {
      console.error("Camera Error:", error);
      showAlert('Camera Error', 'Could not open the camera. Please check your device settings.', 'error');
    }
  };

  const confirmDelivery = async () => {
    if (!boxBarcode || !receiverName || !deliveryPhoto) {
      showAlert('Missing Information', 'Please scan the box, enter receiver name, and capture a photo of the delivery.', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await client.post(`${user.baseUrl}/api/confirm_delivery`, {
        params: {
          box_barcode: boxBarcode,
          receiver_name: receiverName,
          photo: deliveryPhoto
        }
      });

      if (response.data.result?.status === 'success') {
        showAlert('Success', 'Delivery confirmed successfully.', 'success');
        navigation.navigate('Main', { screen: 'Collections' });
      } else if (response.data.error) {
        const odooError = response.data.error.data?.message || response.data.error.message;
        showAlert('Odoo Server Error', odooError, 'error');
      } else {
        showAlert('Error', response.data.result?.message || 'Failed to confirm delivery.', 'error');
      }
    } catch (e) {
      console.error(e);
      const isNetworkError = !e.response;
      if (isNetworkError) {
        const { savePendingSync } = await import('../store/offlineStore');
        await savePendingSync('delivery', {
          box_barcode: boxBarcode,
          receiver_name: receiverName,
          photo: deliveryPhoto // Added photo for offline sync
        });
        showAlert('Offline', 'Delivery saved offline with photo. It will sync automatically when internet is available.', 'success', [
          { text: 'OK', onPress: () => navigation.navigate('Main', { screen: 'Collections' }) }
        ]);
      } else {
        showAlert('Error', 'Network error. Please try again.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. Map as absolute background (Uber style) */}
      {userLoc && destLoc ? (
        <View style={[StyleSheet.absoluteFill, { bottom: '40%' }]}>
          <MapView 
            style={styles.map} 
            initialRegion={{
              latitude: (userLoc.latitude + destLoc.latitude) / 2,
              longitude: (userLoc.longitude + destLoc.longitude) / 2,
              latitudeDelta: Math.abs(userLoc.latitude - destLoc.latitude) * 1.5 || 0.05,
              longitudeDelta: Math.abs(userLoc.longitude - destLoc.longitude) * 1.5 || 0.05,
            }}
            showsUserLocation={true}
          >
            {/* Rider Bike Marker */}
            <Marker coordinate={userLoc} anchor={{ x: 0.5, y: 1 }}>
              <View style={styles.markerContainer}>
                <View style={[styles.markerPin, { backgroundColor: COLORS.primary, borderColor: '#fff' }]}>
                  <Bike color="#fff" size={20} strokeWidth={2.5} />
                </View>
                <View style={[styles.markerTail, { borderTopColor: COLORS.primary }]} />
              </View>
            </Marker>
            
            {/* Destination Marker */}
            <Marker coordinate={destLoc} anchor={{ x: 0.5, y: 1 }}>
              <View style={styles.markerContainer}>
                <View style={[styles.markerPin, { backgroundColor: '#E53E3E', borderColor: '#fff' }]}>
                  <Building2 color="#fff" size={20} strokeWidth={2.5} />
                </View>
                <View style={[styles.markerTail, { borderTopColor: '#E53E3E' }]} />
              </View>
            </Marker>

            {/* Real Road Route using Google Maps Directions */}
            {/* Real Road Route using Google Maps Directions */}
            {!routeFailed && (
              <MapViewDirections
                origin={userLoc}
                destination={destLoc}
                apikey={GOOGLE_MAPS_APIKEY}
                strokeWidth={5}
                strokeColor={COLORS.primary}
                mode="DRIVING"
                precision="high"
                onReady={(result) => {
                  console.log(`Route Found: ${result.distance}km, ${result.duration}min`);
                }}
                onError={(errorMessage) => {
                  console.error("GOOGLE DIRECTIONS ERROR:", errorMessage);
                  // This usually means API Key restrictions or Billing issues in Google Cloud Console
                  setRouteFailed(true);
                }}
              />
            )}
            
            {/* Fallback to straight line if Google API fails or is not enabled */}
            {routeFailed && (
              <>
                <Polyline 
                  coordinates={[userLoc, destLoc]}
                  strokeColor="#000000"
                  strokeWidth={5}
                  lineJoin="round"
                  lineCap="round"
                />
                <Polyline 
                  coordinates={[userLoc, destLoc]}
                  strokeColor="#4F46E5"
                  strokeWidth={2}
                  lineJoin="round"
                  lineCap="round"
                />
              </>
            )}
          </MapView>
          
          {/* Uber style floating info card over the map */}
          <View style={styles.uberOverlay}>
            <View style={styles.uberOverlayContent}>
              <View style={[styles.uberInfoItem, { flex: 1, alignItems: 'flex-start' }]}>
                <Text style={styles.uberInfoValue} numberOfLines={1}>{destLoc.name}</Text>
                <Text style={styles.uberInfoLabel}>Drop-off Location</Text>
              </View>
              <View style={styles.uberDivider} />
              <View style={[styles.uberInfoItem, { minWidth: 60 }]}>
                <Text style={styles.uberInfoValue}>{distanceKm} km</Text>
                <Text style={styles.uberInfoLabel}>Dist.</Text>
              </View>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.mapLoadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={{ marginTop: 10, color: COLORS.textMuted }}>Locating drop-off site...</Text>
        </View>
      )}

      {/* 2. Absolute Header */}
      <SafeAreaView style={styles.absoluteHeader} pointerEvents="box-none">
        <TouchableOpacity 
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home')} 
          style={styles.backBtnWrapper}
        >
          <ArrowLeft color="#fff" size={24} />
        </TouchableOpacity>
      </SafeAreaView>

      {/* 3. Bottom Sheet (Uber style form) */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, justifyContent: 'flex-end' }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 40}
        pointerEvents="box-none"
      >
        <View style={[styles.bottomSheet, isKeyboardVisible && { minHeight: 450 }]}>
          <View style={styles.bottomSheetHandle} />
          <ScrollView 
            style={styles.content} 
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.screenTitle}>Delivery Confirmation</Text>
            <Text style={styles.instruction}>Scan the collection box at the main facility to mark as delivered.</Text>

            <View style={styles.form}>
              <Text style={styles.label}>Box Barcode</Text>
              <View style={styles.barcodeRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={boxBarcode}
                  onChangeText={setBoxBarcode}
                  placeholder="Scan box barcode"
                  placeholderTextColor={COLORS.textMuted}
                />
                <TouchableOpacity style={styles.scanBtn} onPress={() => setIsScanning(true)}>
                  <Scan color="#fff" size={20} />
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Receiver Name</Text>
                <TextInput
                  style={styles.input}
                  value={receiverName}
                  onChangeText={setReceiverName}
                  placeholder="Enter receiver's name"
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>

              <View style={styles.photoSection}>
                <Text style={styles.label}>Proof of Delivery (Photo)</Text>
                {deliveryPhoto ? (
                  <View style={styles.photoContainer}>
                    <Image source={{ uri: deliveryPhoto }} style={styles.photo} />
                    <TouchableOpacity style={styles.removePhoto} onPress={() => setDeliveryPhoto(null)}>
                      <X color="#fff" size={20} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.photoBtn} onPress={pickImage}>
                    <Camera color={COLORS.primary} size={32} />
                    <Text style={styles.photoBtnText}>Capture Handover Photo</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity 
                style={styles.thirdPartyBtn} 
                onPress={() => navigation.navigate('ThirdPartyDispatch', { tripId: route.params?.tripId || user?.active_trip_id })}
              >
                <Truck color={COLORS.primary} size={20} />
                <Text style={styles.thirdPartyBtnText}>Dispatch via Third-Party</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Fixed bottom confirm button */}
          <View style={styles.footer}>
            <TouchableOpacity 
              style={[styles.confirmBtn, loading && { opacity: 0.7 }]} 
              onPress={confirmDelivery}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <CheckCircle color="#fff" size={24} />
                  <Text style={styles.confirmBtnText}>Confirm Delivery</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {isScanning && (
        <View style={StyleSheet.absoluteFill}>
          <BarcodeScanner 
            onScan={(data) => { setBoxBarcode(data); setIsScanning(false); }} 
            onClose={() => setIsScanning(false)}
            title="Scan Delivery Box"
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
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
    elevation: 8
  },
  mapLoadingContainer: {
    ...StyleSheet.absoluteFillObject,
    bottom: '40%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f5f9'
  },
  map: { width: '100%', height: '100%' },

  // Markers & Overlays (Uber style)
  // Pin marker styles (Unified with Fleet Map)
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
  markerTail: {
    width: 0, height: 0,
    borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    marginTop: -1,
  },
  uberOverlay: {
    position: 'absolute',
    top: 110,
    left: SPACING.lg,
    right: SPACING.lg,
    alignItems: 'center',
    zIndex: 999,
  },
  uberOverlayContent: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    alignItems: 'center',
    width: '95%',
    maxWidth: 500,
  },
  uberInfoItem: { alignItems: 'center', paddingHorizontal: SPACING.sm },
  uberInfoValue: { fontSize: 16, fontWeight: 'bold', color: '#0F172A' },
  uberInfoLabel: { fontSize: 10, color: '#64748B', textTransform: 'uppercase', marginTop: 2 },
  uberDivider: { width: 1, height: 24, backgroundColor: 'rgba(148, 163, 184, 0.3)' },

  // Bottom Sheet
  bottomSheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '75%', 
    minHeight: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
    width: '100%',
  },
  bottomSheetHandle: {
    width: 40,
    height: 5,
    backgroundColor: 'rgba(148, 163, 184, 0.4)',
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm
  },
  content: { flex: 1, paddingHorizontal: SPACING.lg },
  screenTitle: { color: COLORS.text, fontSize: 22, fontWeight: 'bold', marginBottom: 8, marginTop: 8 },
  instruction: { color: COLORS.textMuted, fontSize: 14, marginBottom: SPACING.lg },
  
  // Form
  form: { width: '100%', paddingBottom: 20 },
  label: { color: COLORS.text, fontSize: 14, fontWeight: '600', marginBottom: SPACING.sm },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 55,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)',
    marginBottom: SPACING.lg
  },
  barcodeRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  scanBtn: { 
    backgroundColor: COLORS.primary, 
    width: 50, 
    height: 55,
    borderRadius: RADIUS.md, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  thirdPartyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    height: 55,
    borderRadius: RADIUS.md,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(79, 70, 229, 0.05)',
    marginTop: SPACING.sm,
  },
  thirdPartyBtnText: { color: COLORS.secondary, fontSize: 14, fontWeight: '700' },
  photoSection: { marginTop: SPACING.md, marginBottom: SPACING.lg },
  photoBtn: { 
    height: 120, 
    backgroundColor: '#f1f5f9', 
    borderRadius: RADIUS.md, 
    borderWidth: 2, 
    borderColor: '#e2e8f0', 
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8
  },
  photoBtnText: { color: COLORS.textMuted, fontSize: 14, fontWeight: '600' },
  photoContainer: { position: 'relative', height: 160, borderRadius: RADIUS.md, overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  removePhoto: { 
    position: 'absolute', 
    top: 10, 
    right: 10, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    padding: 6, 
    borderRadius: 15 
  },

  // Footer
  footer: { 
    padding: SPACING.lg, 
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.1)'
  },
  confirmBtn: { 
    backgroundColor: COLORS.secondary, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    height: 56,
    borderRadius: RADIUS.md,
    gap: SPACING.sm,
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  confirmBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});

export default DeliveryScreen;
