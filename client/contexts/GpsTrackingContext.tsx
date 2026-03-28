import React, { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from "react";
import { Platform, AppState, AppStateStatus } from "react-native";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { useAuth } from "./AuthContext";
import { getApiUrl, getAuthToken } from "@/lib/query-client";
import {
  startBackgroundTracking,
  stopBackgroundTracking,
} from "@/services/BackgroundLocationService";

const GPS_BUFFER_KEY = "@soccorso_digitale_gps_buffer";
const GPS_SESSION_KEY = "@soccorso_digitale_gps_session";

interface GpsPoint {
  latitude: string;
  longitude: string;
  accuracy?: number;
  speed?: number;
  heading?: number;
  altitude?: number;
  timestamp: number;
}

interface GpsTrackingContextType {
  isTracking: boolean;
  pointsCount: number;
  lastLocation: Location.LocationObject | null;
  error: string | null;
  permission: Location.PermissionResponse | null;
  requestPermission: () => Promise<Location.PermissionResponse>;
  startTracking: () => Promise<boolean>;
  stopTracking: () => Promise<void>;
  syncBuffer: () => Promise<void>;
}

const GpsTrackingContext = createContext<GpsTrackingContextType | undefined>(undefined);

const DEFAULT_TIME_INTERVAL = 3000;
const DEFAULT_DISTANCE_INTERVAL = 5;
const BATCH_SIZE = 10;          // P1-1: batch 10 punti per request (era 1)
const MAX_BUFFER_SIZE = 500;
const SYNC_INTERVAL = 15000;    // P1-1: sync ogni 15s (era 5s — compromesso latency/battery)
const MAX_ACCURACY_METERS = 50; // P0-3: ignora punti con accuracy > 50m

// Sanity check coordinate Italia
const ITALY_LAT_MIN = 35, ITALY_LAT_MAX = 48;
const ITALY_LNG_MIN = 6,  ITALY_LNG_MAX = 19;

export function GpsTrackingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const selectedVehicle = user?.vehicle || null;
  
  const [isTracking, setIsTracking] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [hasAttemptedAutoStart, setHasAttemptedAutoStart] = useState(false);
  const [pointsCount, setPointsCount] = useState(0);
  const [lastLocation, setLastLocation] = useState<Location.LocationObject | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permission, requestPermission] = Location.useForegroundPermissions();
  
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const gpsBuffer = useRef<GpsPoint[]>([]);
  const syncTimeout = useRef<ReturnType<typeof setInterval> | null>(null);
  const appState = useRef(AppState.currentState);
  const sessionIdRef = useRef<string | null>(null);
  const lastVehicleIdRef = useRef<string | null>(null);
  const backgroundTrackingActive = useRef(false);
  const isSyncing = useRef(false); // guard contro sync concorrenti

  useEffect(() => {
    loadBuffer();
    
    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => {
      subscription.remove();
      cleanupTracking();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }
    
    if (selectedVehicle?.id !== lastVehicleIdRef.current) {
      lastVehicleIdRef.current = selectedVehicle?.id || null;
      setHasAttemptedAutoStart(false);
      loadSession();
    }
    
    if (user && selectedVehicle) {
      if (!isTracking && !isStarting && !hasAttemptedAutoStart) {
        setHasAttemptedAutoStart(true);
        startTracking();
      }
    } else if (!user || !selectedVehicle) {
      if (isTracking) {
        stopTracking();
      }
      setHasAttemptedAutoStart(false);
    }
  }, [user?.id, selectedVehicle?.id, isTracking, isStarting, hasAttemptedAutoStart]);

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (appState.current.match(/inactive|background/) && nextAppState === "active") {
      if (isTracking) {
        await syncBuffer();
      }
    }
    appState.current = nextAppState;
  };

  const loadBuffer = async () => {
    try {
      const stored = await AsyncStorage.getItem(GPS_BUFFER_KEY);
      if (stored) {
        gpsBuffer.current = JSON.parse(stored);
        setPointsCount(gpsBuffer.current.length);
      }
    } catch (e) {
      console.error("Error loading GPS buffer:", e);
    }
  };

  const loadSession = async () => {
    try {
      const stored = await AsyncStorage.getItem(GPS_SESSION_KEY);
      if (stored) {
        const session = JSON.parse(stored);
        if (session.vehicleId === selectedVehicle?.id && session.isTracking) {
          sessionIdRef.current = session.sessionId;
        } else {
          await AsyncStorage.removeItem(GPS_SESSION_KEY);
        }
      }
    } catch (e) {
      console.error("Error loading GPS session:", e);
    }
  };

  const saveBuffer = async () => {
    try {
      await AsyncStorage.setItem(GPS_BUFFER_KEY, JSON.stringify(gpsBuffer.current));
    } catch (e) {
      console.error("Error saving GPS buffer:", e);
    }
  };

  const saveSession = async (tracking: boolean, sessionId: string | null) => {
    try {
      await AsyncStorage.setItem(GPS_SESSION_KEY, JSON.stringify({
        isTracking: tracking,
        sessionId,
        vehicleId: selectedVehicle?.id,
      }));
    } catch (e) {
      console.error("Error saving GPS session:", e);
    }
  };

  const clearBuffer = async () => {
    gpsBuffer.current = [];
    setPointsCount(0);
    try {
      await AsyncStorage.removeItem(GPS_BUFFER_KEY);
    } catch (e) {
      console.error("Error clearing GPS buffer:", e);
    }
  };

  const startTracking = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === "web") {
      setError("GPS non disponibile su web");
      return false;
    }

    if (!selectedVehicle || isStarting || isTracking) {
      return false;
    }

    setIsStarting(true);
    setError(null);

    try {
      if (!permission?.granted) {
        const result = await requestPermission();
        if (!result.granted) {
          setError("Permesso GPS negato");
          setIsStarting(false);
          return false;
        }
      }

      const authToken = await getAuthToken();

      const response = await fetch(new URL("/api/gps/tracking/start", getApiUrl()).toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { "Authorization": `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          vehicleId: selectedVehicle.id
        })
      });

      if (!response.ok) {
        console.log("GPS tracking start response not OK, continuing anyway");
      }

      const data = await response.json().catch(() => ({}));
      sessionIdRef.current = data.session?.id || `local_${Date.now()}`;

      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: DEFAULT_DISTANCE_INTERVAL,
          timeInterval: DEFAULT_TIME_INTERVAL
        },
        handleLocationUpdate
      );

      setIsTracking(true);
      setIsStarting(false);
      await saveSession(true, sessionIdRef.current);
      scheduleSyncBuffer();

      // P0-1: avvia background tracking (fallback silenzioso se permesso negato)
      if ((Platform.OS as string) !== "web") {
        const apiUrl = getApiUrl().toString().replace(/\/$/, "");
        const token = await getAuthToken();
        backgroundTrackingActive.current = await startBackgroundTracking(
          selectedVehicle.id,
          apiUrl,
          token || ""
        );
        console.log(
          "[GPS] Background tracking:",
          backgroundTrackingActive.current ? "ACTIVE" : "foreground-only"
        );
      }

      console.log("[GPS] Tracking started for vehicle:", selectedVehicle.code);
      return true;
    } catch (e) {
      console.error("Error starting GPS tracking:", e);
      setError(e instanceof Error ? e.message : "Errore GPS");
      setIsStarting(false);
      return false;
    }
  }, [selectedVehicle, permission, requestPermission, isStarting, isTracking]);

  const handleLocationUpdate = useCallback((location: Location.LocationObject) => {
    // P0-3: scarta punti con accuracy > 50m o coordinate fuori Italia
    const { latitude, longitude, accuracy } = location.coords;
    if (accuracy !== null && accuracy > MAX_ACCURACY_METERS) return;
    if (
      latitude < ITALY_LAT_MIN || latitude > ITALY_LAT_MAX ||
      longitude < ITALY_LNG_MIN || longitude > ITALY_LNG_MAX
    ) return;

    setLastLocation(location);

    const point: GpsPoint = {
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      accuracy: accuracy ?? undefined,
      speed: location.coords.speed ? Math.max(0, location.coords.speed * 3.6) : undefined,
      heading: location.coords.heading ?? undefined,
      altitude: location.coords.altitude ?? undefined,
      timestamp: location.timestamp
    };

    gpsBuffer.current.push(point);

    if (gpsBuffer.current.length > MAX_BUFFER_SIZE) {
      gpsBuffer.current = gpsBuffer.current.slice(-MAX_BUFFER_SIZE);
    }

    setPointsCount(prev => prev + 1);
    saveBuffer();

    if (gpsBuffer.current.length >= BATCH_SIZE) {
      syncBuffer();
    }
  }, []);

  const syncBuffer = useCallback(async () => {
    if (gpsBuffer.current.length === 0 || !selectedVehicle) {
      return;
    }

    // Guard: evita sync concorrenti (race condition → punti duplicati)
    if (isSyncing.current) {
      return;
    }
    isSyncing.current = true;

    // Check network connectivity before attempting sync
    try {
      const netState = await NetInfo.fetch();
      if (!netState.isConnected || !netState.isInternetReachable) {
        // Silently skip sync when offline - points are safely buffered locally
        console.log(`[GPS] Offline - ${gpsBuffer.current.length} points buffered locally`);
        isSyncing.current = false;
        return;
      }
    } catch (netError) {
      // If we can't check network, try sync anyway
      console.log("[GPS] Could not check network state, attempting sync");
    }

    const authToken = await getAuthToken();
    const pointsToSync = [...gpsBuffer.current];
    
    try {
      const response = await fetch(new URL("/api/gps/points", getApiUrl()).toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { "Authorization": `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          vehicleId: selectedVehicle.id,
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
        console.log(`[GPS] Synced ${pointsToSync.length} points`);
      }
    } catch (e) {
      // Network error - silently buffer points, will sync when back online
      console.log(`[GPS] Sync failed, ${gpsBuffer.current.length} points buffered locally`);
    } finally {
      isSyncing.current = false;
    }
  }, [selectedVehicle]);

  const scheduleSyncBuffer = () => {
    if (syncTimeout.current) {
      clearInterval(syncTimeout.current);
    }
    syncTimeout.current = setInterval(() => {
      syncBuffer();
    }, SYNC_INTERVAL);
  };

  const cleanupTracking = async () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    if (syncTimeout.current) {
      clearInterval(syncTimeout.current);
      syncTimeout.current = null;
    }
  };

  const stopTracking = useCallback(async () => {
    // P0-1: ferma background tracking
    if (backgroundTrackingActive.current) {
      await stopBackgroundTracking();
      backgroundTrackingActive.current = false;
    }
    await cleanupTracking();
    await syncBuffer();

    const authToken = await getAuthToken();
    if (selectedVehicle) {
      try {
        await fetch(new URL("/api/gps/tracking/end", getApiUrl()).toString(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(authToken ? { "Authorization": `Bearer ${authToken}` } : {})
          },
          body: JSON.stringify({
            vehicleId: selectedVehicle.id
          })
        });
      } catch (e) {
        console.error("Error ending GPS tracking:", e);
      }
    }

    setIsTracking(false);
    sessionIdRef.current = null;
    await saveSession(false, null);
    await clearBuffer();
    
    console.log("[GPS] Tracking stopped");
  }, [selectedVehicle, syncBuffer]);

  return (
    <GpsTrackingContext.Provider
      value={{
        isTracking,
        pointsCount,
        lastLocation,
        error,
        permission,
        requestPermission,
        startTracking,
        stopTracking,
        syncBuffer,
      }}
    >
      {children}
    </GpsTrackingContext.Provider>
  );
}

export function useGpsTrackingContext() {
  const context = useContext(GpsTrackingContext);
  if (context === undefined) {
    throw new Error("useGpsTrackingContext must be used within a GpsTrackingProvider");
  }
  return context;
}
