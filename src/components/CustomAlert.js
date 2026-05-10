import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, Animated, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { COLORS, RADIUS, SPACING } from '../theme/theme';
import { AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react-native';

const { width } = Dimensions.get('window');

const CustomAlert = ({ visible, title, message, type = 'info', buttons = [], onClose }) => {
  const scaleValue = useRef(new Animated.Value(0)).current;
  const opacityValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    console.log('CustomAlert visible:', visible, 'title:', title);
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleValue, {
          toValue: 1,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }),
        Animated.timing(opacityValue, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleValue, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityValue, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);


  const getIcon = () => {
    switch (type) {
      case 'success': return <CheckCircle color={COLORS.secondary} size={48} />;
      case 'error': return <XCircle color={COLORS.danger} size={48} />;
      case 'warning': return <AlertCircle color={COLORS.warning} size={48} />;
      default: return <Info color={COLORS.primary} size={48} />;
    }
  };

  return (
    <Modal transparent visible={visible} animationType="none">
      <BlurView intensity={30} tint="dark" style={styles.overlay}>
        <Animated.View 
          style={[
            styles.container, 
            { 
              opacity: opacityValue,
              transform: [{ scale: scaleValue }]
            }
          ]}
        >
          <View style={styles.iconContainer}>
            {getIcon()}
          </View>
          
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          
          <View style={styles.buttonContainer}>
            {buttons.length > 0 ? (
              buttons.map((btn, index) => (
                <TouchableOpacity 
                  key={index} 
                  style={[
                    styles.button, 
                    btn.type === 'cancel' ? styles.cancelButton : styles.confirmButton,
                    buttons.length > 2 && { width: '100%', marginBottom: SPACING.sm }
                  ]} 
                  onPress={() => {
                    onClose();
                    if (btn.onPress) btn.onPress();
                  }}
                >
                  <Text style={[
                    styles.buttonText, 
                    btn.type === 'cancel' && styles.cancelButtonText
                  ]}>
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              ))
            ) : (
              <TouchableOpacity style={[styles.button, styles.confirmButton]} onPress={onClose}>
                <Text style={styles.buttonText}>OK</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // Dimmed dark overlay behind blur
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  container: {
    backgroundColor: COLORS.glass,
    borderRadius: RADIUS.lg + 8, // Very rounded for modern iOS feel
    padding: SPACING.xl,
    width: width * 0.85,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)', // Subtle white edge
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    marginBottom: SPACING.lg,
    padding: SPACING.md,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  title: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: SPACING.sm,
    letterSpacing: 0.5,
  },
  message: {
    color: COLORS.textMuted,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: SPACING.xl,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.md,
    width: '100%',
    marginTop: SPACING.md,
  },
  button: {
    height: 52,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  confirmButton: {
    backgroundColor: COLORS.primary,
    flex: 1,
  },
  cancelButton: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flex: 1,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  cancelButtonText: {
    color: COLORS.textMuted,
    fontSize: 15,
    fontWeight: 'bold',
  },
});

export default CustomAlert;
