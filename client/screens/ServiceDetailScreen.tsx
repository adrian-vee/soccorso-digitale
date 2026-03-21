import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useHeaderHeight } from "@react-navigation/elements";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface ScheduledService {
  id: string;
  progressiveCode: string | null;
  scheduledTime: string | null;
  serviceType: string | null;
  gender: string | null;
  hasPatient: boolean;
  patientName: string | null;
  originName: string | null;
  originAddress: string | null;
  originCity: string | null;
  originProvince: string | null;
  originFloor: string | null;
  destinationName: string | null;
  destinationAddress: string | null;
  destinationCity: string | null;
  destinationProvince: string | null;
  destinationFloor: string | null;
  estimatedKm: number | null;
  kmEstimated: number | null;
  transportMode: string | null;
  notes: string | null;
  status: string;
  actualStartTime: string | null;
  actualEndTime: string | null;
  startGpsLat: number | null;
  startGpsLng: number | null;
  endGpsLat: number | null;
  endGpsLng: number | null;
  kmStart: number | null;
  kmEnd: number | null;
  suspendReason: string | null;
  cancelReason: string | null;
  isEmptyTrip: boolean | null;
}

function getServiceTypeBadge(serviceType: string | null) {
  if (!serviceType) return { bg: "#eff6ff", color: "#1d4ed8", label: "Servizio" };
  const lower = serviceType.toLowerCase();
  if (lower.includes("specialistic") || lower.includes("prestazione")) {
    return { bg: "#dbeafe", color: "#1d4ed8", label: "Visita" };
  }
  if (lower.includes("dialisi") || lower.includes("emodialisi")) {
    return { bg: "#ede9fe", color: "#6d28d9", label: "Dialisi" };
  }
  if (lower.includes("dimission") || lower.includes("trasferim")) {
    return { bg: "#ffedd5", color: "#c2410c", label: "Trasferimento" };
  }
  if (lower.includes("emergenz") || lower.includes("urgenz")) {
    return { bg: "#fee2e2", color: "#dc2626", label: "Emergenza" };
  }
  return { bg: "#eff6ff", color: "#1d4ed8", label: serviceType };
}

