import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/CustomAlertContext';
import { COLORS, SPACING, RADIUS } from '../theme/theme';
import { Send, ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react-native';
import client from '../api/client';

const IssueChatScreen = ({ navigation, route }) => {
  const { issueId, issueType, description } = route.params;
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef(null);

  const fetchMessages = async () => {
    try {
      const response = await client.post(`${user.baseUrl}/api/get_issue_updates`, {
        params: { issue_id: issueId }
      });
      if (response.data.result?.status === 'success') {
        setMessages(response.data.result.messages || []);
      }
    } catch (e) {
      console.error("Failed to fetch messages", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    setSending(true);
    try {
      const response = await client.post(`${user.baseUrl}/api/post_issue_message`, {
        params: { 
          issue_id: issueId,
          rider_id: user.rider_id,
          message: newMessage
        }
      }, { timeout: 15000 });
      
      if (response.data.result?.status === 'success') {
        setNewMessage('');
        fetchMessages();
      } else {
        const errorMsg = response.data.error?.data?.message || response.data.result?.message || 'Server rejected message';
        showAlert('Odoo Error', errorMsg, 'error');
      }
    } catch (e) {
      console.error(e);
      const msg = e.code === 'ECONNABORTED' ? 'Request timed out. Check your internet.' : 'Failed to send message. Please try again.';
      showAlert('Network Error', msg, 'error');
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }) => {
    const isMe = item.is_rider;
    const isSystem = item.is_system;
    
    if (isSystem) {
      return (
        <View style={styles.systemMessageContainer}>
          <Text style={styles.systemMessageText}>{item.body}</Text>
        </View>
      );
    }

    return (
      <View style={[styles.messageBubble, isMe ? styles.riderBubble : styles.adminBubble]}>
        <Text style={[styles.authorName, isMe ? styles.riderName : styles.adminName]}>
          {isMe ? 'YOU' : 'SUPERVISOR'}
        </Text>
        <Text style={[styles.messageText, isMe && { color: '#fff' }]}>{item.body}</Text>
        <Text style={[styles.timestamp, isMe && { color: 'rgba(255,255,255,0.6)' }]}>{item.time}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('Main', { screen: 'Collections' })} style={styles.backBtn}>
          <ArrowLeft color={COLORS.text} size={24} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
           <Text style={styles.headerTitle}>Emergency Support</Text>
           <Text style={styles.headerSubtitle}>{issueType.toUpperCase()}</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.statusBanner}>
        <AlertCircle color={COLORS.danger} size={16} />
        <Text style={styles.statusText}>Supervisor has been notified. Stay where you are.</Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item, index) => index.toString()}
        renderItem={renderMessage}
        contentContainerStyle={styles.chatContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={loading ? <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} /> : (
          <View style={styles.initialMessage}>
             <Text style={styles.initialText}>Initial Report:</Text>
             <Text style={styles.descriptionText}>{description}</Text>
          </View>
        )}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        enabled={true}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type a message..."
            placeholderTextColor={COLORS.textMuted}
            multiline
          />
          <TouchableOpacity 
            style={[styles.sendBtn, !newMessage.trim() && { opacity: 0.5 }]} 
            onPress={sendMessage}
            disabled={sending || !newMessage.trim()}
          >
            {sending ? <ActivityIndicator color="#fff" size="small" /> : <Send color="#fff" size={20} />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  headerInfo: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
  headerSubtitle: { fontSize: 10, color: COLORS.danger, fontWeight: '800', marginTop: 2 },
  backBtn: { padding: 4 },
  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fef2f2', padding: 10, borderBottomWidth: 1, borderBottomColor: '#fee2e2' },
  statusText: { fontSize: 12, color: COLORS.danger, fontWeight: '600' },
  chatContent: { padding: SPACING.md },
  messageBubble: { maxWidth: '80%', padding: 12, borderRadius: 16, marginBottom: 12 },
  riderBubble: { alignSelf: 'flex-end', backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  adminBubble: { alignSelf: 'flex-start', backgroundColor: '#fff', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#e2e8f0' },
  authorName: { fontSize: 10, fontWeight: '800', marginBottom: 4, textTransform: 'uppercase' },
  riderName: { color: 'rgba(255,255,255,0.7)' },
  adminName: { color: COLORS.primary },
  systemMessageContainer: { alignSelf: 'center', backgroundColor: '#e2e8f0', paddingVertical: 4, paddingHorizontal: 12, borderRadius: 12, marginVertical: 8 },
  systemMessageText: { fontSize: 10, color: COLORS.textMuted, fontWeight: '600' },
  messageText: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  timestamp: { fontSize: 9, color: COLORS.textMuted, marginTop: 4, alignSelf: 'flex-end' },
  initialMessage: { padding: 16, backgroundColor: '#fff', borderRadius: RADIUS.md, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 20 },
  initialText: { fontSize: 12, fontWeight: 'bold', color: COLORS.textMuted, marginBottom: 4 },
  descriptionText: { fontSize: 14, color: COLORS.text, fontStyle: 'italic' },
  inputContainer: { flexDirection: 'row', padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e2e8f0', alignItems: 'center', gap: 10 },
  input: { flex: 1, backgroundColor: '#f1f5f9', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, maxHeight: 100, color: COLORS.text },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' }
});

export default IssueChatScreen;
