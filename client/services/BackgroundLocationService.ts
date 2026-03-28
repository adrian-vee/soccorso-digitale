/**
 * BackgroundLocationService — P0-1
 * Tracking GPS che continua anche quando l'app è in background (chiamata, switch app, schermo bloccato).
 * Usa expo-task-manager + expo-location startLocationUpdatesAsync.
 *
 * HERMES — Mobile Engineer
 */

import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const BACKGROUND_LOCATION_TASK = "sd-background-location";

// AsyncStorage keys condivisi con GpsTrackingContext
const GPS_BUFFER_KEY = "@soccorso_digitale_gps_buffer";
const BG_VEHICLE_KEY = "@sd_bg_vehicle_id";
const BG_API_URL_KEY = "@sd_bg_api_url";
const BG_TOKEN_KEY = "@sd_bg_token";

// Filtro accuratezza: ignora punti con accuracy > 50m (P0-3)
const MAX_ACCURACY_METERS = 50;

// Limiti coordinate Italia (sanity check)
const ITALY_BOUNDS = { latMin: 35, latMax: 48, lngMin: 6, lngMax: 19 };

function isInsideItaly(lat: number, lng: number): boolean {
  return (
    lat >= ITALY_BOUNDS.latMin &&
    lat <= ITALY_BOUNDS.latMax &&
    lng >= ITALY_BOUNDS.lngMin &&
    lng <= ITALY_BOUNDS.lngMax
  );
}

// Definizione del task FUORI da qualsiasi componente React (requisito TaskManager)
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error("[GPS Background] Task error:", error.message);
    return;
  }

  if (!data) return;

  const { locations } = data as { locations: Location.LocationObject[] };

  // Filtra per accuratezza e coordinate valide (P0-3)
  const validLocations = locations.filter((loc) => {
    const { latitude, longitude, accuracy } = loc.coords;
    if (accuracy !== null && accuracy > MAX_ACCURACY_METERS) return false;
    if (!isInsideItaly(latitude, longitude)) return false;
    return true;
  });

  if (validLocations.length === 0) return;

  try {
    // Leggi vehicleId, apiUrl e token da AsyncStorage
    const [vehicleId, apiUrl, token] = await Promise.all([
      AsyncStorage.getItem(BG_VEHICLE_KEY),
      AsyncStorage.getItem(BG_API_URL_KEY),
      AsyncStorage.getItem(BG_TOKEN_KEY),
    ]);

    if (!vehicleId || !apiUrl) {
      // Accumula nel buffer locale — verrà svuotato al foreground
      await appendToBuffer(validLocations);
      return;
    }

    const points = validLocations.map((loc) => ({
      latitude: loc.coords.latitude.toString(),
      longitude: loc.coords.longitude.toString(),
      accuracy: loc.coords.accuracy ?? undefined,
      speed: loc.coords.speed != null ? Math.max(0, loc.coords.speed * 3.6) : undefined,
      heading: loc.coords.heading ?? undefined,
      altitude: loc.coords.altitude ?? undefined,
      timestamp: new Date(loc.timestamp).toISOString(),
    }));

    const response = await fetch(`${apiUrl}/api/gps/points`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        vehicleId,
        points,
        latitude: points[points.length - 1].latitude,
        longitude: points[points.length - 1].longitude,
      }),
    });

    if (!response.ok) {
      // Rete presente ma server ha rifiutato → bufferizza per retry
      await appendToBuffer(validLocations);
    }
  } catch {
    // Nessuna rete → bufferizza localmente
    await appendToBuffer(validLocations);
  }
});

async function appendToBuffer(locations: Location.LocationObject[]): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(GPS_BUFFER_KEY);
    const buffer: object[] = stored ? JSON.parse(stored) : [];

    const newPoints = locations.map((loc) => ({
      latitude: loc.coords.latitude.toString(),
      longitude: loc.coords.longitude.toString(),
      accuracy: loc.coords.accuracy ?? undefined,
      speed: loc.coords.speed != null ? Math.max(0, loc.coords.speed * 3.6) : undefined,
      heading: loc.coords.heading ?? undefined,
      altitude: loc.coords.altitude ?? undefined,
      timestamp: loc.timestamp,
    }));

    const merged = [...buffer, ...newPoints];
    // Mantieni max 500 punti (circa 1.5h a 10s/punto)
    const trimmed = merged.length > 500 ? merged.slice(-500) : merged;
    await AsyncStorage.setItem(GPS_BUFFER_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.error("[GPS Background] Buffer write error:", e);
  }
}

/**
 * Avvia il background GPS tracking.
 * Da chiamare quando l'autista inizia un servizio.
 *
 * @param vehicleId  ID del veicolo
 * @param apiUrl     Base URL dell'API (es: https://api.soccorsodigitale.app)
 * @param token      Bearer token auth
 * @returns true se il tracking è stato avviato con successo
 */
export async function startBackgroundTracking(
  vehicleId: string,
  apiUrl: string,
  token: string
): Promise<boolean> {
  if (!vehicleId || !apiUrl) return false;

  // Richiedi permesso foreground
  const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
  if (fgStatus !== "granted") {
    console.warn("[GPS Background] Foreground permission denied");
    return false;
  }

  // Richiedi permesso background
  const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
  if (bgStatus !== "granted") {
    console.warn("[GPS Background] Background permission denied — falling back to foreground only");
    // Non bloccare: il foreground tracking in GpsTrackingContext rimane attivo
    return false;
  }

  // Persisti vehicleId, apiUrl e token per il task (accede ad AsyncStorage direttamente)
  await Promise.all([
    AsyncStorage.setItem(BG_VEHICLE_KEY, vehicleId),
    AsyncStorage.setItem(BG_API_URL_KEY, apiUrl),
    AsyncStorage.setItem(BG_TOKEN_KEY, token),
  ]);

  // Ferma eventuale task precedente
  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
  if (isRegistered) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: 10_000,      // ogni 10 secondi (compromesso batteria/frequenza)
    distanceInterval: 10,       // o ogni 10 metri
    deferredUpdatesInterval: 5_000,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Soccorso Digitale",
      notificationBody: "Tracking GPS attivo — servizio in corso",
      notificationColor: "#1E3A8A",
    },
    pausesUpdatesAutomatically: false,
  });

  console.log("[GPS Background] Tracking started for vehicle:", vehicleId);
  return true;
}

/**
 * Ferma il background GPS tracking.
 * Da chiamare quando il servizio è completato.
 */
export async function stopBackgroundTracking(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
    await Promise.all([
      AsyncStorage.removeItem(BG_VEHICLE_KEY),
      AsyncStorage.removeItem(BG_TOKEN_KEY),
    ]);
    console.log("[GPS Background] Tracking stopped");
  } catch (e) {
    console.error("[GPS Background] Error stopping tracking:", e);
  }
}

/**
 * Restituisce true se il background task è attualmente registrato e attivo.
 */
export async function isBackgroundTrackingActive(): Promise<boolean> {
  return TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
}
