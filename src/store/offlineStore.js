import AsyncStorage from '@react-native-async-storage/async-storage';

const OFFLINE_KEY = '@pending_syncs';

export const savePendingSync = async (type, data) => {
  try {
    const existing = await AsyncStorage.getItem(OFFLINE_KEY);
    const syncs = existing ? JSON.parse(existing) : [];
    syncs.push({ type, data, timestamp: new Date().toISOString() });
    await AsyncStorage.setItem(OFFLINE_KEY, JSON.stringify(syncs));
  } catch (e) {
    console.error('Failed to save offline data:', e);
  }
};

export const getPendingSyncs = async () => {
  try {
    const existing = await AsyncStorage.getItem(OFFLINE_KEY);
    return existing ? JSON.parse(existing) : [];
  } catch (e) {
    return [];
  }
};

export const clearSyncs = async () => {
  await AsyncStorage.removeItem(OFFLINE_KEY);
};
