import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { COLORS, SPACING, RADIUS } from '../theme/theme';
import { LogIn } from 'lucide-react-native';
import { CONFIG } from '../config/config';
import Logo from '../components/Logo';

const LoginScreen = () => {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  
  // Focus states for premium glow effect
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  const { login: performLogin } = useAuth();

  const handleLogin = async () => {
    if (!login.trim() || !password.trim()) {
      setError('Please enter both email and password');
      return;
    }
    setError('');
    setLoading(true);
    // Use hardcoded config values
    const result = await performLogin(CONFIG.ODOO_DB_NAME, login, password, CONFIG.ODOO_BASE_URL);
    setLoading(false);
    if (!result.success) {
      setError(result.message);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
      enabled={true}
    >
      <LinearGradient colors={[COLORS.background, COLORS.card]} style={styles.gradient}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Logo size={100} />
            </View>
            <Text style={styles.subtitle}>PK HCV Elimination Program</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Email / Login</Text>
            <TextInput
              style={[styles.input, isEmailFocused && styles.inputFocused]}
              value={login}
              onChangeText={setLogin}
              placeholder="rider@example.com"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              onFocus={() => setIsEmailFocused(true)}
              onBlur={() => setIsEmailFocused(false)}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={[styles.input, isPasswordFocused && styles.inputFocused]}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={COLORS.textMuted}
              secureTextEntry
              onFocus={() => setIsPasswordFocused(true)}
              onBlur={() => setIsPasswordFocused(false)}
            />

            <TouchableOpacity 
              style={styles.rememberRow} 
              onPress={() => setRememberMe(!rememberMe)}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                {rememberMe && <Text style={styles.checkIcon}>✓</Text>}
              </View>
              <Text style={styles.rememberText}>Remember Me</Text>
            </TouchableOpacity>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: SPACING.lg, justifyContent: 'flex-start', paddingTop: 60 },
  header: { alignItems: 'center', marginBottom: SPACING.xl * 2 },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.lg,
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  title: { fontSize: 36, fontWeight: '900', color: COLORS.text, letterSpacing: 1 },
  subtitle: { fontSize: 16, color: COLORS.primary, fontWeight: '600', marginTop: SPACING.xs },
  form: { width: '100%' },
  label: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700', marginBottom: SPACING.xs, marginLeft: SPACING.xs, textTransform: 'uppercase', letterSpacing: 1 },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    color: COLORS.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: SPACING.lg,
  },
  inputFocused: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.md,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
  errorText: { color: COLORS.danger, marginBottom: SPACING.md, textAlign: 'center' },
  rememberRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.lg, marginLeft: SPACING.xs },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: COLORS.primary, marginRight: SPACING.sm, justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: COLORS.primary },
  checkIcon: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  rememberText: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
});

export default LoginScreen;
