import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import client from '../api/client';
import { savePendingSync } from '../store/offlineStore';

export const useTracking = (user, tripActive) => {
  const [errorMsg, setErrorMsg] = useState(null);
  const [status, setStatus] = useState('stopped');
  const intervalRef = useRef(15000); // Start with 15s

  const [currentGeofence, setCurrentGeofence] = useState(null);

  useEffect(() => {
    let locationSubscription = null;

    const startTracking = async () => {
      let { status: permStatus } = await Location.requestForegroundPermissionsAsync();
      if (permStatus !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      // Fetch collection places for geofencing (res.partner)
      let offices = [];
      try {
        const offRes = await client.get(`${user.baseUrl}/api/collection_places`);
        if (offRes.data.status === 'success') {
          offices = offRes.data.data;
        }
      } catch (e) {}

      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: intervalRef.current,
          distanceInterval: 10,
        },
        async (location) => {
          if (user && user.rider_id && tripActive) {
            const { latitude, longitude } = location.coords;
            
            // Check Geofences
            let detectedOffice = null;
            for (let office of offices) {
              const R = 6371e3;
              const phi1 = latitude * Math.PI / 180;
              const phi2 = office.lat * Math.PI / 180;
              const dphi = (office.lat - latitude) * Math.PI / 180;
              const dlambda = (office.lng - longitude) * Math.PI / 180;
              const a = Math.sin(dphi / 2) * Math.sin(dphi / 2) +
                        Math.cos(phi1) * Math.cos(phi2) *
                        Math.sin(dlambda / 2) * Math.sin(dlambda / 2);
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
              const dist = R * c;

              if (dist <= (office.radius || 100)) {
                detectedOffice = office;
                break;
              }
            }
            setCurrentGeofence(detectedOffice);

            const payload = {
              rider_id: user.rider_id,
              latitude: latitude,
              longitude: longitude,
              timestamp: new Date().toISOString()
            };
            
            try {
              const response = await client.post(`${user.baseUrl}/api/location_update`, {
                params: payload
              });

              if (response.data.result) {
                const newStatus = response.data.result.status;
                setStatus(newStatus);
                
                const newInterval = newStatus === 'moving' ? 10000 : 30000;
                
                if (newInterval !== intervalRef.current) {
                  intervalRef.current = newInterval;
                  locationSubscription.remove();
                  startTracking();
                }
              }
            } catch (e) {
              await savePendingSync('location', payload);
            }
          }
        }
      );
    };

    if (tripActive) {
      startTracking();
    }

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [user, tripActive]);

  return { errorMsg, status, currentGeofence };
};
