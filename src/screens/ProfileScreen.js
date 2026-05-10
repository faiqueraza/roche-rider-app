import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image, ScrollView, StatusBar, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { COLORS, SPACING, RADIUS } from '../theme/theme';
import { User, Mail, Truck, LogOut, ArrowLeft, ShieldCheck, Phone, ChevronRight, Activity, MapPin, Calendar } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const ProfileScreen = ({ navigation }) => {
  const { user, logout } = useAuth();

  const ProfileItem = ({ icon: Icon, label, value, color = COLORS.primary }) => (
    <View style={styles.itemContainer}>
      <View style={[styles.iconBg, { backgroundColor: `${color}15` }]}>
        <Icon color={color} size={20} />
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.itemLabel}>{label}</Text>
        <Text style={styles.itemValue}>{value || 'Not available'}</Text>
      </View>
      <ChevronRight color={COLORS.textMuted} size={18} />
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Background Gradient Header */}
      <LinearGradient
        colors={[COLORS.primary, '#312e81']}
        style={styles.headerGradient}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
              <ArrowLeft color="#fff" size={24} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Rider Profile</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.profileSection}>
            <View style={styles.avatarWrapper}>
              <View style={styles.avatarContainer}>
                <User color={COLORS.primary} size={50} />
              </View>
              <View style={styles.verifiedBadge}>
                <ShieldCheck color="#fff" size={12} />
              </View>
            </View>
            <Text style={styles.riderName}>{user?.rider_name || 'Rider'}</Text>
            <View style={styles.roleTag}>
              <Activity color="#fff" size={12} />
              <Text style={styles.roleText}>Active Field Agent</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.mainScroll}
      >


        <View style={styles.card}>
          <Text style={styles.cardTitle}>Personal Information</Text>
          <ProfileItem icon={Mail} label="Email Address" value={user?.email} color="#3b82f6" />
          <ProfileItem icon={Phone} label="Phone Number" value={user?.phone} color="#10b981" />
          <ProfileItem icon={User} label="Account ID" value={user?.uid ? `ID-${user.uid}` : null} color="#8b5cf6" />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Work Info</Text>
          <ProfileItem icon={Truck} label="Vehicle Status" value="Company Motorcycle" color="#f59e0b" />
          <ProfileItem icon={MapPin} label="Base Hub" value="Roche Main Center" color="#ef4444" />
          <ProfileItem icon={Calendar} label="Join Date" value="Jan 2024" color={COLORS.primary} />
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <LinearGradient
            colors={['#fee2e2', '#fecaca']}
            style={styles.logoutGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <LogOut color={COLORS.danger} size={20} />
            <Text style={styles.logoutText}>Sign Out Account</Text>
          </LinearGradient>
        </TouchableOpacity>

        <Text style={styles.version}>Sample Tracking System • v1.2.4</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  headerGradient: {
    height: 340,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    paddingHorizontal: SPACING.lg,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileSection: {
    alignItems: 'center',
    marginTop: SPACING.xl,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: SPACING.md,
  },
  avatarContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 10,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: '#10b981',
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 3,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  riderName: {
    fontSize: 26,
    fontWeight: '900',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: SPACING.sm,
    gap: 6,
  },
  roleText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  mainScroll: {
    flex: 1,
    marginTop: 10,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: SPACING.lg,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: '70%',
    backgroundColor: '#f1f5f9',
    alignSelf: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SPACING.md,
    letterSpacing: 0.3,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  iconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  itemContent: {
    flex: 1,
  },
  itemLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  itemValue: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '700',
    marginTop: 1,
  },
  logoutBtn: {
    marginTop: SPACING.md,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  logoutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  logoutText: {
    color: COLORS.danger,
    fontSize: 16,
    fontWeight: '800',
  },
  version: {
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: SPACING.xl,
    fontWeight: '500',
  }
});

export default ProfileScreen;
