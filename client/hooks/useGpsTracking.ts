import { useState, useEffect, useRef, useCallback } from "react";
import { Platform, AppState, AppStateStatus } from "react-native";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiRequest, getApiUrl } from "@/lib/query-client";

const GPS_BUFFER_KEY = "@soccorso_digitale_gps_buffer";
const TRACKING_STATE_KEY = "@soccorso_digitale_tracking_state";

interface GpsPoint {
  latitude: string;
  longitude: string;
  accuracy?: number;
  speed?: number;
  heading?: number;
  altitude?: number;
  timestamp: number;
}

interface TrackingState {
  isTracking: boolean;
  vehicleId: string | null;
  tripId: string | null;
  sessionId: string | null;
  startedAt: number | null;
  pointsCount: number;
}

interface GpsTrackingOptions {
  vehicleId: string;
  tripId?: string;
  token: string;
  distanceInterval?: number;
  timeInterval?: number;
}

const DEFAULT_DISTANCE_INTERVAL = 5;
const DEFAULT_TIME_INTERVAL = 3000;
const BATCH_SIZE = 1;
const MAX_BUFFER_SIZE = 500;

export function useGpsTracking() {
  const [trackingState, setTrackingState] = useState<TrackingState>({
    isTracking: false,
    vehicleId: null,
    tripId: null,
    sessionId: null,
    startedAt: null,
    pointsCount: 0
  });
  const [lastLocation, setLastLocation] = useState<Location.LocationObject | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permission, requestPermission] = Location.useForegroundPermissions();
  
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const gpsBuffer = useRef<GpsPoint[]>([]);
  const syncTimeout = useRef<ReturnType<typeof setInterval> | null>(null);
  const tokenRef = useRef<string | null>(null);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    loadTrackingState();
    loadBuffer();

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => {
      subscription.remove();
      stopTracking();
    };
  }, []);

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (appState.current.match(/inactive|background/) && nextAppState === "active") {
      if (trackingState.isTracking) {
        await syncBuffer();
      }
    }
    appState.current = nextAppState;
  };

  const loadTrackingState = async () => {
    try {
      const stored = await AsyncStorage.getItem(TRACKING_STATE_KEY);
      if (stored) {
        const state = JSON.parse(stored) as TrackingState;
        setTrackingState(state);
      }
    } catch (e) {
      console.error("Error loading tracking state:", e);
    }
  };

  const saveTrackingState = async (state: TrackingState) => {
    try {
      await AsyncStorage.setItem(TRACKING_STATE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Error saving tracking state:", e);
    }
  };

  const loadBuffer = async () => {
    try {
      const stored = await AsyncStorage.getItem(GPS_BUFFER_KEY);
      if (stored) {
        gpsBuffer.current = JSON.parse(stored);
      }
    } catch (e) {
      console.error("Error loading GPS buffer:", e);
    }
  };

  const saveBuffer = async () => {
    try {
      await AsyncStorage.setItem(GPS_BUFFER_KEY, JSON.stringify(gpsBuffer.current));
    } catch (e) {
      console.error("Error saving GPS buffer:", e);
    }
  };

  const clearBuffer = async () => {
    try {
      gpsBuffer.current = [];
      await AsyncStorage.removeItem(GPS_BUFFER_KEY);
    } catch (e) {
      console.error("Error clearing GPS buffer:", e);
    }
  };

  const startTracking = useCallback(async (options: GpsTrackingOptions) => {
    if (Platform.OS === "web") {
      setError("GPS tracking non disponibile su web. Usa l'app Expo Go.");
      return false;
    }

    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        setError("Permesso GPS negato");
        return false;
      }
    }

    tokenRef.current = options.token;
    setError(null);

    try {
      const response = await fetch(new URL("/api/gps/tracking/start", getApiUrl()).toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${options.token}`
        },
        body: JSON.stringify({
          vehicleId: options.vehicleId,
          tripId: options.tripId
        })
      });

      if (!response.ok) {
        throw new Error("Errore nell'avvio del tracking");
      }

      const data = await response.json();

      const newState: TrackingState = {
        isTracking: true,
        vehicleId: options.vehicleId,
        tripId: options.tripId || null,
        sessionId: data.session?.id || null,
        startedAt: Date.now(),
        pointsCount: 0
      };
      setTrackingState(newState);
      await saveTrackingState(newState);

      const distanceInterval = options.distanceInterval || DEFAULT_DISTANCE_INTERVAL;
      const timeInterval = options.timeInterval || DEFAULT_TIME_INTERVAL;

      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval,
          timeInterval
        },
        (location) => {
          handleLocationUpdate(location, options.vehicleId, options.tripId);
        }
      );

      scheduleSyncBuffer();
      return true;
    } catch (e) {
      console.error("Error starting tracking:", e);
      setError(e instanceof Error ? e.message : "Errore sconosciuto");
      return false;
    }
  }, [permission, requestPermission]);

  const handleLocationUpdate = useCallback((
    location: Location.LocationObject,
    vehicleId: string,
    tripId?: string
  ) => {
    setLastLocation(location);

    const point: GpsPoint = {
      latitude: location.coords.latitude.toString(),
      longitude: location.coords.longitude.toString(),
      accuracy: location.coords.accuracy ?? undefined,
      speed: location.coords.speed ? Math.max(0, location.coords.speed * 3.6) : undefined,
      heading: location.coords.heading ?? undefined,
      altitude: location.coords.altitude ?? undefined,
      timestamp: location.timestamp
    };

    gpsBuffer.current.push(point);

    if (gpsBuffer.current.length > MAX_BUFFER_SIZE) {
      gpsBuffer.current = gpsBuffer.current.slice(-MAX_BUFFER_SIZE);
    }

    setTrackingState(prev => ({
      ...prev,
      pointsCount: prev.pointsCount + 1
    }));

    saveBuffer();

    if (gpsBuffer.current.length >= BATCH_SIZE) {
      syncBuffer();
    }
  }, []);

  const syncBuffer = async () => {
    if (gpsBuffer.current.length === 0 || !trackingState.vehicleId) {
      return;
    }

    const pointsToSync = [...gpsBuffer.current];
    
    try {
      const response = await fetch(new URL("/api/gps/points", getApiUrl()).toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${tokenRef.current}`
        },
        body: JSON.stringify({
          vehicleId: trackingState.vehicleId,
          tripId: trackingState.tripId,
          points: pointsToSync.map(p => ({
            ...p,
            timestamp: new Date(p.timestamp).toISOString()
          })),
          latitude: pointsToSync[pointsToSync.length - 1].latitude,
          longitude: pointsToSync[pointsToSync.length - 1].longitude
        })
      });

      if (response.ok) {
        gpsBuffer.current = gpsBuffer.current.slice(pointsToSync.length);
        await saveBuffer();
      }
    } catch (e) {
      console.error("Error syncing GPS buffer:", e);
    }
  };

  const scheduleSyncBuffer = () => {
    if (syncTimeout.current) {
      clearInterval(syncTimeout.current);
    }
    syncTimeout.current = setInterval(() => {
      syncBuffer();
    }, 30000);
  };

  const stopTracking = useCallback(async () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }

    if (syncTimeout.current) {
      clearInterval(syncTimeout.current);
      syncTimeout.current = null;
    }

    await syncBuffer();

    if (trackingState.vehicleId && tokenRef.current) {
      try {
        await fetch(new URL("/api/gps/tracking/end", getApiUrl()).toString(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${tokenRef.current}`
          },
          body: JSON.stringify({
            vehicleId: trackingState.vehicleId
          })
        });
      } catch (e) {
        console.error("Error ending tracking session:", e);
      }
    }

    const newState: TrackingState = {
      isTracking: false,
      vehicleId: null,
      tripId: null,
      sessionId: null,
      startedAt: null,
      pointsCount: 0
    };
    setTrackingState(newState);
    await saveTrackingState(newState);
    await clearBuffer();
  }, [trackingState]);

  const linkTrip = useCallback(async (tripId: string) => {
    if (!trackingState.isTracking || !trackingState.vehicleId) {
      return false;
    }

    try {
      await fetch(new URL("/api/gps/tracking/link-trip", getApiUrl()).toString(), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${tokenRef.current}`
        },
        body: JSON.stringify({
          vehicleId: trackingState.vehicleId,
          tripId
        })
      });

      setTrackingState(prev => ({ ...prev, tripId }));
      return true;
    } catch (e) {
      console.error("Error linking trip:", e);
      return false;
    }
  }, [trackingState]);

  const getTrackingStats = useCallback(() => {
    if (!trackingState.isTracking || !trackingState.startedAt) {
      return null;
    }

    const durationMs = Date.now() - trackingState.startedAt;
    const minutes = Math.floor(durationMs / 60000);
    const hours = Math.floor(minutes / 60);

    return {
      duration: hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`,
      pointsCount: trackingState.pointsCount,
      bufferSize: gpsBuffer.current.length,
      lastUpdate: lastLocation?.timestamp ? new Date(lastLocation.timestamp) : null
    };
  }, [trackingState, lastLocation]);

  return {
    trackingState,
    lastLocation,
    error,
    permission,
    requestPermission,
    startTracking,
    stopTracking,
    linkTrip,
    getTrackingStats,
    syncBuffer
  };
}
