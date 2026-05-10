import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '../api/client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStorageData();
  }, []);

  async function loadStorageData() {
    try {
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        setUser(JSON.parse(userStr));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const login = async (db, login, password, baseUrl) => {
    try {
      // Odoo JSON-RPC style
      const response = await client.post(`${baseUrl}/api/login`, {
        params: { db, login, password }
      });

      const result = response.data.result;
      if (result && result.status === 'success') {
        const userData = {
          uid: result.uid,
          rider_id: result.rider_id,
          rider_name: result.rider_name,
          email: result.email,
          phone: result.phone,
          active_trip_id: result.active_trip_id,
          baseUrl: baseUrl,
        };
        await AsyncStorage.setItem('user', JSON.stringify(userData));
        await AsyncStorage.setItem('session_id', result.session_id);
        setUser(userData);
        return { success: true };
      } else {
        return { success: false, message: result?.message || 'Login failed' };
      }
    } catch (e) {
      console.error('Login Error:', e);
      const errorMessage = e.response?.data?.error?.data?.message ||
        e.response?.data?.result?.message ||
        e.message;
      return { success: false, message: errorMessage };
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('session_id');
    setUser(null);
  };

  const updateUser = async (data) => {
    const updatedUser = { ...user, ...data };
    await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export default AuthContext;
