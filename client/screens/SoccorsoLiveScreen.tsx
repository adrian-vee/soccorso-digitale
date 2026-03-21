import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Platform,
  ActivityIndicator,
  TextInput,
  Modal,
  FlatList,
  Dimensions,
  Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import * as KeepAwake from "expo-keep-awake";
import { useQuery } from "@tanstack/react-query";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  SlideInRight,
  ZoomIn,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl, getAuthToken } from "@/lib/query-client";

let MapView: any = null;
let Polyline: any = null;
let Marker: any = null;
if (Platform.OS !== "web") {
  try {
    const Maps = require("react-native-maps");
    MapView = Maps.default;
    Polyline = Maps.Polyline;
    Marker = Maps.Marker;
  } catch {}
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type ServiceMode = "emergency" | "transport" | null;
type CodiceColore = "verde" | "giallo" | "rosso" | null;

interface PhaseData {
  id: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  requiresPatientData?: boolean;
  requiresHospital?: boolean;
}

interface CompletedPhase {
  id: string;
  timestamp: Date;
  address: string;
  coordinates: { latitude: number; longitude: number } | null;
  hospital?: string;
}

interface PatientData {
  codiceColore: CodiceColore;
  patologia: string;
  eta: string;
  sesso: "M" | "F" | null;
  note: string;
}

interface RoutePoint {
  latitude: number;
  longitude: number;
  timestamp: number;
}

interface ScenarioTemplate {
  id: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  codice: CodiceColore;
  patologia: string;
}

const EMERGENCY_PHASES: PhaseData[] = [
  { id: "inizio", label: "INIZIO", icon: "navigation", color: "#00E676" },
  { id: "sul_posto", label: "SUL POSTO", icon: "map-pin", color: "#40C4FF" },
  { id: "carico", label: "CARICO PAZIENTE", icon: "user-plus", color: "#E040FB", requiresPatientData: true },
  { id: "ospedale", label: "ARRIVO PS", icon: "plus-square", color: "#FF5252", requiresHospital: true },
  { id: "libero", label: "MEZZO LIBERO", icon: "radio", color: "#FFAB40" },
  { id: "rientro", label: "RIENTRO", icon: "home", color: "#69F0AE" },
];

const TRANSPORT_PHASES: PhaseData[] = [
  { id: "inizio", label: "INIZIO", icon: "navigation", color: "#00E676" },
  { id: "presa_carico", label: "PRESA IN CARICO", icon: "map-pin", color: "#40C4FF" },
  { id: "carico", label: "CARICO PAZIENTE", icon: "user-plus", color: "#E040FB", requiresPatientData: true },
  { id: "destinazione", label: "ARRIVO DESTINAZIONE", icon: "flag", color: "#FFAB40", requiresHospital: true },
  { id: "rientro", label: "RIENTRO", icon: "home", color: "#69F0AE" },
];

const CODICE_COLORI = [
  { value: "verde" as const, label: "VERDE", color: "#00E676", icon: "check-circle" as const },
  { value: "giallo" as const, label: "GIALLO", color: "#FFD600", icon: "alert-triangle" as const },
  { value: "rosso" as const, label: "ROSSO", color: "#FF1744", icon: "alert-octagon" as const },
];

const EMERGENCY_TEMPLATES: ScenarioTemplate[] = [
  { id: "incidente", label: "Incidente Stradale", icon: "alert-triangle", color: "#FF1744", codice: "rosso", patologia: "Trauma da incidente stradale" },
  { id: "malore", label: "Malore", icon: "heart", color: "#FFD600", codice: "giallo", patologia: "Malore generico" },
  { id: "caduta", label: "Caduta", icon: "trending-down", color: "#FFD600", codice: "giallo", patologia: "Caduta accidentale" },
  { id: "dispnea", label: "Dispnea", icon: "wind", color: "#FFD600", codice: "giallo", patologia: "Difficoltà respiratoria" },
  { id: "dolore_toracico", label: "Dolore Toracico", icon: "activity", color: "#FF1744", codice: "rosso", patologia: "Dolore toracico" },
  { id: "arresto", label: "Arresto Cardiaco", icon: "zap", color: "#FF1744", codice: "rosso", patologia: "Arresto cardiorespiratorio" },
  { id: "intossicazione", label: "Intossicazione", icon: "alert-circle", color: "#FFD600", codice: "giallo", patologia: "Intossicazione" },
  { id: "custom", label: "Personalizzato", icon: "edit", color: "#00B4D8", codice: null, patologia: "" },
];

const TRANSPORT_TEMPLATES: ScenarioTemplate[] = [
  { id: "dialisi", label: "Dialisi", icon: "droplet", color: "#00E676", codice: "verde", patologia: "Dialisi programmata" },
  { id: "dimissione", label: "Dimissione", icon: "log-out", color: "#00E676", codice: "verde", patologia: "Dimissione ospedaliera" },
  { id: "trasferimento", label: "Trasferimento", icon: "repeat", color: "#FFD600", codice: "giallo", patologia: "Trasferimento inter-ospedaliero" },
  { id: "visita", label: "Visita / Esame", icon: "clipboard", color: "#00E676", codice: "verde", patologia: "Visita medica programmata" },
  { id: "riabilitazione", label: "Riabilitazione", icon: "refresh-cw", color: "#00E676", codice: "verde", patologia: "Riabilitazione" },
  { id: "custom", label: "Personalizzato", icon: "edit", color: "#00B4D8", codice: null, patologia: "" },
];

const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#0A0E17" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#64748B" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0A0E17" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1E293B" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1E293B" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0F172A" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#111827" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#111827" }] },
];

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function reverseGeocode(latitude: number, longitude: number): Promise<string> {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (results.length > 0) {
      const addr = results[0];
      const parts = [];
      if (addr.street) parts.push(addr.street);
      if (addr.city) parts.push(addr.city);
      if (addr.region) parts.push(addr.region);
      return parts.join(", ") || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    }
    return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  } catch {
    return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatTimeShort(date: Date): string {
  return date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

function formatElapsed(startDate: Date, now: Date): string {
  const diff = Math.floor((now.getTime() - startDate.getTime()) / 1000);
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function SoccorsoLiveScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAuth();
  const mapRef = useRef<any>(null);

  const [mode, setMode] = useState<ServiceMode>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ScenarioTemplate | null>(null);
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [completedPhases, setCompletedPhases] = useState<CompletedPhase[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [currentCoords, setCurrentCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [currentSpeed, setCurrentSpeed] = useState<number | null>(null);
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);

  const [patientData, setPatientData] = useState<PatientData>({
    codiceColore: null, patologia: "", eta: "", sesso: null, note: "",
  });
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [showHospitalModal, setShowHospitalModal] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState<string | null>(null);
  const [hospitalSearch, setHospitalSearch] = useState("");
  const [pendingPhaseCapture, setPendingPhaseCapture] = useState(false);
  const [pendingHospitalCapture, setPendingHospitalCapture] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [isSavingReport, setIsSavingReport] = useState(false);

  const pulseAnim = useSharedValue(1);
  const scanlineAnim = useSharedValue(0);
  const ringAnim = useSharedValue(0);

  const phases = mode === "emergency" ? EMERGENCY_PHASES : TRANSPORT_PHASES;
  const isServiceComplete = mode !== null && selectedTemplate !== null && currentPhaseIndex >= phases.length;
  const isServiceActive = mode !== null && selectedTemplate !== null && !isServiceComplete;
  const serviceStartTime = completedPhases.length > 0 ? completedPhases[0].timestamp : null;
  const currentTemplates = mode === "emergency" ? EMERGENCY_TEMPLATES : TRANSPORT_TEMPLATES;

  const totalDistanceKm = useMemo(() => {
    if (routePoints.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < routePoints.length; i++) {
      total += haversineDistance(
        routePoints[i - 1].latitude, routePoints[i - 1].longitude,
        routePoints[i].latitude, routePoints[i].longitude
      );
    }
    return total;
  }, [routePoints]);

  const { data: structures = [] } = useQuery<any[]>({
    queryKey: ["/api/structures"],
    enabled: mode !== null,
  });

  const filteredStructures = structures.filter((s: any) =>
    s.name?.toLowerCase().includes(hospitalSearch.toLowerCase()) ||
    s.address?.toLowerCase().includes(hospitalSearch.toLowerCase())
  );

  useEffect(() => {
    if (isServiceActive) {
      KeepAwake.activateKeepAwakeAsync();
    } else {
      KeepAwake.deactivateKeepAwake();
    }
    return () => { KeepAwake.deactivateKeepAwake(); };
  }, [isServiceActive]);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === "granted");
    })();
  }, []);

  useEffect(() => {
    if (!locationPermission || !isServiceActive) return;
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 5 },
        (loc) => {
          setCurrentCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          setCurrentSpeed(loc.coords.speed !== null && loc.coords.speed >= 0 ? loc.coords.speed * 3.6 : null);
          setRoutePoints(prev => [...prev, {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            timestamp: Date.now(),
          }]);
        }
      );
    })();
    return () => { if (sub) sub.remove(); };
  }, [locationPermission, isServiceActive]);

  useEffect(() => {
    if (isServiceActive) {
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1.06, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ), -1, true
      );
      scanlineAnim.value = withRepeat(
        withTiming(1, { duration: 2000, easing: Easing.linear }), -1, false
      );
      ringAnim.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1500 }),
          withTiming(0, { duration: 1500 })
        ), -1, true
      );
    }
  }, [isServiceActive]);

  useEffect(() => {
    if (isServiceComplete && completedPhases.length > 0 && !reportUrl) {
      saveReport();
    }
  }, [isServiceComplete]);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulseAnim.value }] }));
  const scanlineStyle = useAnimatedStyle(() => ({ opacity: 0.15 + scanlineAnim.value * 0.1 }));
  const ringStyle = useAnimatedStyle(() => ({ opacity: 0.3 + ringAnim.value * 0.5, transform: [{ scale: 1 + ringAnim.value * 0.15 }] }));

  const selectTemplate = (template: ScenarioTemplate) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedTemplate(template);
    if (template.codice) {
      setPatientData(prev => ({
        ...prev,
        codiceColore: template.codice,
        patologia: template.patologia,
      }));
    }
  };

  const capturePhase = useCallback(async () => {
    if (isCapturing || currentPhaseIndex >= phases.length) return;
    const currentPhase = phases[currentPhaseIndex];

    if (currentPhase.requiresPatientData && !patientData.codiceColore) {
      setShowPatientModal(true);
      setPendingPhaseCapture(true);
      return;
    }

    if (currentPhase.requiresHospital && !selectedHospital) {
      setShowHospitalModal(true);
      setPendingHospitalCapture(true);
      return;
    }

    setIsCapturing(true);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      let coordinates: { latitude: number; longitude: number } | null = null;
      let address = "Posizione non disponibile";

      if (locationPermission) {
        const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        coordinates = { latitude: location.coords.latitude, longitude: location.coords.longitude };
        address = await reverseGeocode(coordinates.latitude, coordinates.longitude);
      }

      const newPhase: CompletedPhase = {
        id: currentPhase.id,
        timestamp: new Date(),
        address,
        coordinates,
        hospital: currentPhase.requiresHospital ? (selectedHospital || undefined) : undefined,
      };

      setCompletedPhases(prev => [...prev, newPhase]);
      setCurrentPhaseIndex(prev => prev + 1);
      if (currentPhase.requiresHospital) setSelectedHospital(null);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Errore", "Impossibile catturare la posizione. Riprova.");
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, currentPhaseIndex, phases, locationPermission, patientData.codiceColore, selectedHospital]);

  const confirmPatientData = () => {
    if (!patientData.codiceColore) {
      Alert.alert("Attenzione", "Seleziona il codice colore del paziente");
      return;
    }
    setShowPatientModal(false);
    if (pendingPhaseCapture) {
      setPendingPhaseCapture(false);
      setTimeout(() => capturePhase(), 100);
    }
  };

  const confirmHospital = (name: string) => {
    setSelectedHospital(name);
    setShowHospitalModal(false);
    setHospitalSearch("");
    if (pendingHospitalCapture) {
      setPendingHospitalCapture(false);
      setTimeout(() => {
        setIsCapturing(false);
        capturePhaseWithHospital(name);
      }, 100);
    }
  };

  const capturePhaseWithHospital = useCallback(async (hospital: string) => {
    if (currentPhaseIndex >= phases.length) return;
    const currentPhase = phases[currentPhaseIndex];
    setIsCapturing(true);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      let coordinates: { latitude: number; longitude: number } | null = null;
      let address = "Posizione non disponibile";
      if (locationPermission) {
        const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        coordinates = { latitude: location.coords.latitude, longitude: location.coords.longitude };
        address = await reverseGeocode(coordinates.latitude, coordinates.longitude);
      }
      setCompletedPhases(prev => [...prev, {
        id: currentPhase.id, timestamp: new Date(), address, coordinates, hospital,
      }]);
      setCurrentPhaseIndex(prev => prev + 1);
      setSelectedHospital(null);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Errore", "Impossibile catturare la posizione.");
    } finally {
      setIsCapturing(false);
    }
  }, [currentPhaseIndex, phases, locationPermission]);

  const resetService = () => {
    Alert.alert("Nuovo Intervento", "Vuoi iniziare un nuovo intervento?", [
      { text: "Annulla", style: "cancel" },
      {
        text: "Conferma", style: "destructive",
        onPress: () => {
          setMode(null);
          setSelectedTemplate(null);
          setCurrentPhaseIndex(0);
          setCompletedPhases([]);
          setPatientData({ codiceColore: null, patologia: "", eta: "", sesso: null, note: "" });
          setSelectedHospital(null);
          setRoutePoints([]);
          setReportUrl(null);
        },
      },
    ]);
  };

  const selectMode = (selectedMode: ServiceMode) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMode(selectedMode);
  };

  const saveReport = async () => {
    setIsSavingReport(true);
    try {
      const token = await getAuthToken();
      const serviceData = {
        mode: mode === "emergency" ? "Emergenza 118" : "Trasporto Sanitario",
        vehicle: user?.vehicle?.code || "---",
        location: user?.location?.name || "---",
        date: completedPhases[0]?.timestamp ? formatDate(completedPhases[0].timestamp) : formatDate(new Date()),
        phases: completedPhases.map(p => {
          const phaseInfo = phases.find(ph => ph.id === p.id);
          return { label: phaseInfo?.label || p.id, time: formatTime(p.timestamp), address: p.address, hospital: p.hospital };
        }),
        patient: patientData.codiceColore ? {
          codice: patientData.codiceColore.toUpperCase(),
          patologia: patientData.patologia || "Non specificata",
          eta: patientData.eta || "N/D",
          sesso: patientData.sesso || "N/D",
          note: patientData.note || "",
          template: selectedTemplate?.label || null,
        } : null,
        startTime: completedPhases[0] ? formatTime(completedPhases[0].timestamp) : "--:--:--",
        endTime: completedPhases.length > 0 ? formatTime(completedPhases[completedPhases.length - 1].timestamp) : "--:--:--",
        template: selectedTemplate?.label,
      };

      const response = await fetch(new URL("/api/soccorso-live/report", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: "include",
        body: JSON.stringify({ serviceData, routeData: routePoints, totalKm: totalDistanceKm }),
      });

      if (response.ok) {
        const result = await response.json();
        setReportUrl(result.url);
      }
    } catch (err) {
      console.error("Error saving report:", err);
    } finally {
      setIsSavingReport(false);
    }
  };

  const openReport = async () => {
    if (reportUrl) {
      if (Platform.OS === "web") {
        window.open(reportUrl, "_blank");
      } else {
        try {
          const { openBrowserAsync } = await import("expo-web-browser");
          await openBrowserAsync(reportUrl);
        } catch {}
      }
    }
  };

  const shareReport = async () => {
    if (reportUrl) {
      try {
        await Share.share({
          message: `Scheda Servizio - SOCCORSO LIVE\n${reportUrl}`,
          url: reportUrl,
        });
      } catch {}
    }
  };

  const generateAndDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const token = await getAuthToken();
      const serviceData = {
        mode: mode === "emergency" ? "Emergenza 118" : "Trasporto Sanitario",
        vehicle: user?.vehicle?.code || "---",
        location: user?.location?.name || "---",
        date: completedPhases[0]?.timestamp ? formatDate(completedPhases[0].timestamp) : formatDate(new Date()),
        phases: completedPhases.map(p => {
          const phaseInfo = phases.find(ph => ph.id === p.id);
          return { label: phaseInfo?.label || p.id, time: formatTime(p.timestamp), address: p.address, hospital: p.hospital };
        }),
        patient: patientData.codiceColore ? {
          codice: patientData.codiceColore.toUpperCase(),
          patologia: patientData.patologia || "Non specificata",
          eta: patientData.eta || "N/D",
          sesso: patientData.sesso || "N/D",
          note: patientData.note || "",
        } : null,
        startTime: completedPhases[0] ? formatTime(completedPhases[0].timestamp) : "--:--:--",
        endTime: completedPhases.length > 0 ? formatTime(completedPhases[completedPhases.length - 1].timestamp) : "--:--:--",
        routeData: routePoints,
        totalKm: totalDistanceKm,
      };

      const response = await fetch(new URL("/api/soccorso-live/pdf", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: "include",
        body: JSON.stringify(serviceData),
      });

      if (!response.ok) throw new Error("Errore generazione PDF");
      const blob = await response.blob();

      if (Platform.OS === "web") {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `servizio-${formatDate(new Date()).replace(/\//g, "-")}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        Alert.alert("Successo", "PDF del servizio generato con successo!");
      }
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Errore", "Impossibile generare il PDF. Riprova.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const DARK_BG = "#0A0E17";
  const DARK_CARD = "#111827";
  const DARK_BORDER = "#1E293B";
  const ACCENT_BLUE = "#00B4D8";
  const ACCENT_GREEN = "#00E676";

  if (mode === null) {
    return (
      <View style={[styles.container, { backgroundColor: DARK_BG }]}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.xl }]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeIn.duration(400)}>
            <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Feather name="arrow-left" size={22} color="#FFFFFF" />
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(600).delay(100)}>
            <View style={styles.heroSection}>
              <View style={styles.heroIcon}>
                <LinearGradient colors={["#00B4D8", "#00E676"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroGradient}>
                  <Feather name="activity" size={40} color="#FFFFFF" />
                </LinearGradient>
              </View>
              <ThemedText style={styles.heroTitle}>SOCCORSO</ThemedText>
              <ThemedText style={styles.heroTitleAccent}>LIVE</ThemedText>
              <ThemedText style={styles.heroSub}>Tracking intervento in tempo reale</ThemedText>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(600).delay(200)}>
            <View style={[styles.telemetryRow, { borderColor: DARK_BORDER }]}>
              <View style={styles.telemetryItem}>
                <ThemedText style={styles.telemetryLabel}>ORA</ThemedText>
                <ThemedText style={styles.telemetryValue}>{formatTime(currentTime)}</ThemedText>
              </View>
              <View style={[styles.telemetryDivider, { backgroundColor: DARK_BORDER }]} />
              <View style={styles.telemetryItem}>
                <ThemedText style={styles.telemetryLabel}>MEZZO</ThemedText>
                <ThemedText style={styles.telemetryValue}>{user?.vehicle?.code || "---"}</ThemedText>
              </View>
              <View style={[styles.telemetryDivider, { backgroundColor: DARK_BORDER }]} />
              <View style={styles.telemetryItem}>
                <ThemedText style={styles.telemetryLabel}>SEDE</ThemedText>
                <ThemedText style={[styles.telemetryValue, { fontSize: 13 }]}>{user?.location?.name || "---"}</ThemedText>
              </View>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(600).delay(350)}>
            <Pressable onPress={() => selectMode("emergency")}>
              <View style={[styles.modeCard, { borderColor: "#FF1744" }]}>
                <LinearGradient colors={["rgba(255,23,68,0.15)", "rgba(255,23,68,0.05)"]} style={styles.modeGradientBg}>
                  <View style={styles.modeRow}>
                    <View style={[styles.modeIcon, { backgroundColor: "rgba(255,23,68,0.2)" }]}>
                      <Feather name="zap" size={28} color="#FF1744" />
                    </View>
                    <View style={styles.modeText}>
                      <ThemedText style={[styles.modeLabel, { color: "#FF1744" }]}>EMERGENZA 118</ThemedText>
                      <ThemedText style={styles.modeSub}>Soccorso sanitario d'emergenza</ThemedText>
                    </View>
                    <Feather name="chevron-right" size={24} color="#FF1744" />
                  </View>
                </LinearGradient>
              </View>
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(600).delay(450)}>
            <Pressable onPress={() => selectMode("transport")}>
              <View style={[styles.modeCard, { borderColor: ACCENT_BLUE }]}>
                <LinearGradient colors={["rgba(0,180,216,0.15)", "rgba(0,180,216,0.05)"]} style={styles.modeGradientBg}>
                  <View style={styles.modeRow}>
                    <View style={[styles.modeIcon, { backgroundColor: "rgba(0,180,216,0.2)" }]}>
                      <Feather name="truck" size={28} color={ACCENT_BLUE} />
                    </View>
                    <View style={styles.modeText}>
                      <ThemedText style={[styles.modeLabel, { color: ACCENT_BLUE }]}>TRASPORTO</ThemedText>
                      <ThemedText style={styles.modeSub}>Trasferimento / Dimissioni</ThemedText>
                    </View>
                    <Feather name="chevron-right" size={24} color={ACCENT_BLUE} />
                  </View>
                </LinearGradient>
              </View>
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(600).delay(550)}>
            <View style={[styles.featuresGrid]}>
              {[
                { icon: "crosshair" as const, label: "GPS Auto", color: ACCENT_GREEN },
                { icon: "navigation" as const, label: "KM Auto", color: ACCENT_GREEN },
                { icon: "map" as const, label: "Mappa Live", color: ACCENT_BLUE },
                { icon: "clock" as const, label: "Timestamp", color: ACCENT_BLUE },
                { icon: "sun" as const, label: "Schermo ON", color: "#FFD600" },
                { icon: "share-2" as const, label: "Condividi", color: "#E040FB" },
              ].map((f, i) => (
                <View key={i} style={[styles.featureChip, { borderColor: DARK_BORDER }]}>
                  <Feather name={f.icon} size={16} color={f.color} />
                  <ThemedText style={styles.featureChipText}>{f.label}</ThemedText>
                </View>
              ))}
            </View>
          </Animated.View>
        </ScrollView>
      </View>
    );
  }

  if (selectedTemplate === null) {
    return (
      <View style={[styles.container, { backgroundColor: DARK_BG }]}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.xl }]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeIn.duration(400)}>
            <Pressable onPress={() => setMode(null)} style={styles.backBtn}>
              <Feather name="arrow-left" size={22} color="#FFFFFF" />
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(600).delay(100)}>
            <View style={{ alignItems: "center", marginBottom: Spacing.xl }}>
              <View style={[styles.templateModeIcon, { backgroundColor: mode === "emergency" ? "rgba(255,23,68,0.15)" : "rgba(0,180,216,0.15)" }]}>
                <Feather name={mode === "emergency" ? "zap" : "truck"} size={28} color={mode === "emergency" ? "#FF1744" : ACCENT_BLUE} />
              </View>
              <ThemedText style={styles.templateTitle}>SELEZIONA SCENARIO</ThemedText>
              <ThemedText style={styles.templateSub}>
                {mode === "emergency" ? "Tipo di emergenza" : "Tipo di trasporto"}
              </ThemedText>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(600).delay(200)}>
            <View style={styles.templateGrid}>
              {currentTemplates.map((template, index) => (
                <Animated.View key={template.id} entering={FadeInDown.duration(400).delay(250 + index * 60)} style={styles.templateCardWrapper}>
                  <Pressable onPress={() => selectTemplate(template)} style={[styles.templateCard, { borderColor: template.color + "40" }]}>
                    <LinearGradient colors={[template.color + "20", template.color + "08"]} style={styles.templateCardGradient}>
                      <View style={[styles.templateIconWrap, { backgroundColor: template.color + "25" }]}>
                        <Feather name={template.icon} size={24} color={template.color} />
                      </View>
                      <ThemedText style={[styles.templateCardLabel, { color: template.color }]}>{template.label}</ThemedText>
                      {template.codice ? (
                        <View style={[styles.templateCodiceDot, { backgroundColor: template.color }]} />
                      ) : null}
                    </LinearGradient>
                  </Pressable>
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        </ScrollView>
      </View>
    );
  }

  const currentPhase = phases[currentPhaseIndex];
  const progressPercent = (currentPhaseIndex / phases.length) * 100;

  return (
    <View style={[styles.container, { backgroundColor: DARK_BG }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + Spacing.sm, paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(300)}>
          <View style={[styles.missionHeader, { borderColor: DARK_BORDER }]}>
            <View style={styles.missionHeaderTop}>
              <View style={styles.missionLive}>
                <Animated.View style={[styles.livePulse, ringStyle]} />
                <View style={styles.liveDot} />
                <ThemedText style={styles.liveLabel}>LIVE</ThemedText>
              </View>
              <ThemedText style={[styles.missionType, { color: mode === "emergency" ? "#FF1744" : ACCENT_BLUE }]}>
                {mode === "emergency" ? "EMERGENZA 118" : "TRASPORTO"}
              </ThemedText>
              <Pressable onPress={resetService} style={styles.abortBtn}>
                <Feather name="x" size={16} color="#FF1744" />
              </Pressable>
            </View>
            <View style={styles.missionInfo}>
              <ThemedText style={styles.missionVehicle}>{user?.vehicle?.code || "---"}</ThemedText>
              <View style={[styles.missionDot, { backgroundColor: DARK_BORDER }]} />
              <ThemedText style={styles.missionLocation}>{user?.location?.name || "---"}</ThemedText>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(50)}>
          <View style={[styles.telemetryPanel, { borderColor: DARK_BORDER }]}>
            <View style={styles.telemetryGrid}>
              <View style={styles.telemetryCell}>
                <ThemedText style={styles.tLabel}>TEMPO</ThemedText>
                <ThemedText style={styles.tValueLarge}>{formatTime(currentTime)}</ThemedText>
              </View>
              <View style={[styles.telemetrySep, { backgroundColor: DARK_BORDER }]} />
              <View style={styles.telemetryCell}>
                <ThemedText style={styles.tLabel}>DURATA</ThemedText>
                <ThemedText style={[styles.tValueLarge, { color: ACCENT_GREEN }]}>
                  {serviceStartTime ? formatElapsed(serviceStartTime, currentTime) : "00:00"}
                </ThemedText>
              </View>
              <View style={[styles.telemetrySep, { backgroundColor: DARK_BORDER }]} />
              <View style={styles.telemetryCell}>
                <ThemedText style={styles.tLabel}>VELOCITÀ</ThemedText>
                <View style={styles.speedRow}>
                  <ThemedText style={[styles.tValueLarge, { color: ACCENT_BLUE }]}>
                    {currentSpeed !== null ? Math.round(currentSpeed).toString() : "--"}
                  </ThemedText>
                  <ThemedText style={styles.speedUnit}>km/h</ThemedText>
                </View>
              </View>
            </View>
            {(currentCoords || totalDistanceKm > 0) ? (
              <View style={[styles.coordsRow, { borderTopColor: DARK_BORDER }]}>
                {currentCoords ? (
                  <>
                    <Feather name="crosshair" size={12} color="#64748B" />
                    <ThemedText style={styles.coordsText}>
                      {currentCoords.latitude.toFixed(6)}  {currentCoords.longitude.toFixed(6)}
                    </ThemedText>
                  </>
                ) : null}
                <View style={{ flex: 1 }} />
                <Feather name="navigation" size={12} color={ACCENT_GREEN} />
                <ThemedText style={[styles.coordsText, { color: ACCENT_GREEN, fontWeight: "700" }]}>
                  {totalDistanceKm.toFixed(1)} km
                </ThemedText>
              </View>
            ) : null}
          </View>
        </Animated.View>

        {patientData.codiceColore ? (
          <Animated.View entering={FadeIn.duration(300)}>
            <Pressable onPress={() => setShowPatientModal(true)} style={[styles.patientBanner, {
              borderColor: patientData.codiceColore === "rosso" ? "#FF1744" : patientData.codiceColore === "giallo" ? "#FFD600" : ACCENT_GREEN,
            }]}>
              <View style={[styles.codiceBadge, {
                backgroundColor: patientData.codiceColore === "rosso" ? "#FF1744" : patientData.codiceColore === "giallo" ? "#FFD600" : ACCENT_GREEN,
              }]}>
                <ThemedText style={[styles.codiceBadgeText, {
                  color: patientData.codiceColore === "giallo" ? "#000" : "#FFF",
                }]}>
                  {patientData.codiceColore.toUpperCase()}
                </ThemedText>
              </View>
              <View style={styles.patientInfo}>
                <ThemedText style={styles.patientInfoTitle}>
                  {patientData.patologia || "Paziente"}{patientData.eta ? ` - ${patientData.eta}a` : ""}{patientData.sesso ? ` (${patientData.sesso})` : ""}
                </ThemedText>
              </View>
              {selectedTemplate && selectedTemplate.id !== "custom" ? (
                <View style={styles.templateBadge}>
                  <ThemedText style={styles.templateBadgeText}>{selectedTemplate.label}</ThemedText>
                </View>
              ) : null}
              <Feather name="edit-2" size={14} color="#64748B" />
            </Pressable>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.duration(400).delay(100)}>
          <View style={styles.timelineSection}>
            {phases.map((phase, index) => {
              const completed = completedPhases.find(cp => cp.id === phase.id);
              const isCurrent = index === currentPhaseIndex && !isServiceComplete;
              const isFuture = index > currentPhaseIndex;

              return (
                <Animated.View key={phase.id} entering={SlideInRight.duration(300).delay(index * 60)}>
                  <View style={styles.timelineRow}>
                    <View style={styles.timelineLeft}>
                      <View style={[styles.timelineDot, {
                        backgroundColor: completed ? phase.color : isCurrent ? phase.color : DARK_BORDER,
                        shadowColor: isCurrent ? phase.color : "transparent",
                        shadowOpacity: isCurrent ? 0.8 : 0,
                        shadowRadius: isCurrent ? 8 : 0,
                      }]}>
                        {completed ? <Feather name="check" size={12} color="#FFF" /> : null}
                      </View>
                      {index < phases.length - 1 ? (
                        <View style={[styles.timelineLine, { backgroundColor: completed ? phase.color : DARK_BORDER }]} />
                      ) : null}
                    </View>
                    <View style={[styles.timelineContent, {
                      backgroundColor: isCurrent ? "rgba(0,180,216,0.08)" : "transparent",
                      borderColor: isCurrent ? ACCENT_BLUE : "transparent",
                    }]}>
                      <View style={styles.timelineContentRow}>
                        <ThemedText style={[styles.timelineLabel, {
                          color: completed ? "#E2E8F0" : isCurrent ? "#FFFFFF" : "#475569",
                        }]}>
                          {phase.label}
                        </ThemedText>
                        {completed ? (
                          <ThemedText style={[styles.timelineTime, { color: phase.color }]}>
                            {formatTime(completed.timestamp)}
                          </ThemedText>
                        ) : null}
                      </View>
                      {completed ? (
                        <View>
                          <ThemedText style={styles.timelineAddr} numberOfLines={1}>{completed.address}</ThemedText>
                          {completed.hospital ? (
                            <View style={styles.hospitalTag}>
                              <Feather name="plus-square" size={11} color="#FF5252" />
                              <ThemedText style={styles.hospitalTagText}>{completed.hospital}</ThemedText>
                            </View>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  </View>
                </Animated.View>
              );
            })}
          </View>
        </Animated.View>

        {!isServiceComplete && currentPhase ? (
          <Animated.View entering={ZoomIn.duration(500).delay(200)}>
            <Pressable onPress={capturePhase} disabled={isCapturing} style={styles.captureContainer}>
              <Animated.View style={pulseStyle}>
                <View style={[styles.captureOuter, { borderColor: currentPhase.color }]}>
                  <Animated.View style={[styles.captureRing, { borderColor: currentPhase.color }, ringStyle]} />
                  <LinearGradient
                    colors={[currentPhase.color, `${currentPhase.color}CC`]}
                    style={styles.captureInner}
                  >
                    {isCapturing ? (
                      <ActivityIndicator size="large" color="#FFFFFF" />
                    ) : (
                      <>
                        <Feather name={currentPhase.icon} size={36} color="#FFFFFF" />
                        <ThemedText style={styles.captureText}>{currentPhase.label}</ThemedText>
                      </>
                    )}
                  </LinearGradient>
                </View>
              </Animated.View>
            </Pressable>

            <View style={styles.progressSection}>
              <View style={[styles.progressTrack, { backgroundColor: DARK_CARD }]}>
                <LinearGradient
                  colors={[currentPhase.color, ACCENT_GREEN]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressFill, { width: `${progressPercent}%` }]}
                />
              </View>
              <ThemedText style={styles.progressText}>
                {currentPhaseIndex}/{phases.length}
              </ThemedText>
            </View>
          </Animated.View>
        ) : null}

        {isServiceComplete ? (
          <Animated.View entering={ZoomIn.duration(600)}>
            <View style={[styles.completePanel, { borderColor: ACCENT_GREEN }]}>
              <LinearGradient colors={["rgba(0,230,118,0.12)", "rgba(0,230,118,0.03)"]} style={styles.completeBg}>
                <Feather name="check-circle" size={48} color={ACCENT_GREEN} />
                <ThemedText style={styles.completeTitle}>INTERVENTO COMPLETATO</ThemedText>

                <View style={styles.completeSummary}>
                  <View style={styles.completeItem}>
                    <ThemedText style={[styles.completeValue, { color: ACCENT_GREEN }]}>{completedPhases.length}</ThemedText>
                    <ThemedText style={styles.completeLabel}>Fasi</ThemedText>
                  </View>
                  <View style={[styles.completeDivider, { backgroundColor: DARK_BORDER }]} />
                  <View style={styles.completeItem}>
                    <ThemedText style={[styles.completeValue, { color: ACCENT_BLUE }]}>
                      {completedPhases.length > 0 ? formatTime(completedPhases[0].timestamp) : "--:--:--"}
                    </ThemedText>
                    <ThemedText style={styles.completeLabel}>Inizio</ThemedText>
                  </View>
                  <View style={[styles.completeDivider, { backgroundColor: DARK_BORDER }]} />
                  <View style={styles.completeItem}>
                    <ThemedText style={[styles.completeValue, { color: "#E040FB" }]}>
                      {completedPhases.length >= 2 ? formatElapsed(completedPhases[0].timestamp, completedPhases[completedPhases.length - 1].timestamp) : "--"}
                    </ThemedText>
                    <ThemedText style={styles.completeLabel}>Durata</ThemedText>
                  </View>
                  <View style={[styles.completeDivider, { backgroundColor: DARK_BORDER }]} />
                  <View style={styles.completeItem}>
                    <ThemedText style={[styles.completeValue, { color: "#FFD600" }]}>
                      {totalDistanceKm.toFixed(1)}
                    </ThemedText>
                    <ThemedText style={styles.completeLabel}>KM</ThemedText>
                  </View>
                </View>

                {routePoints.length > 1 && Platform.OS !== "web" && MapView ? (
                  <View style={styles.mapContainer}>
                    <ThemedText style={styles.mapTitle}>PERCORSO INTERVENTO</ThemedText>
                    <View style={styles.mapWrapper}>
                      <MapView
                        ref={mapRef}
                        style={styles.map}
                        customMapStyle={DARK_MAP_STYLE}
                        onLayout={() => {
                          if (routePoints.length > 1) {
                            mapRef.current?.fitToCoordinates(
                              routePoints.map(p => ({ latitude: p.latitude, longitude: p.longitude })),
                              { edgePadding: { top: 50, right: 50, bottom: 50, left: 50 }, animated: true }
                            );
                          }
                        }}
                        initialRegion={{
                          latitude: routePoints[0]?.latitude || 0,
                          longitude: routePoints[0]?.longitude || 0,
                          latitudeDelta: 0.05,
                          longitudeDelta: 0.05,
                        }}
                      >
                        <Polyline
                          coordinates={routePoints.map(p => ({ latitude: p.latitude, longitude: p.longitude }))}
                          strokeColor={ACCENT_BLUE}
                          strokeWidth={4}
                        />
                        {completedPhases.filter(p => p.coordinates).map((phase) => (
                          <Marker
                            key={phase.id}
                            coordinate={phase.coordinates!}
                            title={phases.find(p => p.id === phase.id)?.label}
                            pinColor={phases.find(p => p.id === phase.id)?.color || ACCENT_BLUE}
                          />
                        ))}
                      </MapView>
                    </View>
                  </View>
                ) : Platform.OS === "web" && routePoints.length > 1 ? (
                  <View style={[styles.mapContainer, { alignItems: "center", paddingVertical: Spacing.xl }]}>
                    <Feather name="map" size={40} color="#475569" />
                    <ThemedText style={{ color: "#475569", marginTop: Spacing.sm, fontSize: 13 }}>
                      Mappa disponibile su dispositivo mobile
                    </ThemedText>
                  </View>
                ) : null}

                {isSavingReport ? (
                  <View style={styles.savingRow}>
                    <ActivityIndicator size="small" color={ACCENT_BLUE} />
                    <ThemedText style={{ color: "#64748B", marginLeft: 8, fontSize: 13 }}>Salvataggio report...</ThemedText>
                  </View>
                ) : reportUrl ? (
                  <View style={{ width: "100%" }}>
                    <Pressable onPress={openReport} style={styles.pdfBtn}>
                      <Feather name="file-text" size={18} color="#FFFFFF" />
                      <ThemedText style={styles.pdfBtnText}>APRI PDF</ThemedText>
                    </Pressable>
                    <Pressable onPress={shareReport} style={styles.shareBtn}>
                      <Feather name="share-2" size={16} color={ACCENT_GREEN} />
                      <ThemedText style={[styles.newBtnText, { color: ACCENT_GREEN }]}>CONDIVIDI LINK</ThemedText>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable onPress={generateAndDownloadPdf} style={styles.pdfBtn} disabled={isGeneratingPdf}>
                    {isGeneratingPdf ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Feather name="download" size={18} color="#FFFFFF" />
                        <ThemedText style={styles.pdfBtnText}>SCARICA PDF</ThemedText>
                      </>
                    )}
                  </Pressable>
                )}

                <Pressable onPress={resetService} style={styles.newBtn}>
                  <Feather name="refresh-cw" size={16} color={ACCENT_BLUE} />
                  <ThemedText style={[styles.newBtnText, { color: ACCENT_BLUE }]}>NUOVO INTERVENTO</ThemedText>
                </Pressable>
              </LinearGradient>
            </View>
          </Animated.View>
        ) : null}
      </ScrollView>

      <Modal visible={showPatientModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPatientModal(false)}>
        <View style={[styles.modalWrap, { backgroundColor: DARK_BG }]}>
          <View style={[styles.modalHead, { borderBottomColor: DARK_BORDER }]}>
            <Pressable onPress={() => setShowPatientModal(false)} style={styles.modalClose}>
              <Feather name="x" size={22} color="#E2E8F0" />
            </Pressable>
            <ThemedText style={styles.modalTitle}>DATI PAZIENTE</ThemedText>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
            <ThemedText style={styles.fieldLabel}>CODICE COLORE *</ThemedText>
            <View style={styles.codiceRow}>
              {CODICE_COLORI.map((c) => (
                <Pressable key={c.value} onPress={() => setPatientData(p => ({ ...p, codiceColore: c.value }))}
                  style={[styles.codiceBtn, {
                    backgroundColor: patientData.codiceColore === c.value ? c.color : DARK_CARD,
                    borderColor: c.color,
                  }]}>
                  <Feather name={c.icon} size={20} color={patientData.codiceColore === c.value ? (c.value === "giallo" ? "#000" : "#FFF") : c.color} />
                  <ThemedText style={[styles.codiceBtnText, {
                    color: patientData.codiceColore === c.value ? (c.value === "giallo" ? "#000" : "#FFF") : c.color,
                  }]}>{c.label}</ThemedText>
                </Pressable>
              ))}
            </View>

            <ThemedText style={[styles.fieldLabel, { marginTop: Spacing.xl }]}>PATOLOGIA / MOTIVO</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: DARK_CARD, color: "#E2E8F0", borderColor: DARK_BORDER }]}
              placeholder="Es: Trauma, Dispnea, Dolore toracico..."
              placeholderTextColor="#475569"
              value={patientData.patologia}
              onChangeText={(t) => setPatientData(p => ({ ...p, patologia: t }))}
            />

            <View style={styles.inputRow}>
              <View style={{ flex: 1, marginRight: Spacing.md }}>
                <ThemedText style={styles.fieldLabel}>ETÀ</ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: DARK_CARD, color: "#E2E8F0", borderColor: DARK_BORDER }]}
                  placeholder="Anni"
                  placeholderTextColor="#475569"
                  keyboardType="numeric"
                  value={patientData.eta}
                  onChangeText={(t) => setPatientData(p => ({ ...p, eta: t }))}
                />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.fieldLabel}>SESSO</ThemedText>
                <View style={styles.sessoRow}>
                  {(["M", "F"] as const).map((s) => (
                    <Pressable key={s} onPress={() => setPatientData(p => ({ ...p, sesso: s }))}
                      style={[styles.sessoBtn, {
                        backgroundColor: patientData.sesso === s ? ACCENT_BLUE : DARK_CARD,
                        borderColor: patientData.sesso === s ? ACCENT_BLUE : DARK_BORDER,
                      }]}>
                      <ThemedText style={[styles.sessoText, { color: patientData.sesso === s ? "#FFF" : "#94A3B8" }]}>{s}</ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            <ThemedText style={[styles.fieldLabel, { marginTop: Spacing.lg }]}>NOTE</ThemedText>
            <TextInput
              style={[styles.input, styles.inputArea, { backgroundColor: DARK_CARD, color: "#E2E8F0", borderColor: DARK_BORDER }]}
              placeholder="Note aggiuntive..."
              placeholderTextColor="#475569"
              multiline
              numberOfLines={3}
              value={patientData.note}
              onChangeText={(t) => setPatientData(p => ({ ...p, note: t }))}
            />
          </ScrollView>

          <View style={[styles.modalFooter, { borderTopColor: DARK_BORDER }]}>
            <Pressable onPress={confirmPatientData}
              style={[styles.confirmBtn, { backgroundColor: patientData.codiceColore ? ACCENT_BLUE : DARK_CARD }]}
              disabled={!patientData.codiceColore}>
              <ThemedText style={styles.confirmBtnText}>CONFERMA DATI</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={showHospitalModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowHospitalModal(false)}>
        <View style={[styles.modalWrap, { backgroundColor: DARK_BG }]}>
          <View style={[styles.modalHead, { borderBottomColor: DARK_BORDER }]}>
            <Pressable onPress={() => { setShowHospitalModal(false); setPendingHospitalCapture(false); }} style={styles.modalClose}>
              <Feather name="x" size={22} color="#E2E8F0" />
            </Pressable>
            <ThemedText style={styles.modalTitle}>SELEZIONA STRUTTURA</ThemedText>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.searchBar}>
            <Feather name="search" size={18} color="#64748B" />
            <TextInput
              style={[styles.searchInput, { color: "#E2E8F0" }]}
              placeholder="Cerca ospedale, clinica..."
              placeholderTextColor="#475569"
              value={hospitalSearch}
              onChangeText={setHospitalSearch}
              autoFocus
            />
          </View>

          <FlatList
            data={filteredStructures}
            keyExtractor={(item: any) => item.id?.toString()}
            style={styles.hospitalList}
            renderItem={({ item }: { item: any }) => (
              <Pressable onPress={() => confirmHospital(item.name)} style={[styles.hospitalItem, { borderColor: DARK_BORDER }]}>
                <View style={[styles.hospitalIcon, { backgroundColor: "rgba(255,82,82,0.15)" }]}>
                  <Feather name="plus-square" size={18} color="#FF5252" />
                </View>
                <View style={styles.hospitalInfo}>
                  <ThemedText style={styles.hospitalName}>{item.name}</ThemedText>
                  {item.address ? <ThemedText style={styles.hospitalAddr}>{item.address}</ThemedText> : null}
                </View>
                <Feather name="chevron-right" size={18} color="#475569" />
              </Pressable>
            )}
            ListEmptyComponent={
              <View style={styles.emptyHospital}>
                <Feather name="search" size={32} color="#475569" />
                <ThemedText style={styles.emptyText}>Nessuna struttura trovata</ThemedText>
              </View>
            }
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", marginBottom: Spacing.sm },

  heroSection: { alignItems: "center", marginBottom: Spacing.xl },
  heroIcon: { marginBottom: Spacing.lg },
  heroGradient: { width: 80, height: 80, borderRadius: 40, justifyContent: "center", alignItems: "center" },
  heroTitle: { fontSize: 32, fontWeight: "800", color: "#FFFFFF", letterSpacing: 6, marginBottom: -4 },
  heroTitleAccent: { fontSize: 32, fontWeight: "800", color: "#00E676", letterSpacing: 10 },
  heroSub: { fontSize: 13, color: "#64748B", marginTop: Spacing.sm },

  telemetryRow: { flexDirection: "row", backgroundColor: "#111827", borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.xl },
  telemetryItem: { flex: 1, alignItems: "center" },
  telemetryLabel: { fontSize: 10, fontWeight: "700", color: "#475569", letterSpacing: 1, marginBottom: 4 },
  telemetryValue: { fontSize: 16, fontWeight: "700", color: "#E2E8F0", fontVariant: ["tabular-nums"] },
  telemetryDivider: { width: 1, marginVertical: 4 },

  modeCard: { borderWidth: 1, borderRadius: BorderRadius.xl, marginBottom: Spacing.md, overflow: "hidden" },
  modeGradientBg: { padding: Spacing.lg },
  modeRow: { flexDirection: "row", alignItems: "center" },
  modeIcon: { width: 52, height: 52, borderRadius: 26, justifyContent: "center", alignItems: "center" },
  modeText: { flex: 1, marginLeft: Spacing.md },
  modeLabel: { fontSize: 17, fontWeight: "800", letterSpacing: 1 },
  modeSub: { fontSize: 12, color: "#64748B", marginTop: 2 },

  featuresGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginTop: Spacing.md },
  featureChip: { flexDirection: "row", alignItems: "center", backgroundColor: "#111827", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, borderWidth: 1 },
  featureChipText: { fontSize: 12, color: "#94A3B8", marginLeft: Spacing.xs, fontWeight: "600" },

  missionHeader: { backgroundColor: "#111827", borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.sm },
  missionHeaderTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  missionLive: { flexDirection: "row", alignItems: "center" },
  livePulse: { position: "absolute", left: -3, width: 16, height: 16, borderRadius: 8, backgroundColor: "#FF1744" },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#FF1744", marginRight: 6 },
  liveLabel: { fontSize: 11, fontWeight: "800", color: "#FF1744", letterSpacing: 2 },
  missionType: { fontSize: 14, fontWeight: "700", letterSpacing: 1 },
  abortBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(255,23,68,0.15)", justifyContent: "center", alignItems: "center" },
  missionInfo: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  missionVehicle: { fontSize: 13, fontWeight: "700", color: "#94A3B8" },
  missionDot: { width: 4, height: 4, borderRadius: 2, marginHorizontal: 8 },
  missionLocation: { fontSize: 13, color: "#64748B" },

  telemetryPanel: { backgroundColor: "#111827", borderRadius: BorderRadius.lg, borderWidth: 1, marginBottom: Spacing.md, overflow: "hidden" },
  telemetryGrid: { flexDirection: "row", padding: Spacing.md },
  telemetryCell: { flex: 1, alignItems: "center" },
  telemetrySep: { width: 1, marginVertical: 4 },
  tLabel: { fontSize: 9, fontWeight: "700", color: "#475569", letterSpacing: 1.5, marginBottom: 4 },
  tValueLarge: { fontSize: 18, fontWeight: "700", color: "#E2E8F0", fontVariant: ["tabular-nums"] },
  speedRow: { flexDirection: "row", alignItems: "baseline" },
  speedUnit: { fontSize: 10, color: "#475569", marginLeft: 2, fontWeight: "600" },
  coordsRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: 6, borderTopWidth: 1 },
  coordsText: { fontSize: 10, color: "#475569", marginLeft: 6, fontVariant: ["tabular-nums"], fontWeight: "600", letterSpacing: 0.5 },

  patientBanner: { flexDirection: "row", alignItems: "center", backgroundColor: "#111827", padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, marginBottom: Spacing.md },
  codiceBadge: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.sm },
  codiceBadgeText: { fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  patientInfo: { flex: 1, marginLeft: Spacing.md },
  patientInfoTitle: { fontSize: 13, fontWeight: "600", color: "#E2E8F0" },

  timelineSection: { marginBottom: Spacing.md },
  timelineRow: { flexDirection: "row", minHeight: 48 },
  timelineLeft: { width: 32, alignItems: "center" },
  timelineDot: { width: 24, height: 24, borderRadius: 12, justifyContent: "center", alignItems: "center", zIndex: 1 },
  timelineLine: { width: 2, flex: 1, marginVertical: 2 },
  timelineContent: { flex: 1, marginLeft: Spacing.sm, paddingVertical: 6, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: 4 },
  timelineContentRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  timelineLabel: { fontSize: 13, fontWeight: "700", letterSpacing: 0.5 },
  timelineTime: { fontSize: 12, fontWeight: "700", fontVariant: ["tabular-nums"] },
  timelineAddr: { fontSize: 11, color: "#64748B", marginTop: 2 },
  hospitalTag: { flexDirection: "row", alignItems: "center", marginTop: 3, backgroundColor: "rgba(255,82,82,0.1)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: "flex-start" },
  hospitalTagText: { fontSize: 11, color: "#FF5252", marginLeft: 4, fontWeight: "600" },

  captureContainer: { alignItems: "center", marginVertical: Spacing.lg },
  captureOuter: { width: 160, height: 160, borderRadius: 80, borderWidth: 3, justifyContent: "center", alignItems: "center", padding: 6 },
  captureRing: { position: "absolute", width: 170, height: 170, borderRadius: 85, borderWidth: 2 },
  captureInner: { width: "100%", height: "100%", borderRadius: 75, justifyContent: "center", alignItems: "center" },
  captureText: { fontSize: 14, fontWeight: "800", color: "#FFFFFF", letterSpacing: 1, marginTop: 8 },

  progressSection: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  progressTrack: { flex: 1, height: 4, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 2 },
  progressText: { fontSize: 12, fontWeight: "700", color: "#475569" },

  completePanel: { borderWidth: 1, borderRadius: BorderRadius.xl, overflow: "hidden", marginVertical: Spacing.lg },
  completeBg: { padding: Spacing.xl, alignItems: "center" },
  completeTitle: { fontSize: 18, fontWeight: "800", color: "#E2E8F0", letterSpacing: 1, marginTop: Spacing.md },
  completeSummary: { flexDirection: "row", marginTop: Spacing.xl, width: "100%" },
  completeItem: { flex: 1, alignItems: "center" },
  completeValue: { fontSize: 18, fontWeight: "700", fontVariant: ["tabular-nums"] },
  completeLabel: { fontSize: 10, color: "#64748B", marginTop: 2, fontWeight: "600", letterSpacing: 0.5 },
  completeDivider: { width: 1, marginVertical: 4 },

  pdfBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#00B4D8", paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl, borderRadius: BorderRadius.lg, marginTop: Spacing.xl },
  pdfBtnText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF", marginLeft: Spacing.sm, letterSpacing: 0.5 },
  newBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: Spacing.md, paddingVertical: Spacing.sm },
  newBtnText: { fontSize: 13, fontWeight: "700", marginLeft: Spacing.sm, letterSpacing: 0.5 },

  modalWrap: { flex: 1 },
  modalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1 },
  modalClose: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  modalTitle: { fontSize: 16, fontWeight: "700", color: "#E2E8F0", letterSpacing: 0.5 },
  modalBody: { flex: 1, padding: Spacing.lg },
  modalFooter: { padding: Spacing.lg, borderTopWidth: 1, backgroundColor: "#0A0E17" },

  fieldLabel: { fontSize: 11, fontWeight: "700", color: "#64748B", letterSpacing: 1.5, marginBottom: Spacing.sm },
  codiceRow: { flexDirection: "row", gap: Spacing.sm },
  codiceBtn: { flex: 1, paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, alignItems: "center", borderWidth: 2 },
  codiceBtnText: { fontSize: 13, fontWeight: "800", letterSpacing: 0.5, marginTop: 4 },

  input: { height: 48, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, fontSize: 15, borderWidth: 1 },
  inputArea: { height: 80, paddingTop: Spacing.md, textAlignVertical: "top" },
  inputRow: { flexDirection: "row", marginTop: Spacing.lg },
  sessoRow: { flexDirection: "row", gap: Spacing.sm },
  sessoBtn: { flex: 1, height: 48, justifyContent: "center", alignItems: "center", borderRadius: BorderRadius.md, borderWidth: 1 },
  sessoText: { fontSize: 16, fontWeight: "700" },

  confirmBtn: { height: 52, borderRadius: BorderRadius.lg, justifyContent: "center", alignItems: "center" },
  confirmBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700", letterSpacing: 0.5 },

  searchBar: { flexDirection: "row", alignItems: "center", margin: Spacing.lg, paddingHorizontal: Spacing.md, height: 48, backgroundColor: "#111827", borderRadius: BorderRadius.md, borderWidth: 1, borderColor: "#1E293B" },
  searchInput: { flex: 1, marginLeft: Spacing.sm, fontSize: 15 },
  hospitalList: { flex: 1, paddingHorizontal: Spacing.lg },
  hospitalItem: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.md, borderBottomWidth: 1 },
  hospitalIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  hospitalInfo: { flex: 1, marginLeft: Spacing.md },
  hospitalName: { fontSize: 14, fontWeight: "600", color: "#E2E8F0" },
  hospitalAddr: { fontSize: 12, color: "#64748B", marginTop: 2 },
  emptyHospital: { alignItems: "center", paddingTop: Spacing["3xl"] },
  emptyText: { fontSize: 14, color: "#475569", marginTop: Spacing.md },

  templateModeIcon: { width: 60, height: 60, borderRadius: 30, justifyContent: "center", alignItems: "center", marginBottom: Spacing.md },
  templateTitle: { fontSize: 22, fontWeight: "800", color: "#FFFFFF", letterSpacing: 2 },
  templateSub: { fontSize: 13, color: "#64748B", marginTop: 4 },
  templateGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md },
  templateCardWrapper: { width: (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.md) / 2 },
  templateCard: { borderWidth: 1, borderRadius: BorderRadius.xl, overflow: "hidden" },
  templateCardGradient: { padding: Spacing.lg, alignItems: "center", minHeight: 120, justifyContent: "center" },
  templateIconWrap: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center", marginBottom: Spacing.sm },
  templateCardLabel: { fontSize: 12, fontWeight: "700", textAlign: "center", letterSpacing: 0.5 },
  templateCodiceDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  templateBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,180,216,0.1)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginLeft: 8 },
  templateBadgeText: { fontSize: 10, color: "#00B4D8", fontWeight: "600" },
  mapContainer: { marginTop: Spacing.lg, marginBottom: Spacing.md, width: "100%" },
  mapTitle: { fontSize: 12, fontWeight: "700", color: "#475569", letterSpacing: 1.5, marginBottom: Spacing.sm },
  mapWrapper: { borderRadius: BorderRadius.lg, overflow: "hidden", borderWidth: 1, borderColor: "#1E293B" },
  map: { width: "100%", height: 280 },
  shareBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: Spacing.md, paddingVertical: Spacing.sm },
  savingRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: Spacing.lg },
});
