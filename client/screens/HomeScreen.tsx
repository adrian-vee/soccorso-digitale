import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  Platform,
  Pressable,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  SlideInRight,
} from "react-native-reanimated";
import NetInfo from "@react-native-community/netinfo";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { HeartbeatWidget } from "@/components/HeartbeatWidget";
import { HandoffWidget } from "@/components/HandoffWidget";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl, getAuthToken } from "@/lib/query-client";
import * as Location from "expo-location";
import { WeatherBadge } from "@/components/WeatherBadge";
import { HolidayChip } from "@/components/HolidayChip";
import { EmergencyAlertBanner } from "@/components/EmergencyAlertBanner";


function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Buongiorno";
  if (hour >= 12 && hour < 18) return "Buon pomeriggio";
  if (hour >= 18 && hour < 22) return "Buonasera";
  return "Buonanotte";
}

export default function HomeScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { user, refreshUserData } = useAuth();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  
  const [isOnline, setIsOnline] = useState(true);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoDescription, setPhotoDescription] = useState("");
  const [photoSending, setPhotoSending] = useState(false);
  const [photoSubmitterName, setPhotoSubmitterName] = useState("");
  const [reportsExpanded, setReportsExpanded] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);

  const statusPulse = useSharedValue(1);
  const betaPulse = useSharedValue(0.4);

  useEffect(() => {
    refreshUserData();
  }, []);

  // Fetch cached device location for weather widget (no permission dialog)
  useEffect(() => {
    Location.getLastKnownPositionAsync()
      .then((pos) => {
        if (pos) {
          setUserCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        } else {
          // Fallback: Legnago (sede principale)
          setUserCoords({ lat: 45.1553, lon: 11.307 });
        }
      })
      .catch(() => {
        setUserCoords({ lat: 45.1553, lon: 11.307 });
      });
  }, []);

  const vehicleCode = user?.vehicle?.code || "---";
  const locationName = user?.location?.name || "---";
  const greeting = getGreeting();

  const { data: checklistStatus } = useQuery<{ completed: boolean; completedAt?: string }>({
    queryKey: ["/api/vehicle-checklists", user?.vehicle?.id, "today-status"],
    queryFn: async () => {
      if (!user?.vehicle?.id) return { completed: false };
      const token = await getAuthToken();
      const url = new URL(`/api/vehicle-checklists/${user.vehicle.id}/today`, getApiUrl());
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(url.toString(), { credentials: "include", headers });
      if (!res.ok) return { completed: false };
      const data = await res.json();
      return { completed: !!data, completedAt: data?.completedAt };
    },
    enabled: !!user?.vehicle?.id,
    refetchInterval: 60000,
  });

  const { data: vehicleData } = useQuery<{ currentKm: number }>({
    queryKey: ["/api/vehicles", user?.vehicle?.id, "current"],
    queryFn: async () => {
      if (!user?.vehicle?.id) return { currentKm: 0 };
      const token = await getAuthToken();
      const url = new URL(`/api/vehicles/${user.vehicle.id}`, getApiUrl());
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(url.toString(), { credentials: "include", headers });
      if (!res.ok) return { currentKm: 0 };
      const data = await res.json();
      return { currentKm: data.currentKm || 0 };
    },
    enabled: !!user?.vehicle?.id,
    refetchInterval: 30000,
  });

  const { data: expiryAlerts } = useQuery<Array<{ id: string; label: string; expiryDate: string; daysUntilExpiry: number }>>({
    queryKey: ["/api/expiry-alerts"],
    enabled: !!user?.vehicle?.id,
    refetchInterval: 300000,
  });

  const expiredCount = expiryAlerts?.filter(item => item.daysUntilExpiry <= 0).length || 0;
  const expiringCount = expiryAlerts?.filter(item => item.daysUntilExpiry > 0 && item.daysUntilExpiry <= 15).length || 0;

  const myReportsFetcher = useCallback(async () => {
    const url = new URL("/api/checklist-photos/my-reports", getApiUrl());
    const token = await getAuthToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(url.toString(), { credentials: "include", headers });
    if (!res.ok) return [];
    return res.json();
  }, []);

  const { data: myReports = [], refetch: refetchReports } = useQuery<any[]>({
    queryKey: ["/api/checklist-photos/my-reports"],
    queryFn: myReportsFetcher,
    enabled: !!user,
    refetchInterval: reportsExpanded ? 10000 : 30000,
  });

  useEffect(() => {
    if (!selectedReport) return;
    const reportId = selectedReport.id;
    const interval = setInterval(async () => {
      try {
        const result = await myReportsFetcher();
        queryClient.setQueryData(["/api/checklist-photos/my-reports"], result);
        const updated = result.find((r: any) => r.id === reportId);
        if (updated) setSelectedReport(updated);
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedReport?.id]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected === true && state.isInternetReachable !== false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    statusPulse.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    betaPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const statusAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: statusPulse.value }],
  }));

  const betaPulseStyle = useAnimatedStyle(() => ({
    opacity: betaPulse.value,
    transform: [{ scale: 0.6 + betaPulse.value * 0.4 }],
  }));

  const checklistDone = checklistStatus?.completed || false;
  const currentKm = vehicleData?.currentKm || 0;

  const unreadCount = myReports.filter((r: any) => !r.isRead).length;
  const resolvedCount = myReports.filter((r: any) => r.isResolved).length;
  const pendingCount = myReports.filter((r: any) => !r.isResolved).length;

  const pickPhotoFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permesso Necessario", "Consenti l'accesso alla fotocamera per scattare foto.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      base64: true,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const pickPhotoFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permesso Necessario", "Consenti l'accesso alla galleria per selezionare foto.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      base64: true,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleSendPhoto = async () => {
    if (!photoUri) return;
    setPhotoSending(true);
    try {
      let base64Data = "";
      const response = await fetch(photoUri);
      const blob = await response.blob();
      base64Data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          resolve(dataUrl.split(",")[1] || "");
        };
        reader.readAsDataURL(blob);
      });

      const token = await getAuthToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      
      const apiUrl = new URL("/api/checklist-photos", getApiUrl());
      const res = await fetch(apiUrl.toString(), {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          photoBase64: base64Data,
          description: photoDescription.trim() || null,
          checklistId: null,
          submitterName: photoSubmitterName.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Errore" }));
        throw new Error(err.error || "Errore nell'invio");
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Segnalazione Inviata", "La segnalazione e stata inviata al responsabile.");
      setPhotoModalVisible(false);
      setPhotoUri(null);
      setPhotoDescription("");
      setPhotoSubmitterName("");
      queryClient.invalidateQueries({ queryKey: ["/api/checklist-photos/my-reports"] });
    } catch (error: any) {
      Alert.alert("Errore", error.message || "Impossibile inviare la segnalazione");
    } finally {
      setPhotoSending(false);
    }
  };

  const handleOpenReport = (report: any) => {
    setSelectedReport(report);
    myReportsFetcher().then((result) => {
      queryClient.setQueryData(["/api/checklist-photos/my-reports"], result);
      const updated = result.find((r: any) => r.id === report.id);
      if (updated) setSelectedReport(updated);
    }).catch(() => {});
  };

  const handleCloseReport = () => {
    setSelectedReport(null);
    refetchReports();
  };

  const closePhotoModal = () => {
    setPhotoModalVisible(false);
    setPhotoUri(null);
    setPhotoDescription("");
    setPhotoSubmitterName("");
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <LinearGradient
        colors={isDark 
          ? [theme.backgroundRoot, "#0a1628", "#0d1f3c"]
          : ["#f8fafc", "#eef5f9", "#e4eff5"]
        }
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.md, paddingBottom: tabBarHeight + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        
        {/* Header - Identity & Status */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.header}>
          <View style={styles.identityContainer}>
            <ThemedText type="small" style={{ color: theme.textSecondary, letterSpacing: 1 }}>
              {greeting.toUpperCase()}
            </ThemedText>
            <View style={styles.vehicleRow}>
              <ThemedText type="h1" style={[styles.vehicleCode, { color: theme.text }]}>
                {vehicleCode}
              </ThemedText>
              <View style={[
                styles.onlineChip,
                { backgroundColor: isOnline ? theme.success + "18" : theme.error + "18" }
              ]}>
                <Animated.View style={statusAnimatedStyle}>
                  <View style={[
                    styles.onlineDot,
                    { backgroundColor: isOnline ? theme.success : theme.error }
                  ]} />
                </Animated.View>
                <ThemedText style={{ 
                  color: isOnline ? theme.success : theme.error,
                  fontWeight: "700",
                  fontSize: 11,
                }}>
                  {isOnline ? "Online" : "Offline"}
                </ThemedText>
              </View>
            </View>
            <View style={styles.locationRow}>
              <Feather name="map-pin" size={11} color={theme.primary} />
              <ThemedText type="small" style={{ color: theme.primary, marginLeft: 4, fontWeight: "500", flexShrink: 1 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                {locationName}
              </ThemedText>
            </View>
          </View>
          
          <View style={styles.statusColumn}>
            <LinearGradient
              colors={["#0066CC", "#00A651"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.betaPillSmall}
            >
              <View style={styles.betaDotSmall}>
                <Animated.View style={[styles.betaDotInnerSmall, betaPulseStyle]} />
              </View>
              <ThemedText style={styles.betaLabelSmall}>BETA</ThemedText>
              <View style={styles.betaDividerSmall} />
              <ThemedText style={styles.betaVersionSmall}>v.2.0.0</ThemedText>
            </LinearGradient>
          </View>
        </Animated.View>

        {/* Servizi di Oggi Widget */}
        <Animated.View entering={FadeIn.delay(250).duration(600)} style={styles.widgetSection}>
          <Pressable
            onPress={() => navigation.navigate("Oggi")}
            style={({ pressed }) => [
              styles.oggiWidget,
              {
                backgroundColor: isDark ? "rgba(0, 102, 204, 0.12)" : "rgba(0, 102, 204, 0.06)",
                borderColor: theme.primary,
                opacity: pressed ? 0.8 : 1,
                flexDirection: "column",
                alignItems: "stretch",
              },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={[styles.oggiWidgetLeft, { flex: 1 }]}>
                <View style={[styles.oggiIconCircle, { backgroundColor: theme.primary }]}>
                  <Feather name="calendar" size={20} color="#fff" />
                </View>
                <View>
                  <ThemedText style={styles.oggiTitle}>Servizi di Oggi</ThemedText>
                  <ThemedText style={[styles.oggiSubtitle, { color: theme.textSecondary }]}>
                    Visualizza il programma giornaliero
                  </ThemedText>
                </View>
              </View>
              <Feather name="chevron-right" size={20} color={theme.textSecondary} />
            </View>
            {/* Meteo + Festivo row */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, marginLeft: 48, flexWrap: "wrap" }}>
              <HolidayChip date={new Date()} />
              {userCoords && (
                <WeatherBadge lat={userCoords.lat} lon={userCoords.lon} compact />
              )}
            </View>
          </Pressable>
        </Animated.View>

        {/* Heartbeat Widget - Real-time Stats */}
        <Animated.View entering={FadeIn.delay(300).duration(600)} style={styles.widgetSection}>
          <HeartbeatWidget />
        </Animated.View>

        {/* Handoff Widget - Crew Shift Handover */}
        <Animated.View entering={FadeIn.delay(400).duration(600)} style={styles.widgetSection}>
          <HandoffWidget />
        </Animated.View>

        {/* SLA Status Widget - hidden from mobile home */}

        {/* Expired Materials Alert */}
        {(expiredCount > 0 || expiringCount > 0) && (
          <Animated.View entering={FadeIn.delay(450).duration(600)} style={styles.widgetSection}>
            <Pressable
              onPress={() => navigation.navigate("MaterialiScaduti")}
              style={[
                styles.expiredAlertCard,
                { 
                  backgroundColor: expiredCount > 0 
                    ? (isDark ? "rgba(220, 53, 69, 0.15)" : "rgba(220, 53, 69, 0.08)")
                    : (isDark ? "rgba(255, 193, 7, 0.15)" : "rgba(255, 193, 7, 0.08)"),
                  borderColor: expiredCount > 0 ? "#DC3545" : "#FFC107",
                }
              ]}
            >
              <View style={[
                styles.expiredIconCircle,
                { backgroundColor: expiredCount > 0 ? "#DC354520" : "#FFC10720" }
              ]}>
                <Feather 
                  name={expiredCount > 0 ? "alert-octagon" : "alert-triangle"} 
                  size={20} 
                  color={expiredCount > 0 ? "#DC3545" : "#FFC107"} 
                />
              </View>
              <View style={styles.expiredTextContainer}>
                <ThemedText type="body" style={{ fontWeight: "700", color: expiredCount > 0 ? "#DC3545" : "#FFC107" }}>
                  {expiredCount > 0 
                    ? `${expiredCount} materiale${expiredCount > 1 ? "i" : ""} scaduto${expiredCount > 1 ? "i" : ""}`
                    : `${expiringCount} materiale${expiringCount > 1 ? "i" : ""} in scadenza`
                  }
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 2 }}>
                  {expiredCount > 0 
                    ? "Da ripristinare urgentemente"
                    : "Verifica le scadenze"
                  }
                </ThemedText>
              </View>
              <Feather name="chevron-right" size={18} color={expiredCount > 0 ? "#DC3545" : "#FFC107"} />
            </Pressable>
          </Animated.View>
        )}

        {/* ============================================================ */}
        {/* CHECKLIST ALERT - Critical for ambulance operations */}
        {/* ============================================================ */}
        {!checklistDone && (
          <Animated.View entering={FadeIn.delay(500).duration(500)} style={styles.widgetSection}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                navigation.navigate("ProfileTab", { screen: "Checklist", initial: false });
              }}
              style={({ pressed }) => [
                styles.checklistAlertBanner,
                { transform: [{ scale: pressed ? 0.98 : 1 }] },
              ]}
            >
              <LinearGradient
                colors={["#DC3545", "#B71C1C"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.checklistAlertContent}>
                <Animated.View style={[styles.checklistAlertIconWrap, statusAnimatedStyle]}>
                  <Feather name="shield-off" size={20} color="#FFFFFF" />
                </Animated.View>
                <View style={styles.checklistAlertText}>
                  <ThemedText style={styles.checklistAlertTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                    CHECKLIST DA COMPLETARE
                  </ThemedText>
                  <ThemedText style={styles.checklistAlertSub} numberOfLines={1}>
                    Obbligatoria prima di ogni turno
                  </ThemedText>
                </View>
                <View style={styles.checklistAlertArrow}>
                  <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.9)" />
                </View>
              </View>
            </Pressable>
          </Animated.View>
        )}

        {checklistDone && (
          <Animated.View entering={FadeIn.delay(500).duration(500)} style={styles.widgetSection}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate("ProfileTab", { screen: "Checklist", initial: false });
              }}
              style={({ pressed }) => [
                styles.checklistAlertBanner,
                { transform: [{ scale: pressed ? 0.98 : 1 }] },
              ]}
            >
              <LinearGradient
                colors={["#00A651", "#00873F"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.checklistAlertContent}>
                <View style={styles.checklistAlertIconWrap}>
                  <Feather name="shield" size={20} color="#FFFFFF" />
                </View>
                <View style={styles.checklistAlertText}>
                  <ThemedText style={styles.checklistAlertTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                    CHECKLIST COMPLETATA
                  </ThemedText>
                  <ThemedText style={styles.checklistAlertSub} numberOfLines={1}>
                    Turno operativo confermato
                  </ThemedText>
                </View>
                <View style={styles.checklistAlertArrow}>
                  <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.9)" />
                </View>
              </View>
            </Pressable>
          </Animated.View>
        )}

        {/* MISSIONI PROGRAMMATE HUB - hidden, Hub in lavorazione */}

        {/* Protezione Civile Alerts */}
        <View style={{ marginTop: Spacing.md }}>
          <EmergencyAlertBanner region="Veneto" />
        </View>

        {/* ============================================================ */}
        {/* SEGNALAZIONE DANNI / PROBLEMI MEZZO */}
        {/* ============================================================ */}
        <Animated.View entering={FadeInUp.delay(600).duration(500)} style={styles.widgetSection}>
          <LinearGradient
            colors={['rgba(0, 102, 204, 0.12)', 'rgba(0, 166, 81, 0.08)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.segnalazioneCard, { borderColor: isDark ? "rgba(0,100,197,0.15)" : "rgba(0,100,197,0.12)" }]}
          >
            <View style={styles.segnalazioneTopBanner}>
              <View style={styles.segnalazioneBannerContent}>
                <View style={[styles.segnalazioneBannerIcon, { backgroundColor: "rgba(0,100,197,0.15)" }]}>
                  <Feather name="alert-triangle" size={16} color={theme.primary} />
                </View>
                <View style={{ flex: 1, marginRight: 4 }}>
                  <ThemedText type="body" style={{ fontWeight: "700", fontSize: 14 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Segnala un problema</ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 11, marginTop: 1 }} numberOfLines={1}>
                    Danni al mezzo o guasti
                  </ThemedText>
                </View>
                <Pressable
                  onPress={() => {
                    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setPhotoModalVisible(true);
                  }}
                  style={({ pressed }) => [
                    styles.segnalazioneNewBtn,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Feather name="camera" size={14} color="#0064C5" />
                  <ThemedText style={{ color: "#0064C5", fontSize: 12, fontWeight: "700" }} numberOfLines={1}>Segnala</ThemedText>
                </Pressable>
              </View>
            </View>

            {myReports.length > 0 ? (
              <View style={styles.segnalazioneListContainer}>
                <Pressable
                  onPress={() => setReportsExpanded(!reportsExpanded)}
                  style={styles.segnalazioneListHeader}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: "600", fontSize: 11 }}>
                      LE TUE SEGNALAZIONI ({myReports.length})
                    </ThemedText>
                    {pendingCount > 0 ? (
                      <View style={[styles.segnalazionePill, { backgroundColor: "rgba(255,193,7,0.15)" }]}>
                        <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: "#FFC107" }} />
                        <ThemedText style={{ fontSize: 9, color: "#E6A800", fontWeight: "700" }}>{pendingCount} in attesa</ThemedText>
                      </View>
                    ) : null}
                    {unreadCount > 0 ? (
                      <View style={styles.segnalazioneBadge}>
                        <ThemedText style={styles.segnalazioneBadgeText}>{unreadCount}</ThemedText>
                      </View>
                    ) : null}
                  </View>
                  <Feather name={reportsExpanded ? "chevron-up" : "chevron-down"} size={16} color={theme.textSecondary} />
                </Pressable>
                {reportsExpanded ? (
                  myReports.map((report: any, index: number) => {
                    const reportDate = new Date(report.createdAt);
                    const isUnread = !report.isRead;
                    const statusColor = report.isResolved ? "#00A651" : (report.isRead ? "#0064C5" : "#FFC107");
                    const statusIcon = report.isResolved ? "check-circle" : (report.isRead ? "eye" : "clock");
                    const statusLabel = report.isResolved ? "Risolto" : (report.isRead ? "Presa visione" : "In attesa");
                    return (
                      <Pressable
                        key={report.id}
                        onPress={() => handleOpenReport(report)}
                        style={({ pressed }) => [
                          styles.segnalazioneListItem,
                          { 
                            backgroundColor: isUnread 
                              ? (isDark ? "rgba(0,100,197,0.06)" : "rgba(0,100,197,0.03)")
                              : "transparent",
                            opacity: pressed ? 0.7 : 1,
                          },
                          index < myReports.length - 1 ? { borderBottomWidth: 1, borderBottomColor: theme.border } : undefined,
                        ]}
                      >
                        <View style={[styles.segnalazioneStatusDot, { backgroundColor: statusColor + "20" }]}>
                          <Feather name={statusIcon as any} size={12} color={statusColor} />
                        </View>
                        <View style={{ flex: 1, gap: 1 }}>
                          <ThemedText type="small" style={{ color: theme.text, fontWeight: isUnread ? "700" : "500", fontSize: 12 }} numberOfLines={1}>
                            {report.description || "Segnalazione"}
                          </ThemedText>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <ThemedText style={{ fontSize: 10, color: theme.textSecondary }}>
                              {report.submittedByName || "Operatore"}
                            </ThemedText>
                            <ThemedText style={{ fontSize: 10, color: theme.textSecondary }}>
                              {reportDate.toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
                            </ThemedText>
                            <View style={[styles.segnalazioneStatusPill, { backgroundColor: statusColor + "15" }]}>
                              <ThemedText style={{ fontSize: 9, color: statusColor, fontWeight: "600" }}>{statusLabel}</ThemedText>
                            </View>
                            {(report.messages || []).length > 0 ? (
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                                <Feather name="message-circle" size={9} color={theme.textSecondary} />
                                <ThemedText style={{ fontSize: 9, color: theme.textSecondary }}>{(report.messages || []).length}</ThemedText>
                              </View>
                            ) : null}
                          </View>
                        </View>
                        <Feather name="chevron-right" size={14} color={theme.textSecondary} />
                      </Pressable>
                    );
                  })
                ) : null}
              </View>
            ) : (
              <View style={styles.segnalazioneEmpty}>
                <Feather name="check-circle" size={16} color="#00A651" />
                <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 12, marginLeft: 8 }}>
                  Nessuna segnalazione attiva
                </ThemedText>
              </View>
            )}
          </LinearGradient>
        </Animated.View>

      </ScrollView>

      {/* ============================================================ */}
      {/* MODAL: Nuova Segnalazione */}
      {/* ============================================================ */}
      <Modal
        visible={photoModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closePhotoModal}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Pressable style={{ flex: 1 }} onPress={closePhotoModal} />
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.modalHandle} />
            
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                <LinearGradient
                  colors={["#0064C5", "#0080E0"]}
                  style={styles.modalTitleIcon}
                >
                  <Feather name="shield" size={14} color="#FFFFFF" />
                </LinearGradient>
                <ThemedText type="h3" style={{ marginLeft: Spacing.sm }}>Segnalazione Stato Mezzo</ThemedText>
              </View>
              <Pressable onPress={closePhotoModal} hitSlop={12}>
                <Feather name="x" size={22} color={theme.textSecondary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {photoUri ? (
                <View style={styles.photoPreviewContainer}>
                  <Image
                    source={{ uri: photoUri }}
                    style={styles.photoPreview}
                    resizeMode="cover"
                  />
                  <Pressable
                    style={[styles.removePhotoButton, { backgroundColor: "rgba(220,53,69,0.9)" }]}
                    onPress={() => setPhotoUri(null)}
                  >
                    <Feather name="x" size={14} color="#FFFFFF" />
                  </Pressable>
                </View>
              ) : (
                <View style={styles.photoPickerRow}>
                  <Pressable
                    style={[styles.photoPickerButton, { 
                      backgroundColor: isDark ? "rgba(0,100,197,0.1)" : "rgba(0,100,197,0.05)",
                      borderColor: isDark ? "rgba(0,100,197,0.3)" : "rgba(0,100,197,0.2)",
                    }]}
                    onPress={pickPhotoFromCamera}
                  >
                    <LinearGradient
                      colors={["#0064C5", "#0080E0"]}
                      style={styles.pickerIconCircle}
                    >
                      <Feather name="camera" size={24} color="#FFFFFF" />
                    </LinearGradient>
                    <ThemedText type="body" style={{ color: "#0064C5", fontWeight: "600", marginTop: Spacing.sm, fontSize: 13 }}>
                      Fotocamera
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    style={[styles.photoPickerButton, { 
                      backgroundColor: isDark ? "rgba(0,166,81,0.1)" : "rgba(0,166,81,0.05)",
                      borderColor: isDark ? "rgba(0,166,81,0.3)" : "rgba(0,166,81,0.2)",
                    }]}
                    onPress={pickPhotoFromGallery}
                  >
                    <LinearGradient
                      colors={["#00A651", "#00C462"]}
                      style={styles.pickerIconCircle}
                    >
                      <Feather name="image" size={24} color="#FFFFFF" />
                    </LinearGradient>
                    <ThemedText type="body" style={{ color: "#00A651", fontWeight: "600", marginTop: Spacing.sm, fontSize: 13 }}>
                      Galleria
                    </ThemedText>
                  </Pressable>
                </View>
              )}

              <View style={{ marginTop: Spacing.md }}>
                <ThemedText type="small" style={{ color: theme.error, fontWeight: "600", marginBottom: 4, fontSize: 11 }}>
                  * Campo obbligatorio
                </ThemedText>
                <TextInput
                  style={[styles.inputField, {
                    borderColor: !photoSubmitterName.trim() && photoUri ? theme.error : (isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"),
                    color: theme.text,
                    backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
                  }]}
                  placeholder="Il tuo nome e cognome *"
                  placeholderTextColor={theme.textSecondary}
                  value={photoSubmitterName}
                  onChangeText={setPhotoSubmitterName}
                  multiline={false}
                />
              </View>

              <TextInput
                style={[styles.inputField, { 
                  borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
                  color: theme.text, 
                  backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
                  marginTop: Spacing.sm,
                  minHeight: 70,
                  textAlignVertical: "top",
                }]}
                placeholder="Descrivi il problema (opzionale)..."
                placeholderTextColor={theme.textSecondary}
                value={photoDescription}
                onChangeText={setPhotoDescription}
                multiline
                numberOfLines={3}
              />

              <Pressable
                style={[
                  styles.sendButton,
                  {
                    opacity: photoSending ? 0.6 : 1,
                  },
                ]}
                onPress={handleSendPhoto}
                disabled={!photoUri || !photoSubmitterName.trim() || photoSending}
              >
                <LinearGradient
                  colors={photoUri && photoSubmitterName.trim() ? ["#0064C5", "#0080E0"] : [theme.border, theme.border]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.sendButtonGradient}
                >
                  {photoSending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Feather name="send" size={16} color="#FFFFFF" />
                      <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "700", marginLeft: Spacing.sm, fontSize: 14 }}>
                        INVIA SEGNALAZIONE
                      </ThemedText>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
              <View style={{ height: Spacing.lg }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL: Dettaglio Segnalazione */}
      {/* ============================================================ */}
      <Modal
        visible={!!selectedReport}
        transparent
        animationType="slide"
        onRequestClose={handleCloseReport}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Pressable style={{ flex: 1 }} onPress={handleCloseReport} />
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground, maxHeight: "90%" }]}>
            <View style={styles.modalHandle} />
            
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                <LinearGradient
                  colors={["#0064C5", "#0080E0"]}
                  style={styles.modalTitleIcon}
                >
                  <Feather name="file-text" size={14} color="#FFFFFF" />
                </LinearGradient>
                <ThemedText type="h3" style={{ marginLeft: Spacing.sm }}>Dettaglio Segnalazione</ThemedText>
              </View>
              <Pressable onPress={handleCloseReport} hitSlop={12}>
                <Feather name="x" size={22} color={theme.textSecondary} />
              </Pressable>
            </View>

            {selectedReport && (
              <>
                <View style={[styles.reportDetailHeader, { backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)" }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: Spacing.xs }}>
                    <Feather name="calendar" size={13} color={theme.textSecondary} />
                    <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.xs, fontSize: 11 }}>
                      {new Date(selectedReport.createdAt).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })} alle {new Date(selectedReport.createdAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                    </ThemedText>
                  </View>
                  {selectedReport.description ? (
                    <ThemedText type="small" style={{ color: theme.text, marginBottom: Spacing.xs }}>
                      {selectedReport.description}
                    </ThemedText>
                  ) : null}
                  <View style={{ flexDirection: "row", gap: 4, flexWrap: "wrap" }}>
                    {selectedReport.isResolved ? (
                      <View style={[styles.signalBadge, { backgroundColor: isDark ? "rgba(0,166,81,0.15)" : "rgba(0,166,81,0.1)" }]}>
                        <Feather name="check-circle" size={8} color="#00A651" />
                        <ThemedText style={{ color: "#00A651", fontSize: 9, marginLeft: 2, fontWeight: "600" }}>Risolta</ThemedText>
                      </View>
                    ) : selectedReport.isRead ? (
                      <View style={[styles.signalBadge, { backgroundColor: isDark ? "rgba(0,100,197,0.15)" : "rgba(0,100,197,0.1)" }]}>
                        <Feather name="eye" size={8} color="#0064C5" />
                        <ThemedText style={{ color: "#0064C5", fontSize: 9, marginLeft: 2, fontWeight: "600" }}>Presa visione</ThemedText>
                      </View>
                    ) : (
                      <View style={[styles.signalBadge, { backgroundColor: isDark ? "rgba(255,193,7,0.15)" : "rgba(255,193,7,0.1)" }]}>
                        <Feather name="clock" size={8} color="#E6A700" />
                        <ThemedText style={{ color: "#E6A700", fontSize: 9, marginLeft: 2, fontWeight: "600" }}>In attesa</ThemedText>
                      </View>
                    )}
                  </View>
                </View>

                <ScrollView style={{ flex: 1, marginVertical: Spacing.sm }} showsVerticalScrollIndicator={false}>
                  {(selectedReport.messages || []).length === 0 ? (
                    <View style={{ alignItems: "center", paddingVertical: Spacing.xl }}>
                      <Feather name="message-circle" size={28} color={theme.textSecondary} />
                      <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
                        Nessun messaggio
                      </ThemedText>
                    </View>
                  ) : (
                    (selectedReport.messages || []).map((msg: any, idx: number) => {
                      const isAdmin = msg.senderType === "admin";
                      return (
                        <View
                          key={idx}
                          style={[
                            styles.messageBubble,
                            isAdmin ? styles.messageBubbleLeft : styles.messageBubbleRight,
                            { backgroundColor: isAdmin 
                              ? (isDark ? "rgba(0,100,197,0.15)" : "rgba(0,100,197,0.08)") 
                              : (isDark ? "rgba(0,166,81,0.15)" : "rgba(0,166,81,0.08)") 
                            },
                          ]}
                        >
                          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }}>
                            <ThemedText type="small" style={{ fontWeight: "600", color: isAdmin ? "#0064C5" : "#00A651", fontSize: 11 }}>
                              {msg.senderName || (isAdmin ? "Responsabile" : (selectedReport?.submittedByName || "Equipaggio"))}
                            </ThemedText>
                            <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 10 }}>
                              {new Date(msg.createdAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                            </ThemedText>
                          </View>
                          <ThemedText type="small" style={{ color: theme.text }}>
                            {msg.message}
                          </ThemedText>
                        </View>
                      );
                    })
                  )}
                </ScrollView>

                <View style={[styles.reportDetailFooter, { borderTopColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Feather name="info" size={12} color={theme.textSecondary} />
                    <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 11, fontStyle: "italic" }}>
                      Le risposte vengono inviate dal responsabile
                    </ThemedText>
                  </View>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  identityContainer: {
    flex: 1,
    minWidth: 0,
  },
  vehicleCode: {
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -1,
    lineHeight: 38,
    marginTop: 2,
    flexShrink: 1,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    flexShrink: 1,
  },
  vehicleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "nowrap",
  },
  onlineChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    gap: 5,
    marginBottom: 4,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusColumn: {
    alignItems: "flex-end",
  },
  betaPillSmall: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    gap: 6,
  },
  betaDotSmall: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  betaDotInnerSmall: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
  },
  betaLabelSmall: {
    fontSize: 9,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 2,
  },
  betaDividerSmall: {
    width: 1,
    height: 10,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  betaVersionSmall: {
    fontSize: 9,
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
    letterSpacing: 0.3,
  },
  widgetSection: {
    marginTop: Spacing.md,
  },
  oggiWidget: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
  },
  oggiWidgetLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  oggiIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  oggiTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  oggiSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  expiredAlertCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
  },
  expiredIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  expiredTextContainer: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  checklistAlertBanner: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  checklistAlertContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    gap: 12,
  },
  checklistAlertIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  checklistAlertText: {
    flex: 1,
  },
  checklistAlertTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  checklistAlertSub: {
    fontSize: 11,
    color: "rgba(255,255,255,0.75)",
    marginTop: 1,
  },
  checklistAlertArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  checklistDoneBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
  },
  checklistDoneIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0,166,81,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  checklistDoneText: {
    fontSize: 13,
    fontWeight: "600",
  },
  segnalazioneCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  segnalazioneTopBanner: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  segnalazioneBannerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  segnalazioneBannerIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  segnalazioneNewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
  },
  segnalazioneListContainer: {
    paddingBottom: 4,
  },
  segnalazioneListHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: 6,
  },
  segnalazionePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  segnalazioneBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#DC3545",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  segnalazioneBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  segnalazioneListItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    gap: 8,
  },
  segnalazioneStatusDot: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  segnalazioneStatusPill: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  segnalazioneEmpty: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
  },
  signalBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.lg,
    maxHeight: "82%",
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(128,128,128,0.3)",
    alignSelf: "center",
    marginBottom: Spacing.md,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  modalTitleIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  photoPreviewContainer: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    position: "relative",
  },
  photoPreview: {
    width: "100%",
    height: 200,
    borderRadius: BorderRadius.lg,
  },
  removePhotoButton: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  photoPickerRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  photoPickerButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderStyle: "dashed",
  },
  pickerIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  inputField: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 14,
  },
  sendButton: {
    marginTop: Spacing.md,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  sendButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
  },

  reportDetailHeader: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  messageBubble: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    maxWidth: "85%",
  },
  messageBubbleLeft: {
    alignSelf: "flex-start",
    borderBottomLeftRadius: BorderRadius.xs,
  },
  messageBubbleRight: {
    alignSelf: "flex-end",
    borderBottomRightRadius: BorderRadius.xs,
  },
  reportDetailFooter: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    paddingBottom: Spacing.xs,
  },
});
