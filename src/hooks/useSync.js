import { useEffect } from 'react';
import { getPendingSyncs, clearSyncs } from '../store/offlineStore';
import client from '../api/client';

export const useSync = (user) => {
  useEffect(() => {
    if (!user) return;

    const syncData = async () => {
      const pending = await getPendingSyncs();
      if (pending.length === 0) return;

      console.log(`Syncing ${pending.length} items...`);
      const remaining = [];

      for (const item of pending) {
        try {
          let endpoint = '';
          if (item.type === 'pickup') endpoint = '/api/create_pickup';
          if (item.type === 'scan') endpoint = '/api/scan_tube';
          if (item.type === 'delivery') endpoint = '/api/confirm_delivery';
          if (item.type === 'location') endpoint = '/api/location_update';
          if (item.type === 'issue') endpoint = '/api/report_issue';
          if (item.type === 'handover') endpoint = '/api/request_handover';
          if (item.type === 'start_trip') endpoint = '/api/start_trip';
          if (item.type === 'end_trip') endpoint = '/api/end_trip';
          if (item.type === 'third_party_dispatch') endpoint = '/api/dispatch_third_party';

          const response = await client.post(`${user.baseUrl}${endpoint}`, {
            params: item.data
          });

          if (response.data.result?.status !== 'success') {
            remaining.push(item);
          }
        } catch (e) {
          remaining.push(item);
        }
      }

      if (remaining.length < pending.length) {
        const OFFLINE_KEY = '@pending_syncs';
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        if (remaining.length === 0) {
          await AsyncStorage.removeItem(OFFLINE_KEY);
        } else {
          await AsyncStorage.setItem(OFFLINE_KEY, JSON.stringify(remaining));
        }
        console.log(`Sync update: ${pending.length - remaining.length} items synced.`);
      }
    };

    const interval = setInterval(syncData, 60000); // Check every minute
    syncData(); // Initial check

    return () => clearInterval(interval);
  }, [user]);
};
