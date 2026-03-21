import React, { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from "react";
import { Platform, AppState, AppStateStatus } from "react-native";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { useAuth } from "./AuthContext";
import { getApiUrl, getAuthToken } from "@/lib/query-client";

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
const BATCH_SIZE = 1;
const MAX_BUFFER_SIZE = 500;
const SYNC_INTERVAL = 5000;

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
  const syncTimeout = useRef<NodeJS.Timeout | null>(null);
  const appState = useRef(AppState.currentState);
  const sessionIdRef = useRef<string | null>(null);
  const lastVehicleIdRef = useRef<string | null>(null);

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

    // Check network connectivity before attempting sync
    try {
      const netState = await NetInfo.fetch();
      if (!netState.isConnected || !netState.isInternetReachable) {
        // Silently skip sync when offline - points are safely buffered locally
        console.log(`[GPS] Offline - ${gpsBuffer.current.length} points buffered locally`);
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
