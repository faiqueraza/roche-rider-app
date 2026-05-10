import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, FlatList, Modal, KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard, Image } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/CustomAlertContext';
import { COLORS, SPACING, RADIUS } from '../theme/theme';
import { Package, Scan, Plus, CheckCircle, Trash2, ArrowLeft, MapPin, Tag, Building2, Activity, Microscope } from 'lucide-react-native';
import BarcodeScanner from '../components/BarcodeScanner';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { savePendingSync } from '../store/offlineStore';
import { Camera, Image as ImageIcon, X } from 'lucide-react-native';
import MapView, { Marker, Circle, Polyline } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';

const GOOGLE_MAPS_APIKEY = "AIzaSyBYSaFO3FMBDfUj7weAYdpiv6_jvJuUD50";
import client from '../api/client';

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

const PickupScreen = ({ navigation, route }) => {
  const { tripId } = route.params;
  const { user } = useAuth();
  const { showAlert } = useAlert();
  
  const [location, setLocation] = useState('');
  const [boxBarcode, setBoxBarcode] = useState('');
  const [scannedTubes, setScannedTubes] = useState([]);
  const [isScanningBox, setIsScanningBox] = useState(false);
  const [isScanningTube, setIsScanningTube] = useState(false);
  const [loading, setLoading] = useState(false);
  const [offices, setOffices] = useState([]);
  const [userRegion, setUserRegion] = useState(null);
  const [userCoords, setUserCoords] = useState(null); // plain lat/lng for Directions API
  const [nearestOfficeData, setNearestOfficeData] = useState(null);
  const [distanceInfo, setDistanceInfo] = useState({ km: 0, fare: 0, mins: 0 });
  const [routeDestination, setRouteDestination] = useState(null); // Currently navigating to
  const [routeFailed, setRouteFailed] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [tubeInputBarcode, setTubeInputBarcode] = useState('');
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredOffices, setFilteredOffices] = useState([]);
  const [photos, setPhotos] = useState({ racks: null, box: null, paper: null });
  const [showReviewModal, setShowReviewModal] = useState(false);

  useEffect(() => {
    const fetchOfficesAndLocation = async () => {
      let officeData = [];
      try {
        const response = await client.post(`${user.baseUrl}/api/collection_places`, { params: {} });
        if (response.data.result?.status === 'success') {
          officeData = response.data.result.data;
          setOffices(officeData);
          setFilteredOffices(officeData);
          await AsyncStorage.setItem('@cached_offices', JSON.stringify(officeData));
        }
      } catch (e) {
        console.error("Fetch offices failed", e);
        const cached = await AsyncStorage.getItem('@cached_offices');
        if (cached) {
          officeData = JSON.parse(cached);
          setOffices(officeData);
        }
      }

      // Detect Current Location
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        
        let loc = null;
        try {
          loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, timeout: 5000 });
        } catch (e) {
          loc = await Location.getLastKnownPositionAsync({});
        }

        if (loc) {
          const currentLat = loc.coords.latitude;
          const currentLng = loc.coords.longitude;
          
          setUserCoords({ latitude: currentLat, longitude: currentLng });
          setUserRegion({
            latitude: currentLat,
            longitude: currentLng,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          });

          // Sort all offices/partners by distance from current location
          const sortedData = [...officeData].map(office => ({
            ...office,
            distance: getDistance(currentLat, currentLng, office.lat, office.lng)
          })).sort((a, b) => a.distance - b.distance);

          setOffices(sortedData);
          setFilteredOffices(sortedData);

          if (sortedData.length > 0) {
            const nearest = sortedData[0];
            setNearestOfficeData(nearest);
            // Always show route to nearest site
            setRouteDestination({ latitude: nearest.lat, longitude: nearest.lng });
            setRouteFailed(false);
            
            const distKm = (nearest.distance / 1000).toFixed(2);
            const mins = Math.round((nearest.distance / 1000) * 3);
            const fare = Math.round((nearest.distance / 1000) * 50);
            setDistanceInfo({ km: distKm, fare: fare, mins: mins });
            
            // Safety: Only auto-select if within 500 meters (0.5 km)
            if (parseFloat(distKm) < 0.5) {
              setLocation(nearest.name);
              showAlert('Location Detected', `You are at ${nearest.name}.`, 'success');
            } else {
              // Too far away - don't auto-fill, just inform
              setLocation(''); 
              showAlert('Nearest Site Found', `${nearest.name} is the closest site, but it is ${distKm} km away. Showing route. Select your site manually.`, 'info');
            }
          }
        } else if (officeData.length > 0) {
          setUserRegion({
            latitude: officeData[0].lat,
            longitude: officeData[0].lng,
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
          });
        }
      } catch (locErr) {
        console.error("Location detection failed", locErr);
      }
    };

    const fetchProducts = async () => {
      try {
        const response = await client.post(`${user.baseUrl}/api/products`, { params: {} });
        if (response.data.result?.status === 'success') {
          setProducts(response.data.result.data);
          await AsyncStorage.setItem('@cached_products', JSON.stringify(response.data.result.data));
        }
      } catch (e) {
        console.error("Fetch products failed", e);
        const cached = await AsyncStorage.getItem('@cached_products');
        if (cached) setProducts(JSON.parse(cached));
      }
    };

    fetchOfficesAndLocation();
    fetchProducts();
  }, [route.params?.autoLocation]);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    const filtered = offices.filter(office => 
      office.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredOffices(filtered);
  }, [searchQuery, offices]);

  const onBoxScan = (data) => {
    setBoxBarcode(data);
    setIsScanningBox(false);
  };

  const onTubeScan = (data) => {
    if (!selectedProduct) {
      showAlert('Product Required', 'Please select a product/sample type before scanning.', 'warning');
      setIsScanningTube(false);
      return;
    }
    // Check for duplicate barcode WITHIN THE SAME TYPE
    if (scannedTubes.some(t => t.barcode === data && t.productId === selectedProduct.id)) {
      showAlert('Duplicate Scan', `This barcode (${data}) has already been scanned as a ${selectedProduct.name}.`, 'error');
      return;
    }
    const type = selectedProduct.name.toLowerCase().includes('pcr') ? 'pcr' : 'cbc';
    setScannedTubes([{ 
      barcode: data, 
      productId: selectedProduct.id, 
      productName: selectedProduct.name, 
      tubeType: type,
      timestamp: new Date().toISOString() 
    }, ...scannedTubes]);
    setIsScanningTube(false);
  };

  const removeTube = (barcode, productId) => {
    setScannedTubes(scannedTubes.filter(t => !(t.barcode === barcode && t.productId === productId)));
  };

  const addTubeManually = () => {
    if (!tubeInputBarcode.trim()) {
      showAlert('Empty Barcode', 'Please enter or scan a tube ID first.', 'warning');
      return;
    }
    if (!selectedProduct) {
      showAlert('Product Required', 'Please select a product/sample type before adding.', 'warning');
      return;
    }
    onTubeScan(tubeInputBarcode.trim());
    setTubeInputBarcode('');
  };
  const takePhoto = async (type) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission Denied', 'Camera access is required to take photos.', 'error');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled) {
      setPhotos({ ...photos, [type]: `data:image/jpeg;base64,${result.assets[0].base64}` });
    }
  };

  const confirmPickup = async () => {
    // Auto-add tube if user typed it but didn't click Plus
    let finalScannedTubes = [...scannedTubes];
    if (tubeInputBarcode && selectedProduct) {
      if (!finalScannedTubes.some(t => t.barcode === tubeInputBarcode)) {
        const type = selectedProduct.name.toLowerCase().includes('pcr') ? 'pcr' : 'cbc';
        finalScannedTubes.push({ 
          barcode: tubeInputBarcode, 
          productId: selectedProduct.id, 
          productName: selectedProduct.name,
          tubeType: type
        });
      }
    }

    if (!location?.trim() || !boxBarcode?.trim() || finalScannedTubes.length === 0) {
      showAlert('Missing Info', 'Please provide location, box barcode and scan at least one tube.', 'error');
      return;
    }

    setLoading(true);
    try {
      // 1. Create Pickup with photos
      const pickupResponse = await client.post(`${user.baseUrl}/api/create_pickup`, {
        params: { 
          trip_id: tripId,
          location_name: location,
          box_barcode: boxBarcode,
          latitude: userRegion?.latitude || 0,
          longitude: userRegion?.longitude || 0,
          photo_racks: photos.racks,
          photo_box: photos.box,
          photo_paper: photos.paper
        }
      });

      if (pickupResponse.data.result?.status === 'success') {
        const pickupId = pickupResponse.data.result.pickup_id;
        
        // 2. Scan Tubes
        for (const tube of finalScannedTubes) {
          const scanRes = await client.post(`${user.baseUrl}/api/scan_tube`, {
            params: { 
              pickup_id: pickupId,
              barcode: tube.barcode,
              product_id: tube.productId,
              tube_type: tube.tubeType || 'cbc'
            }
          });
          
          if (scanRes.data.error) {
             throw new Error(scanRes.data.error.data?.message || scanRes.data.error.message);
          }
        }

        const pickingName = pickupResponse.data.result.picking_name || 'Transfer';
        
        showAlert(
          'Samples Collected', 
          `Inventory Transfer ${pickingName} created. Pickup confirmed and synced to Odoo.`,
          'success',
          [
            { text: 'Later', type: 'cancel', onPress: () => navigation.goBack() },
            { text: 'View Route', onPress: () => navigation.navigate('Main', { screen: 'Deliveries', params: { showRoute: true } }) }
          ]
        );
      } else if (pickupResponse.data.error) {
        // Handle Odoo JSON-RPC Error
        const odooError = pickupResponse.data.error.data?.message || pickupResponse.data.error.message;
        showAlert('Odoo Server Error', odooError, 'error');
      } else {
        const msg = pickupResponse.data.result?.message || 'Unknown error occurred on server.';
        showAlert('Odoo Error', msg, 'error');
      }
    } catch (e) {
      console.error("Pickup confirmation failed", e);
      const errorMsg = e.response?.data?.result?.message || e.message;
      showAlert('Sync Error', `Failed to sync with Odoo: ${errorMsg}`, 'error');
      
      // Fallback to offline storage only if it was a network error (no response)
      if (!e.response) {
        const pickupData = { 
          trip_id: tripId, 
          location_name: location, 
          box_barcode: boxBarcode 
        };
      await savePendingSync('pickup', pickupData);
      
      // Save Scanned Tubes Offline
        for (const tube of finalScannedTubes) {
          await savePendingSync('scan', {
            pickup_id: null, // Backend will link this via box_barcode later
            barcode: tube.barcode,
            product_id: tube.productId,
            tube_type: tube.tubeType || 'cbc',
            box_barcode: boxBarcode // Key hint for offline linking
          });
        }
      
      showAlert('Offline Mode', 'Internet connection lost. Data saved locally and will sync automatically once online.', 'warning');
      navigation.navigate('Home');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. Map as absolute background */}
      {userRegion ? (
        <View style={StyleSheet.absoluteFill}>
          <MapView 
            style={styles.map} 
            region={userRegion}
            showsUserLocation={true}
            showsMyLocationButton={true}
          >
            {/* 500m proximity circle around rider */}
            {userCoords && (
              <Circle
                center={userCoords}
                radius={500}
                fillColor="rgba(0, 85, 164, 0.08)"
                strokeColor="rgba(0, 85, 164, 0.4)"
                strokeWidth={2}
              />
            )}

            {/* Road guider to selected/nearest location */}
            {userCoords && routeDestination && !routeFailed && (
              <MapViewDirections
                origin={userCoords}
                destination={routeDestination}
                apikey={GOOGLE_MAPS_APIKEY}
                strokeWidth={4}
                strokeColor={COLORS.primary}
                mode="DRIVING"
                precision="high"
                onReady={(result) => console.log(`Route: ${result.distance}km, ${result.duration}min`)}
                onError={(err) => { console.error('Directions Error:', err); setRouteFailed(true); }}
              />
            )}

            {offices.map((office, idx) => {
              const isSelected = nearestOfficeData?.id === office.id;
              const isPickup = office.type === 'collection';
              const color = isSelected ? COLORS.primary : (isPickup ? '#0DA65A' : '#7C3AED');
              const IconComponent = isPickup ? Package : Building2;

              return (
                <Marker
                  key={idx}
                  coordinate={{ latitude: office.lat, longitude: office.lng }}
                  onPress={() => {
                    setNearestOfficeData(office);
                    setLocation(office.name);
                    setRouteDestination({ latitude: office.lat, longitude: office.lng });
                    setRouteFailed(false);
                  }}
                  anchor={{ x: 0.5, y: 1 }}
                >
                  <View style={styles.markerContainer}>
                    <View style={[
                      styles.markerPin, 
                      { backgroundColor: color, borderColor: '#fff' },
                      isSelected && { width: 40, height: 40, borderRadius: 20 }
                    ]}>
                      <IconComponent color="#fff" size={isSelected ? 22 : 18} strokeWidth={2.5} />
                    </View>
                    <View style={[styles.markerTail, { borderTopColor: color }]} />
                  </View>
                </Marker>
              );
            })}
            {nearestOfficeData && (
              <>
                <Circle
                  center={{ latitude: nearestOfficeData.lat, longitude: nearestOfficeData.lng }}
                  radius={nearestOfficeData.radius || 100}
                  fillColor="rgba(79, 70, 229, 0.1)"
                  strokeColor="rgba(79, 70, 229, 0.3)"
                  strokeWidth={1}
                />
              </>
            )}
          </MapView>
          
          {nearestOfficeData && (
            <View style={[styles.uberOverlay, { zIndex: 999 }]}>
              <View style={styles.uberOverlayContent}>
                <View style={[styles.uberInfoItem, { flex: 1, alignItems: 'flex-start' }]}>
                  <Text style={styles.uberInfoValue} numberOfLines={1} adjustsFontSizeToFit>{nearestOfficeData.name}</Text>
                  <Text style={styles.uberInfoLabel}>Nearest Place</Text>
                </View>
                <View style={styles.uberDivider} />
                <View style={[styles.uberInfoItem, { minWidth: 60 }]}>
                  <Text style={styles.uberInfoValue}>{(nearestOfficeData.distance/1000).toFixed(1)} km</Text>
                  <Text style={styles.uberInfoLabel}>Dist.</Text>
                </View>
              </View>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.container}>
          <Text style={{alignSelf:'center', marginTop: 100}}>Initializing map...</Text>
        </View>
      )}

      {/* 2. Absolute Header */}
      <View style={styles.absoluteHeader}>
        <TouchableOpacity 
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home')} 
          style={styles.backBtnWrapper}
        >
          <ArrowLeft color="#fff" size={24} />
        </TouchableOpacity>
      </View>

      {/* 3. Keyboard avoiding wrapper for the sheet */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        style={{ flex: 1, justifyContent: 'flex-end' }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 30}
        pointerEvents="box-none"
      >
        <View style={[styles.bottomSheet, isKeyboardVisible && { maxHeight: '55%' }]}>
          <View style={styles.bottomSheetHandle} />
          <ScrollView 
            style={styles.content} 
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >

        <View style={styles.section}>
          <Text style={styles.label}>Collection Location</Text>
          <TouchableOpacity 
            style={styles.locationSelector} 
            onPress={() => setShowLocationModal(true)}
          >
            <Text style={location ? styles.locationText : styles.locationPlaceholder}>
              {location || "Select a location"}
            </Text>
            <MapPin color={COLORS.textMuted} size={20} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Box Barcode</Text>
          <View style={styles.barcodeRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              value={boxBarcode}
              onChangeText={setBoxBarcode}
              placeholder="Scan or enter box ID"
              placeholderTextColor={COLORS.textMuted}
            />
            <TouchableOpacity style={styles.scanBtn} onPress={() => setIsScanningBox(true)}>
              <Scan color="#fff" size={20} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Collection Counter</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.productScroll}>
            {products.map(p => {
              const isSelected = selectedProduct?.id === p.id;
              const count = scannedTubes.filter(t => t.productId === p.id).length;
              return (
                <TouchableOpacity 
                  key={p.id} 
                  style={[
                    styles.productPill, 
                    isSelected && styles.productPillSelected,
                    // Dynamic coloring based on name
                    isSelected && p.name.toLowerCase().includes('pcr') && { backgroundColor: '#EF4444', borderColor: '#EF4444' },
                    isSelected && p.name.toLowerCase().includes('cbc') && { backgroundColor: '#7C3AED', borderColor: '#7C3AED' }
                  ]}
                  onPress={() => setSelectedProduct(p)}
                >
                  <Text style={[styles.productPillText, isSelected && styles.productPillTextSelected]}>{p.name}</Text>
                  <View style={[styles.countBadge, isSelected && styles.countBadgeSelected]}>
                    <Text style={[styles.countText, isSelected && styles.countTextSelected]}>{count}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>


          <View style={styles.tubeHeader}>
            <Text style={styles.label}>Total Scanned: {scannedTubes.length}</Text>
          </View>
          
          <View style={styles.barcodeRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              value={tubeInputBarcode}
              onChangeText={setTubeInputBarcode}
              placeholder={selectedProduct ? `Scan ${selectedProduct.name}...` : "Select type first"}
              placeholderTextColor={COLORS.textMuted}
            />
            <TouchableOpacity style={styles.scanBtn} onPress={() => setIsScanningTube(true)}>
              <Scan color="#fff" size={20} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.scanBtn, { backgroundColor: COLORS.secondary }]} 
              onPress={addTubeManually}
            >
              <Plus color="#fff" size={20} />
            </TouchableOpacity>
          </View>

          {scannedTubes.length === 0 ? (
            <View style={styles.emptyState}>
              <Package color={COLORS.card} size={64} />
              <Text style={styles.emptyText}>No tubes scanned yet</Text>
            </View>
          ) : (
            <View style={styles.tubeList}>
              {scannedTubes.map((item, index) => (
                <View key={index} style={styles.tubeItem}>
                  <View>
                    <Text style={styles.tubeBarcode}>{item.barcode}</Text>
                    <View style={styles.typeTag}>
                       <Tag size={10} color={COLORS.primary} />
                       <Text style={styles.typeTagText}>{item.productName} ({item.tubeType?.toUpperCase()})</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => removeTube(item.barcode, item.productId)}>
                    <Trash2 color={COLORS.danger} size={20} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Required Photos</Text>
          <View style={styles.photoGrid}>
            {[
              { key: 'racks', label: 'Racks' },
              { key: 'box', label: 'Box' },
              { key: 'paper', label: 'Paper' }
            ].map(item => (
              <TouchableOpacity 
                key={item.key} 
                style={[styles.photoCard, photos[item.key] && styles.photoCardActive]}
                onPress={() => takePhoto(item.key)}
              >
                {photos[item.key] ? (
                  <Image source={{ uri: photos[item.key] }} style={styles.capturedPhoto} />
                ) : (
                  <Camera color={COLORS.textMuted} size={24} />
                )}
                <Text style={styles.photoLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        </ScrollView>
        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.confirmBtn, loading && { opacity: 0.7 }]} 
            onPress={() => setShowReviewModal(true)}
            disabled={loading}
          >
            <CheckCircle color="#fff" size={24} />
            <Text 
              style={styles.confirmBtnText}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {loading ? 'Confirming...' : 'Review & Confirm'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>

    {/* Review Modal */}
    <Modal visible={showReviewModal} animationType="fade" transparent={true}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { height: '80%' }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Review Collection</Text>
            <TouchableOpacity onPress={() => setShowReviewModal(false)}>
              <X color={COLORS.text} size={24} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }}>
            <View style={styles.reviewSection}>
               <Text style={styles.reviewLabel}>Location</Text>
               <Text style={styles.reviewValue}>{location}</Text>
            </View>
            <View style={styles.reviewSection}>
               <Text style={styles.reviewLabel}>Tube Counts</Text>
               {products.map(p => {
                 const count = scannedTubes.filter(t => t.productId === p.id).length;
                 if (count === 0) return null;
                 return (
                   <View key={p.id} style={styles.reviewRow}>
                      <Text style={styles.reviewText}>{p.name}</Text>
                      <Text style={styles.reviewCount}>{count}</Text>
                   </View>
                 );
               })}
            </View>
            <View style={styles.reviewSection}>
               <Text style={styles.reviewLabel}>Photos Captured</Text>
               <View style={styles.photoReviewGrid}>
                  {Object.entries(photos).map(([key, uri]) => (
                    uri && <Image key={key} source={{ uri }} style={styles.photoThumb} />
                  ))}
               </View>
            </View>
          </ScrollView>
          <TouchableOpacity 
            style={[styles.confirmBtn, { marginTop: SPACING.lg }]} 
            onPress={confirmPickup}
            disabled={loading}
          >
            <CheckCircle color="#fff" size={24} />
            <Text style={styles.confirmBtnText}>Final Submit</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>

      <Modal visible={isScanningBox} animationType="slide">
        <BarcodeScanner 
          onScan={onBoxScan} 
          onClose={() => setIsScanningBox(false)} 
          title="Scan Box Barcode"
        />
      </Modal>

      <Modal visible={isScanningTube} animationType="slide">
        <BarcodeScanner 
          onScan={onTubeScan} 
          onClose={() => setIsScanningTube(false)} 
          title="Scan Tube Barcode"
        />
      </Modal>


      {/* Location Selection Modal */}
      <Modal visible={showLocationModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Collection Place</Text>
              <TouchableOpacity onPress={() => setShowLocationModal(false)}>
                <Text style={styles.closeBtn}>Close</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search pickup location..."
                placeholderTextColor={COLORS.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
            <FlatList
              data={filteredOffices}
              keyExtractor={item => item.id.toString()}
              ListEmptyComponent={() => (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No locations match your search.</Text>
                </View>
              )}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.locationItem}
                  onPress={() => {
                    setLocation(item.name);
                    setNearestOfficeData(item);
                    setRouteDestination({ latitude: item.lat, longitude: item.lng });
                    setRouteFailed(false);
                    setShowLocationModal(false);
                  }}
                >
                  <MapPin color={item.type === 'testing' ? COLORS.secondary : COLORS.primary} size={20} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.locationItemText}>{item.name}</Text>
                    <View style={styles.statusRowSmall}>
                      <Text style={styles.locationItemSub}>
                        {item.type === 'testing' ? 'Testing Site' : item.type === 'lab' ? 'Laboratory' : 'Collection Site'}
                        {item.distance && ` • ${(item.distance/1000).toFixed(1)} km`}
                      </Text>
                      <View style={[styles.statusTag, { backgroundColor: item.distance && item.distance < 100 ? '#dcfce7' : '#f3f4f6' }]}>
                        <Text style={[styles.statusTagText, { color: item.distance && item.distance < 100 ? '#166534' : '#6b7280' }]}>
                          {item.distance && item.distance < 100 ? 'AT SITE' : 'READY'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {item.distance && item.distance < 500 ? (
                    <View style={styles.nearbyBadge}>
                      <Text style={styles.nearbyBadgeText}>NEARBY</Text>
                    </View>
                  ) : (
                    <MapPin color={COLORS.primary} size={16} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
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
    backgroundColor: COLORS.primary, // Darker, premium feel
    borderRadius: 25,
    padding: SPACING.md,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8
  },
  mapContainer: {
    flex: 1,
  },
  map: { width: '100%', height: '100%' },
  simpleMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
  uberOverlay: {
    position: 'absolute',
    top: 110, // Sit below the back button
    left: SPACING.lg,
    right: SPACING.lg,
    alignItems: 'center',
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
  uberInfoItem: {
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
  },
  uberInfoValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A', // Dark Slate for visibility on white background
  },
  uberInfoLabel: {
    fontSize: 10,
    color: '#64748B', // Slate 500 for secondary text
    textTransform: 'uppercase',
    marginTop: 2,
  },
  uberDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(148, 163, 184, 0.3)',
  },
  bottomSheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '80%', // Allow it to shrink/expand but not cover entire map
    minHeight: 400,   // Ensure enough space for inputs
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
  section: { marginBottom: SPACING.xl },
  label: { color: COLORS.text, fontSize: 14, fontWeight: '600', marginBottom: SPACING.sm },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 50, // Fixed height for alignment
    color: COLORS.text,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)',
  },
  locationSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 55, // Increased height to prevent text cropping
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)',
  },
  locationText: { color: COLORS.text, fontSize: 16, lineHeight: 22 },
  locationPlaceholder: { color: COLORS.textMuted, fontSize: 16, lineHeight: 22 },
  barcodeRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center' },
  scanBtn: { 
    backgroundColor: COLORS.primary, 
    width: 50, 
    height: 55, // Match selector height
    borderRadius: RADIUS.md, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  tubeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addBtnText: { color: COLORS.secondary, fontWeight: 'bold' },
  emptyState: { alignItems: 'center', padding: SPACING.xl, marginTop: SPACING.lg },
  emptyText: { color: COLORS.textMuted, marginTop: SPACING.sm },
  tubeList: { 
    backgroundColor: COLORS.card, 
    borderRadius: RADIUS.lg, 
    overflow: 'hidden',
    marginTop: SPACING.md, // Spacing between input and list
  },
  tubeItem: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.05)'
  },
  tubeBarcode: { color: COLORS.text, fontSize: 16 },
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
  confirmBtnText: { 
    color: '#fff', 
    fontSize: 18, 
    fontWeight: 'bold',
    flexShrink: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    height: '60%',
    padding: SPACING.lg
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.1)'
  },
  modalTitle: { color: COLORS.text, fontSize: 18, fontWeight: 'bold' },
  closeBtn: { color: COLORS.primary, fontWeight: 'bold' },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.05)',
    gap: SPACING.sm
  },
  locationItemText: { color: COLORS.text, fontSize: 16 },
  locationItemSub: { color: COLORS.textMuted, fontSize: 12 },
  searchContainer: { padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: 'rgba(148, 163, 184, 0.1)' },
  searchInput: { backgroundColor: COLORS.background, borderRadius: RADIUS.md, padding: SPACING.md, color: COLORS.text, borderWidth: 1, borderColor: COLORS.cardBorder },
  statusRowSmall: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  statusTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  statusTagText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  productScroll: { marginBottom: SPACING.md },
  productPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, marginRight: 10, borderWidth: 1, borderColor: COLORS.cardBorder, gap: 8 },
  productPillSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  productPillText: { color: COLORS.text, fontWeight: '600' },
  productPillTextSelected: { color: '#fff' },
  countBadge: { backgroundColor: 'rgba(59, 130, 246, 0.1)', paddingHorizontal: 6, borderRadius: 10 },
  countBadgeSelected: { backgroundColor: 'rgba(255,255,255,0.2)' },
  countText: { color: COLORS.primary, fontSize: 12, fontWeight: 'bold' },
  countTextSelected: { color: '#fff' },
  typeTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  typeTagText: { fontSize: 10, color: COLORS.primary, fontWeight: '600' },
  photoGrid: { flexDirection: 'row', gap: SPACING.md, justifyContent: 'space-between' },
  photoCard: { flex: 1, height: 80, backgroundColor: COLORS.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.cardBorder, justifyContent: 'center', alignItems: 'center', gap: 4 },
  photoCardActive: { borderColor: COLORS.secondary, backgroundColor: 'rgba(16, 185, 129, 0.05)' },
  photoLabel: { fontSize: 10, color: COLORS.textMuted, fontWeight: '700' },
  capturedPhoto: { width: '100%', height: '100%', borderRadius: RADIUS.md, position: 'absolute' },
  reviewSection: { marginBottom: SPACING.lg, padding: SPACING.md, backgroundColor: COLORS.card, borderRadius: RADIUS.md },
  reviewLabel: { fontSize: 12, color: COLORS.textMuted, textTransform: 'uppercase', marginBottom: 4 },
  reviewValue: { fontSize: 16, color: COLORS.text, fontWeight: 'bold' },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  reviewText: { color: COLORS.text },
  reviewCount: { color: COLORS.primary, fontWeight: 'bold' },
  photoReviewGrid: { flexDirection: 'row', gap: 8, marginTop: 8 },
  photoThumb: { width: 60, height: 60, borderRadius: 8 },
  // Pin marker styles (Unified)
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
  nearbyBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  nearbyBadgeText: { color: '#166534', fontSize: 10, fontWeight: 'bold' },
});

export default PickupScreen;
