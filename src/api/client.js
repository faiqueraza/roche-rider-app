import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const client = axios.create({
  timeout: 30000, // 30 seconds timeout for mobile stability
  headers: {
    'Content-Type': 'application/json',
  },
});

client.interceptors.request.use(async (config) => {
  const sid = await AsyncStorage.getItem('session_id');
  if (sid) {
    // In Odoo, session_id is often passed as a cookie or in the body
    if (config.data && typeof config.data === 'object') {
      config.data.params = { ...config.data.params, sid };
    }
  }
  return config;
});

export default client;
