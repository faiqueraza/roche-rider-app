import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/CustomAlertContext';
import { COLORS, SPACING, RADIUS } from '../theme/theme';
import { Truck, ArrowLeft, Send, Hash, User, MapPin, Calendar, Camera, Image as ImageIcon, X } from 'lucide-react-native';
import client from '../api/client';

const TRANSPORT_TYPES = [
  { id: 'bus', label: 'Bus Service' },
  { id: 'courier', label: 'Courier Service' },
  { id: 'cargo', label: 'Cargo Service' },
  { id: 'other', label: 'Other' },
];

const ThirdPartyDispatchScreen = ({ navigation, route }) => {
  const { tripId } = route.params;
  const { user } = useAuth();
  const { showAlert } = useAlert();
  
  const [transportType, setTransportType] = useState('bus');
  const [company, setCompany] = useState('');
  const [trackingNo, setTrackingNo] = useState('');
  const [contact, setContact] = useState('');
  const [destination, setDestination] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);
  const [receiptPhoto, setReceiptPhoto] = useState(null);

  const pickImage = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaType.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled) {
      setReceiptPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const submitDispatch = async () => {
    console.log('Submit Dispatch pressed', { company, destination, tripId });
    if (!company?.trim() || !destination?.trim() || !receiptPhoto) {
      showAlert('Error', 'Company, Destination, and Receipt Photo are required.', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await client.post(`${user.baseUrl}/api/dispatch_third_party`, {
        params: {
          trip_id: tripId,
          transport_data: {
            type: transportType,
            company: company,
            tracking_no: trackingNo,
            contact: contact,
            destination: destination,
            photo: receiptPhoto
          }
        }
      });

      if (response.data.result?.status === 'success') {
        showAlert('Success', 'Shipment dispatched successfully.', 'success', [
          { text: 'OK', onPress: () => navigation.navigate('Home') }
        ]);
      } else if (response.data.error) {
        const odooError = response.data.error.data?.message || response.data.error.message;
        showAlert('Odoo Server Error', odooError, 'error');
      } else {
        const msg = response.data.result?.message || 'Server error occurred.';
        showAlert('Dispatch Failed', msg, 'error');
      }
    } catch (e) {
      console.error('Dispatch error:', e);
      const isNetworkError = !e.response;
      if (isNetworkError) {
        const { savePendingSync } = await import('../store/offlineStore');
        await savePendingSync('third_party_dispatch', { 
          trip_id: tripId,
          transport_data: {
            type: transportType,
            company: company,
            tracking_no: trackingNo,
            contact: contact,
            destination: destination,
            photo: receiptPhoto
          }
        });
        showAlert('Offline', 'Dispatched offline with photo. Data will sync when you are back online.', 'success', [
          { text: 'OK', onPress: () => navigation.navigate('Home') }
        ]);
      } else {
        showAlert('Connection Error', 'Could not reach server. Please check your internet.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft color={COLORS.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>Third-Party Dispatch</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.infoCard}>
            <Truck color={COLORS.primary} size={24} />
            <Text style={styles.infoText}>Enter details for long-distance delivery shipment.</Text>
          </View>

          <Text style={styles.label}>Transport Type</Text>
          <View style={styles.typeGrid}>
            {TRANSPORT_TYPES.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.typeCard,
                  transportType === type.id && styles.typeCardSelected
                ]}
                onPress={() => setTransportType(type.id)}
              >
                <Text style={[
                  styles.typeText,
                  transportType === type.id && styles.typeTextSelected
                ]}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Logistics Company</Text>
            <View style={[
              styles.inputWrapper,
              focusedInput === 'company' && styles.inputWrapperFocused
            ]}>
              <Truck color={focusedInput === 'company' ? COLORS.primary : COLORS.textMuted} size={20} />
              <TextInput
                style={styles.input}
                value={company}
                onChangeText={setCompany}
                placeholder="e.g. Faisal Movers, TCS"
                placeholderTextColor={COLORS.textMuted}
                onFocus={() => setFocusedInput('company')}
                onBlur={() => setFocusedInput(null)}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Tracking Number</Text>
            <View style={[
              styles.inputWrapper,
              focusedInput === 'tracking' && styles.inputWrapperFocused
            ]}>
              <Hash color={focusedInput === 'tracking' ? COLORS.primary : COLORS.textMuted} size={20} />
              <TextInput
                style={styles.input}
                value={trackingNo}
                onChangeText={setTrackingNo}
                placeholder="Enter tracking/bilty number"
                placeholderTextColor={COLORS.textMuted}
                onFocus={() => setFocusedInput('tracking')}
                onBlur={() => setFocusedInput(null)}
              />
            </View>
          </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Driver/Contact Info</Text>
          <View style={[
            styles.inputWrapper,
            focusedInput === 'contact' && styles.inputWrapperFocused
          ]}>
            <User color={focusedInput === 'contact' ? COLORS.primary : COLORS.textMuted} size={20} />
            <TextInput
              style={styles.input}
              value={contact}
              onChangeText={setContact}
              placeholder="Name or Phone number"
              placeholderTextColor={COLORS.textMuted}
              onFocus={() => setFocusedInput('contact')}
              onBlur={() => setFocusedInput(null)}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Destination City</Text>
          <View style={[
            styles.inputWrapper,
            focusedInput === 'destination' && styles.inputWrapperFocused
          ]}>
            <MapPin color={focusedInput === 'destination' ? COLORS.primary : COLORS.textMuted} size={20} />
            <TextInput
              style={styles.input}
              value={destination}
              onChangeText={setDestination}
              placeholder="e.g. Gilgit, Karachi"
              placeholderTextColor={COLORS.textMuted}
              onFocus={() => setFocusedInput('destination')}
              onBlur={() => setFocusedInput(null)}
            />
          </View>
        </View>

        <View style={styles.photoSection}>
          <Text style={styles.label}>Receipt / Bilty Photo</Text>
          {receiptPhoto ? (
            <View style={styles.photoContainer}>
              <Image source={{ uri: receiptPhoto }} style={styles.photo} />
              <TouchableOpacity style={styles.removePhoto} onPress={() => setReceiptPhoto(null)}>
                <X color="#fff" size={20} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.photoBtn} onPress={pickImage}>
              <Camera color={COLORS.primary} size={32} />
              <Text style={styles.photoBtnText}>Capture Receipt Photo</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.submitBtn, loading && { opacity: 0.7 }]} 
          onPress={submitDispatch}
          disabled={loading}
        >
          <Send color="#fff" size={20} />
          <Text style={styles.submitBtnText}>{loading ? 'Dispatching...' : 'Confirm Dispatch'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingTop: 60, 
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.card 
  },
  title: { color: COLORS.text, fontSize: 18, fontWeight: 'bold' },
  backBtn: { padding: SPACING.xs },
  content: { flex: 1, padding: SPACING.lg },
  infoCard: {
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  infoText: { color: COLORS.primary, flex: 1, fontSize: 14, fontWeight: '500' },
  label: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: SPACING.xs, marginLeft: SPACING.xs },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.xl },
  typeCard: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.cardBorder
  },
  typeCardSelected: { backgroundColor: COLORS.primaryGlow, borderColor: COLORS.primary },
  typeText: { color: COLORS.textMuted, fontSize: 14, fontWeight: '600' },
  typeTextSelected: { color: COLORS.primary },
  inputGroup: { marginBottom: SPACING.lg },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  inputWrapperFocused: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  input: {
    flex: 1,
    padding: SPACING.lg,
    color: COLORS.text,
    fontSize: 16,
  },
  footer: { padding: SPACING.lg, backgroundColor: COLORS.card },
  submitBtn: { 
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
  submitBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
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
  }
});

export default ThirdPartyDispatchScreen;
