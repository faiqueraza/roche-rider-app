import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/CustomAlertContext';
import { COLORS, SPACING, RADIUS } from '../theme/theme';
import { AlertTriangle, ArrowLeft, Send, Camera, X } from 'lucide-react-native';
import client from '../api/client';
import * as Location from 'expo-location';

const ISSUE_TYPES = [
  { id: 'breakdown', label: 'Vehicle Breakdown' },
  { id: 'accident', label: 'Accident' },
  { id: 'delay', label: 'Delay' },
  { id: 'health', label: 'Health Issue' },
  { id: 'route', label: 'Route Blockage' },
  { id: 'other', label: 'Other' },
];

const ReportIssueScreen = ({ navigation, route }) => {
  const { tripId } = route.params || {};
  const { user } = useAuth();
  const { showAlert } = useAlert();
  
  const [selectedType, setSelectedType] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [issuePhoto, setIssuePhoto] = useState(null);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission Denied', 'We need camera access to capture proof of the emergency.', 'error');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled) {
        setIssuePhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    } catch (error) {
      console.error("Camera launch error:", error);
      showAlert('Camera Error', 'Could not open camera. Please try again.', 'error');
    }
  };

  const submitIssue = async () => {
    if (!selectedType) {
      showAlert('Error', 'Please select an issue type.', 'error');
      return;
    }

    setLoading(true);
    try {
      let lat = null;
      let lng = null;
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, timeout: 5000 });
          lat = loc.coords.latitude;
          lng = loc.coords.longitude;
        }
      } catch (locErr) {
        console.warn("Could not fetch location for issue report", locErr);
      }

      const response = await client.post(`${user.baseUrl}/api/report_issue`, {
        params: {
          rider_id: user.rider_id,
          trip_id: tripId || null,
          issue_type: selectedType,
          description: description,
          latitude: lat,
          longitude: lng,
          photo: issuePhoto
        }
      });

      if (response.data.result?.status === 'success') {
        const issueId = response.data.result.issue_id;
        showAlert('Reported', 'Your issue has been reported. A supervisor will contact you shortly.', 'success', [
          { 
            text: 'Open Chat', 
            onPress: () => navigation.navigate('IssueChat', { 
              issueId: issueId,
              issueType: selectedType,
              description: description
            }) 
          }
        ]);
      } else if (response.data.error) {
        const odooError = response.data.error.data?.message || response.data.error.message;
        showAlert('Odoo Server Error', odooError, 'error');
      } else {
        const msg = response.data.result?.message || 'Server error occurred.';
        showAlert('Error', msg, 'error');
      }
    } catch (e) {
      console.error(e);
      // If network error, save offline
      const isNetworkError = !e.response;
      if (isNetworkError) {
        const { savePendingSync } = await import('../store/offlineStore');
        await savePendingSync('issue', {
          rider_id: user.rider_id,
          trip_id: tripId || null,
          issue_type: selectedType,
          description: description,
          latitude: lat,
          longitude: lng,
          photo: issuePhoto // Added photo for offline sync
        });
        showAlert('Offline', 'Report saved offline with photo. It will sync automatically when online.', 'success', [
          { text: 'OK', onPress: () => navigation.goBack() }
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
      {/* Floating Header */}
      <SafeAreaView style={styles.absoluteHeader} pointerEvents="box-none">
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backBtnWrapper}
        >
          <ArrowLeft color="#fff" size={24} />
        </TouchableOpacity>
      </SafeAreaView>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          <View style={{ height: 90 }} />
          <Text style={styles.screenTitle}>Report Emergency</Text>
          
          <View style={styles.warningBox}>
            <AlertTriangle color={COLORS.danger} size={32} />
            <Text style={styles.warningText}>
              Use this form only for critical emergencies. Admins will be notified instantly.
            </Text>
          </View>

          <Text style={styles.label}>Select Issue Type</Text>
          <View style={styles.typeGrid}>
            {ISSUE_TYPES.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.typeCard,
                  selectedType === type.id && styles.typeCardSelected
                ]}
                onPress={() => setSelectedType(type.id)}
              >
                <Text style={[
                  styles.typeText,
                  selectedType === type.id && styles.typeTextSelected
                ]}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.photoSection}>
            <Text style={styles.label}>Visual Proof (Optional)</Text>
            {issuePhoto ? (
              <View style={styles.photoContainer}>
                <Image source={{ uri: issuePhoto }} style={styles.photo} />
                <TouchableOpacity style={styles.removePhoto} onPress={() => setIssuePhoto(null)}>
                  <X color="#fff" size={20} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.photoBtn} onPress={pickImage}>
                <Camera color={COLORS.primary} size={32} />
                <Text style={styles.photoBtnText}>Capture Photo</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.label}>Description (Optional)</Text>
          <TextInput
            style={[styles.input, isFocused && styles.inputFocused]}
            multiline
            numberOfLines={4}
            value={description}
            onChangeText={setDescription}
            placeholder="Provide more details..."
            placeholderTextColor={COLORS.textMuted}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />
          <View style={styles.footerInner}>
            <TouchableOpacity 
              style={[styles.submitBtn, loading && { opacity: 0.7 }]} 
              onPress={submitIssue}
              disabled={loading}
            >
              <Send color="#fff" size={20} />
              <Text style={styles.submitBtnText}>{loading ? 'Reporting...' : 'Submit Report'}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    backgroundColor: COLORS.danger, // Using danger color for emergency
    borderRadius: 25,
    padding: SPACING.md,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8
  },
  screenTitle: { color: COLORS.text, fontSize: 24, fontWeight: 'bold', marginBottom: SPACING.lg },
  content: { flex: 1, padding: SPACING.lg },
  warningBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)'
  },
  warningText: { color: COLORS.danger, flex: 1, fontSize: 14, fontWeight: '500' },
  label: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: SPACING.md, marginLeft: SPACING.xs },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.xl },
  typeCard: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.cardBorder
  },
  typeCardSelected: { backgroundColor: 'rgba(239, 68, 68, 0.2)', borderColor: COLORS.danger },
  typeText: { color: COLORS.textMuted, fontWeight: '600', fontSize: 14 },
  typeTextSelected: { color: COLORS.danger },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    color: COLORS.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    height: 120,
    textAlignVertical: 'top'
  },
  inputFocused: {
    borderColor: COLORS.danger,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    shadowColor: COLORS.danger,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  footer: { padding: SPACING.lg, backgroundColor: COLORS.card },
  footerInner: { marginTop: SPACING.xl, paddingBottom: SPACING.xl },
  submitBtn: { 
    backgroundColor: COLORS.danger, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: SPACING.lg, 
    borderRadius: RADIUS.md,
    gap: SPACING.sm,
    shadowColor: COLORS.danger,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  submitBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold', letterSpacing: 0.5 },
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

export default ReportIssueScreen;
