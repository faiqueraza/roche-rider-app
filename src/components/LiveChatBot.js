import React, { useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity,
  Modal, SafeAreaView, Text,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { MessageCircle, X, ChevronDown } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../theme/theme';

const LiveChatBot = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  if (!user) return null;

  return (
    <>
      {/* Blue FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setIsOpen(true)}
        activeOpacity={0.85}
      >
        <MessageCircle color="#fff" size={26} />
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsOpen(false)}
      >
        <SafeAreaView style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.dot} />
              <Text style={styles.headerTitle}>Live Support</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setIsOpen(false)}>
              <X color="#444" size={20} />
            </TouchableOpacity>
          </View>

          {/* Instruction banner */}
          <View style={styles.banner}>
            <ChevronDown color={COLORS.primary} size={16} />
            <Text style={styles.bannerText}>
              Tap the purple chat button at the bottom-right to start chatting
            </Text>
          </View>

          {/* Clean Odoo live chat page — no injection */}
          <WebView
            source={{ uri: 'https://sample-transfer-app.odoo.com/im_livechat/support/1' }}
            style={{ flex: 1 }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 9999,
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22c55e',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  closeBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#dbeafe',
  },
  bannerText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '500',
    flex: 1,
  },
});

export default LiveChatBot;