function formatElapsed(startTime: string): string {
  const start = new Date(startTime).getTime();
  const now = Date.now();
  const diff = Math.max(0, Math.floor((now - start) / 1000));
  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return "--:--";
  const d = new Date(dateStr);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export default function ServiceDetailScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const queryClient = useQueryClient();
  const { serviceId } = route.params as { serviceId: string };

  const [elapsed, setElapsed] = useState("");
  const [suspendModalVisible, setSuspendModalVisible] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [reasonText, setReasonText] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);

  const { data: service, isLoading } = useQuery<ScheduledService>({
    queryKey: ["/api/scheduled-services", serviceId],
  });

  useEffect(() => {
    if ((service?.status === "in_progress" || service?.status === "waiting_for_visit") && service.actualStartTime) {
      setElapsed(formatElapsed(service.actualStartTime));
      const interval = setInterval(() => {
        setElapsed(formatElapsed(service.actualStartTime!));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [service?.status, service?.actualStartTime]);

  const invalidateQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/scheduled-services", serviceId] });
    queryClient.invalidateQueries({ queryKey: ["/api/mobile/today"] });
  }, [queryClient, serviceId]);

  const startMutation = useMutation({
    mutationFn: async (coords: { lat: number | null; lng: number | null }) => {
      return apiRequest("PATCH", `/api/mobile/scheduled-services/${serviceId}/start`, {
        lat: coords.lat,
        lng: coords.lng,
      });
    },
    onSuccess: invalidateQueries,
  });

  const suspendMutation = useMutation({
    mutationFn: async (reason: string) => {
      return apiRequest("PATCH", `/api/mobile/scheduled-services/${serviceId}/suspend`, { reason });
    },
    onSuccess: () => {
      invalidateQueries();
      navigation.goBack();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (reason: string) => {
      return apiRequest("PATCH", `/api/mobile/scheduled-services/${serviceId}/cancel`, { reason });
    },
    onSuccess: () => {
      invalidateQueries();
      navigation.goBack();
    },
  });

  const waitMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/mobile/scheduled-services/${serviceId}/wait`, {});
    },
    onSuccess: invalidateQueries,
  });

  const resumeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/mobile/scheduled-services/${serviceId}/resume`, {});
    },
    onSuccess: invalidateQueries,
  });

  const handleStart = async () => {
    setGpsLoading(true);
    let lat: number | null = null;
    let lng: number | null = null;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }
    } catch (e) {
      // GPS not available, proceed without
    }
    setGpsLoading(false);
    startMutation.mutate({ lat, lng });
  };

  const handleSuspendConfirm = () => {
    if (!reasonText.trim()) return;
    suspendMutation.mutate(reasonText.trim());
    setSuspendModalVisible(false);
    setReasonText("");
  };

  const handleCancelConfirm = () => {
    if (!reasonText.trim()) return;
    cancelMutation.mutate(reasonText.trim());
    setCancelModalVisible(false);
    setReasonText("");
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </View>
    );
  }

  if (!service) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={styles.loadingContainer}>
          <Feather name="alert-circle" size={48} color={theme.textSecondary} />
          <ThemedText style={{ marginTop: Spacing.md, color: theme.textSecondary }}>
            Servizio non trovato
          </ThemedText>
        </View>
      </View>
    );
  }

  const badge = getServiceTypeBadge(service.serviceType);
  const km = service.estimatedKm || service.kmEstimated;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingHorizontal: Spacing.md,
          paddingBottom: insets.bottom + Spacing.xl + 80,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(400)}>
          <View style={styles.headerRow}>
            <View style={[styles.typeBadge, { backgroundColor: badge.bg }]}>
              <ThemedText style={[styles.typeBadgeText, { color: badge.color }]}>
                {badge.label}
              </ThemedText>
            </View>
            {service.progressiveCode ? (
              <ThemedText style={[styles.progCode, { color: theme.textSecondary }]}>
                {service.progressiveCode}
              </ThemedText>
            ) : null}
          </View>

          <View style={styles.timeRow}>
            <Feather name="clock" size={18} color={theme.primary} />
            <ThemedText style={[styles.scheduledTime, { color: theme.primary }]}>
              {service.scheduledTime || "--:--"}
            </ThemedText>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <Card style={styles.routeCard}>
            <View style={styles.routePoint}>
              <View style={[styles.routeDot, { backgroundColor: "#10b981" }]} />
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.routeLabel}>Partenza</ThemedText>
                <ThemedText style={styles.routeName}>
                  {service.originName || service.originAddress || "Origine"}
                </ThemedText>
                {service.originAddress && service.originName ? (
                  <ThemedText style={[styles.routeAddress, { color: theme.textSecondary }]}>
                    {service.originAddress}
                  </ThemedText>
                ) : null}
                {service.originCity ? (
                  <ThemedText style={[styles.routeCity, { color: theme.textSecondary }]}>
                    {service.originCity} {service.originProvince || ""}
                  </ThemedText>
                ) : null}
                {service.originFloor ? (
                  <ThemedText style={[styles.routeFloor, { color: theme.textSecondary }]}>
                    Piano: {service.originFloor}
                  </ThemedText>
                ) : null}
              </View>
            </View>

            <View style={styles.routeDivider}>
              <View style={[styles.routeLineBar, { backgroundColor: theme.border }]} />
              {km ? (
                <ThemedText style={[styles.kmText, { color: theme.textSecondary }]}>
                  {km} km
                </ThemedText>
              ) : null}
            </View>

            <View style={styles.routePoint}>
              <View style={[styles.routeDot, { backgroundColor: "#ef4444" }]} />
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.routeLabel}>Arrivo</ThemedText>
                <ThemedText style={styles.routeName}>
                  {service.destinationName || service.destinationAddress || "Destinazione"}
                </ThemedText>
                {service.destinationAddress && service.destinationName ? (
                  <ThemedText style={[styles.routeAddress, { color: theme.textSecondary }]}>
                    {service.destinationAddress}
                  </ThemedText>
                ) : null}
                {service.destinationCity ? (
                  <ThemedText style={[styles.routeCity, { color: theme.textSecondary }]}>
                    {service.destinationCity} {service.destinationProvince || ""}
                  </ThemedText>
                ) : null}
                {service.destinationFloor ? (
                  <ThemedText style={[styles.routeFloor, { color: theme.textSecondary }]}>
                    Piano: {service.destinationFloor}
                  </ThemedText>
                ) : null}
              </View>
            </View>
          </Card>
        </Animated.View>

        {service.notes ? (
          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <View style={[styles.notesCard, { borderLeftColor: theme.primary, backgroundColor: isDark ? "#122a4a" : "#f0f9ff" }]}>
              <Feather name="file-text" size={14} color={theme.primary} />
              <ThemedText style={[styles.notesText, { color: theme.text }]}>
                {service.notes}
              </ThemedText>
            </View>
          </Animated.View>
        ) : null}

        {(service.transportMode || service.gender) ? (
          <Animated.View entering={FadeInDown.delay(250).duration(400)}>
            <View style={styles.chipsRow}>
              {service.transportMode ? (
                <View style={[styles.chip, { backgroundColor: isDark ? "#1a3a5c" : "#e2e8f0" }]}>
                  <Feather name="truck" size={12} color={theme.textSecondary} />
                  <ThemedText style={[styles.chipText, { color: theme.textSecondary }]}>
                    {service.transportMode}
                  </ThemedText>
                </View>
              ) : null}
              {service.gender ? (
                <View style={[styles.chip, { backgroundColor: isDark ? "#1a3a5c" : "#e2e8f0" }]}>
                  <Feather name="user" size={12} color={theme.textSecondary} />
                  <ThemedText style={[styles.chipText, { color: theme.textSecondary }]}>
                    {service.gender === "M" ? "Maschio" : service.gender === "F" ? "Femmina" : service.gender}
                  </ThemedText>
                </View>
              ) : null}
              {service.hasPatient ? (
                <View style={[styles.chip, { backgroundColor: "#d1fae5" }]}>
                  <Feather name="check" size={12} color="#065f46" />
                  <ThemedText style={[styles.chipText, { color: "#065f46" }]}>
                    {service.patientName || "Presente"}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          </Animated.View>
        ) : null}

        {service.status === "scheduled" ? (
          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
            <Pressable
              onPress={handleStart}
              disabled={startMutation.isPending || gpsLoading}
              style={[styles.startButton, (startMutation.isPending || gpsLoading) ? { opacity: 0.7 } : null]}
            >
              {startMutation.isPending || gpsLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather name="play" size={22} color="#fff" />
              )}
              <ThemedText style={styles.startButtonText}>
                {gpsLoading ? "Acquisizione GPS..." : "INIZIO SERVIZIO"}
              </ThemedText>
            </Pressable>
          </Animated.View>
        ) : null}

        {service.status === "in_progress" ? (
          <Animated.View entering={FadeIn.duration(400)}>
            <View style={[styles.inProgressCard, { backgroundColor: isDark ? "#1a3a5c" : "#f0fdf4" }]}>
              <View style={styles.inProgressHeader}>
                <View style={styles.pulsingDotContainer}>
                  <Animated.View style={[styles.pulsingDot, { backgroundColor: "#10b981" }]} />
                </View>
                <ThemedText style={[styles.inProgressTitle, { color: "#10b981" }]}>
                  Servizio in corso
                </ThemedText>
              </View>
              <ThemedText style={styles.timerText}>
                {elapsed}
              </ThemedText>
            </View>

            <Pressable
              onPress={() => navigation.navigate("ServiceComplete", { serviceId })}
              style={styles.endButton}
            >
              <Feather name="square" size={22} color="#fff" />
              <ThemedText style={styles.endButtonText}>FINE SERVIZIO</ThemedText>
            </Pressable>

            <View style={styles.secondaryRow}>
              <Pressable
                onPress={() => waitMutation.mutate()}
                disabled={waitMutation.isPending}
                style={[styles.secondaryButton, { backgroundColor: "#3b82f6" }]}
              >
                <Feather name="coffee" size={16} color="#fff" />
                <ThemedText style={styles.secondaryButtonText}>Fermo per Visita</ThemedText>
              </Pressable>
              <Pressable
                onPress={() => {
                  setReasonText("");
                  setSuspendModalVisible(true);
                }}
                style={[styles.secondaryButton, { backgroundColor: "#f97316" }]}
              >
                <Feather name="pause" size={16} color="#fff" />
                <ThemedText style={styles.secondaryButtonText}>Sospendi</ThemedText>
              </Pressable>
              <Pressable
                onPress={() => {
                  setReasonText("");
                  setCancelModalVisible(true);
                }}
                style={[styles.secondaryButton, { backgroundColor: "#6b7280" }]}
              >
                <Feather name="x" size={16} color="#fff" />
                <ThemedText style={styles.secondaryButtonText}>Annulla</ThemedText>
              </Pressable>
            </View>
          </Animated.View>
        ) : null}

        {service.status === "waiting_for_visit" ? (
          <Animated.View entering={FadeIn.duration(400)}>
            <View style={[styles.inProgressCard, { backgroundColor: isDark ? "#1a2e50" : "#eff6ff" }]}>
              <View style={styles.inProgressHeader}>
                <Feather name="coffee" size={20} color="#3b82f6" />
                <ThemedText style={[styles.inProgressTitle, { color: "#3b82f6" }]}>
                  Fermo per Visita
                </ThemedText>
              </View>
              <ThemedText style={[styles.timerText, { color: "#3b82f6" }]}>
                {elapsed}
              </ThemedText>
              <ThemedText style={{ fontSize: 13, color: theme.textSecondary, textAlign: "center", marginTop: 4 }}>
                Ambulanza ferma - il paziente sta effettuando la visita. Premi "Riparti" quando la visita e' terminata. I dati sono salvati in sicurezza.
              </ThemedText>
            </View>

            <Pressable
              onPress={() => resumeMutation.mutate()}
              disabled={resumeMutation.isPending}
              style={[styles.startButton, { backgroundColor: "#10b981" }]}
            >
              {resumeMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather name="play" size={22} color="#fff" />
              )}
              <ThemedText style={styles.startButtonText}>RIPARTI</ThemedText>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate("ServiceComplete", { serviceId })}
              style={styles.endButton}
            >
              <Feather name="square" size={22} color="#fff" />
              <ThemedText style={styles.endButtonText}>FINE SERVIZIO</ThemedText>
            </Pressable>
          </Animated.View>
        ) : null}

        {(service.status === "completed" || service.status === "suspended" || service.status === "cancelled") ? (
          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
            <View style={[styles.summaryCard, { backgroundColor: isDark ? "#122a4a" : "#f8fafc" }]}>
              <ThemedText style={[styles.summaryTitle, { color: theme.text }]}>
                {service.status === "completed" ? "Servizio completato" : service.status === "suspended" ? "Servizio sospeso" : "Servizio annullato"}
              </ThemedText>

              {service.actualStartTime ? (
                <View style={styles.summaryRow}>
                  <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>Inizio</ThemedText>
                  <ThemedText style={{ color: theme.text }}>{formatTime(service.actualStartTime)}</ThemedText>
                </View>
              ) : null}

              {service.actualEndTime ? (
                <View style={styles.summaryRow}>
                  <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>Fine</ThemedText>
                  <ThemedText style={{ color: theme.text }}>{formatTime(service.actualEndTime)}</ThemedText>
                </View>
              ) : null}

              {service.startGpsLat != null && service.startGpsLng != null ? (
                <View style={styles.summaryRow}>
                  <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>GPS Partenza</ThemedText>
                  <ThemedText style={[styles.summaryCoords, { color: theme.text }]}>
                    {parseFloat(String(service.startGpsLat)).toFixed(5)}, {parseFloat(String(service.startGpsLng)).toFixed(5)}
                  </ThemedText>
                </View>
              ) : null}

              {service.endGpsLat != null && service.endGpsLng != null ? (
                <View style={styles.summaryRow}>
                  <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>GPS Arrivo</ThemedText>
                  <ThemedText style={[styles.summaryCoords, { color: theme.text }]}>
                    {parseFloat(String(service.endGpsLat)).toFixed(5)}, {parseFloat(String(service.endGpsLng)).toFixed(5)}
                  </ThemedText>
                </View>
              ) : null}

              {service.kmEnd ? (
                <View style={styles.summaryRow}>
                  <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>Km Fine</ThemedText>
                  <ThemedText style={{ color: theme.text }}>{service.kmEnd} km</ThemedText>
                </View>
              ) : null}

              {service.suspendReason ? (
                <View style={[styles.reasonBox, { backgroundColor: "#fff7ed", borderLeftColor: "#f97316" }]}>
                  <ThemedText style={[styles.reasonLabel, { color: "#c2410c" }]}>Motivo sospensione</ThemedText>
                  <ThemedText style={{ color: "#92400e" }}>{service.suspendReason}</ThemedText>
                </View>
              ) : null}

              {service.cancelReason ? (
                <View style={[styles.reasonBox, { backgroundColor: "#fef2f2", borderLeftColor: "#ef4444" }]}>
                  <ThemedText style={[styles.reasonLabel, { color: "#dc2626" }]}>Motivo annullamento</ThemedText>
                  <ThemedText style={{ color: "#991b1b" }}>{service.cancelReason}</ThemedText>
                </View>
              ) : null}
            </View>
          </Animated.View>
        ) : null}
      </ScrollView>

      <Modal
        visible={suspendModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSuspendModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundRoot }]}>
            <ThemedText style={[styles.modalTitle, { color: theme.text }]}>Sospendi servizio</ThemedText>
            <ThemedText style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              Inserisci il motivo della sospensione
            </ThemedText>
            <TextInput
              style={[styles.modalInput, {
                backgroundColor: theme.inputBackground,
                borderColor: theme.border,
                color: theme.text,
              }]}
              value={reasonText}
              onChangeText={setReasonText}
              placeholder="Motivo..."
              placeholderTextColor={theme.textSecondary}
              multiline
              autoFocus
            />
            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => setSuspendModalVisible(false)}
                style={[styles.modalButton, { backgroundColor: theme.backgroundSecondary }]}
              >
                <ThemedText style={{ color: theme.text }}>Annulla</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleSuspendConfirm}
                disabled={!reasonText.trim() || suspendMutation.isPending}
                style={[styles.modalButton, { backgroundColor: "#f97316", opacity: reasonText.trim() ? 1 : 0.5 }]}
              >
                {suspendMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <ThemedText style={{ color: "#fff", fontWeight: "600" }}>Sospendi</ThemedText>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={cancelModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundRoot }]}>
            <ThemedText style={[styles.modalTitle, { color: theme.text }]}>Annulla servizio</ThemedText>
            <ThemedText style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              Inserisci il motivo dell'annullamento
            </ThemedText>
            <TextInput
              style={[styles.modalInput, {
                backgroundColor: theme.inputBackground,
                borderColor: theme.border,
                color: theme.text,
              }]}
              value={reasonText}
              onChangeText={setReasonText}
              placeholder="Motivo..."
              placeholderTextColor={theme.textSecondary}
              multiline
              autoFocus
            />
            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => setCancelModalVisible(false)}
                style={[styles.modalButton, { backgroundColor: theme.backgroundSecondary }]}
              >
                <ThemedText style={{ color: theme.text }}>Indietro</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleCancelConfirm}
                disabled={!reasonText.trim() || cancelMutation.isPending}
                style={[styles.modalButton, { backgroundColor: "#ef4444", opacity: reasonText.trim() ? 1 : 0.5 }]}
              >
                {cancelMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <ThemedText style={{ color: "#fff", fontWeight: "600" }}>Annulla Servizio</ThemedText>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  typeBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  typeBadgeText: {
    fontSize: 14,
    fontWeight: "700",
  },
  progCode: {
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: Spacing.lg,
  },
  scheduledTime: {
    fontSize: 24,
    fontWeight: "700",
  },
  routeCard: {
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  routePoint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  routeLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    opacity: 0.6,
    marginBottom: 2,
  },
  routeName: {
    fontSize: 16,
    fontWeight: "600",
  },
  routeAddress: {
    fontSize: 13,
    marginTop: 2,
  },
  routeCity: {
    fontSize: 13,
    marginTop: 1,
  },
  routeFloor: {
    fontSize: 12,
    marginTop: 1,
  },
  routeDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 5,
    paddingVertical: 6,
    gap: Spacing.sm,
  },
  routeLineBar: {
    width: 2,
    height: 24,
  },
  kmText: {
    fontSize: 13,
    fontWeight: "500",
  },
  notesCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    borderLeftWidth: 3,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  notesText: {
    fontSize: 14,
    flex: 1,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "500",
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    backgroundColor: "#10b981",
    height: 56,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
  },
  startButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  inProgressCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  inProgressHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: Spacing.sm,
  },
  pulsingDotContainer: {
    width: 12,
    height: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  pulsingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  inProgressTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  timerText: {
    fontSize: 42,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#10b981",
  },
  endButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    backgroundColor: "#ef4444",
    height: 56,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  endButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  secondaryRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 44,
    borderRadius: BorderRadius.md,
  },
  secondaryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  summaryCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  summaryTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryCoords: {
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  reasonBox: {
    borderLeftWidth: 3,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.xs,
  },
  reasonLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: Spacing.md,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: Spacing.lg,
  },
  modalButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  modalButton: {
    flex: 1,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
