import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl, apiRequest } from "@/lib/query-client";
import { useAuth } from "@/contexts/AuthContext";
import { useHeaderHeight } from "@react-navigation/elements";
import type { HomeStackParamList } from "@/navigation/HomeStackNavigator";

interface ServiceData {
  id: string;
  progressiveCode: string | null;
  scheduledTime: string | null;
  serviceType: string | null;
  hasPatient: boolean;
  patientName: string | null;
  gender: string | null;
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
  isEmptyTrip: boolean | null;
}

interface LocationInfo {
  name: string;
  address: string;
  city: string;
}

type TodayItem =
  | { type: "service"; data: ServiceData }
  | { type: "empty_trip"; data: ServiceData }
  | { type: "empty_trip_suggestion"; from: LocationInfo; to: LocationInfo };

function getServiceTypeBadge(serviceType: string | null) {
  if (!serviceType) return { bg: "#e5e7eb", color: "#374151", label: "Servizio" };
  const st = serviceType.toLowerCase();
  if (st.includes("specialistic") || st.includes("prestazione"))
    return { bg: "#dbeafe", color: "#1d4ed8", label: "Visita" };
  if (st.includes("emodialisi") || st.includes("dialisi"))
    return { bg: "#ede9fe", color: "#6d28d9", label: "Dialisi" };
  if (st.includes("dimission") || st.includes("trasferim"))
    return { bg: "#ffedd5", color: "#c2410c", label: "Trasferimento" };
  if (st.includes("emergenz") || st.includes("urgenz"))
    return { bg: "#fee2e2", color: "#dc2626", label: "Emergenza" };
  return { bg: "#e5e7eb", color: "#374151", label: serviceType };
}

function ElapsedTimer({ startTime }: { startTime: string }) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    const update = () => {
      const start = new Date(startTime).getTime();
      const diff = Math.max(0, Date.now() - start);
      const totalSecs = Math.floor(diff / 1000);
      const hrs = Math.floor(totalSecs / 3600);
      const mins = Math.floor((totalSecs % 3600) / 60);
      const secs = totalSecs % 60;
      const pad = (n: number) => n.toString().padStart(2, "0");
      setElapsed(hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <ThemedText style={{ fontSize: 14, fontWeight: "700", color: "#92400e" }}>
      {elapsed}
    </ThemedText>
  );
}

export default function OggiScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();

  const vehicleId = user?.vehicle?.id;

  const [extraModalVisible, setExtraModalVisible] = useState(false);
  const [emptyTripModalVisible, setEmptyTripModalVisible] = useState(false);
  const [emptyTripForm, setEmptyTripForm] = useState({
    originName: "",
    originAddress: "",
    originCity: "",
    destinationName: "",
    destinationAddress: "",
    destinationCity: "",
  });
  const [extraForm, setExtraForm] = useState({
    scheduledTime: "",
    serviceType: "",
    originName: "",
    originAddress: "",
    originCity: "",
    destinationName: "",
    destinationAddress: "",
    destinationCity: "",
    notes: "",
  });

  const {
    data: items,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<TodayItem[]>({
    queryKey: ["/api/mobile/today"],
    enabled: !!vehicleId,
    refetchInterval: 30000,
  });

  const openEmptyTripModal = useCallback(() => {
    const serviceItems = (items || []).filter(
      (i): i is { type: "service"; data: ServiceData } | { type: "empty_trip"; data: ServiceData } =>
        i.type === "service" || i.type === "empty_trip"
    );
    const lastCompleted = [...serviceItems]
      .reverse()
      .find((i) => i.data.status === "completed");

    const sedeName = user?.location?.name || "Sede";
    const sedeAddress = user?.location?.address || "";

    setEmptyTripForm({
      originName: lastCompleted ? (lastCompleted.data.destinationName || "") : sedeName,
      originAddress: lastCompleted ? (lastCompleted.data.destinationAddress || "") : sedeAddress,
      originCity: lastCompleted ? (lastCompleted.data.destinationCity || "") : "",
      destinationName: sedeName,
      destinationAddress: sedeAddress,
      destinationCity: "",
    });
    setEmptyTripModalVisible(true);
  }, [items, user]);

  const startEmptyTripMutation = useMutation({
    mutationFn: async (body: { from: LocationInfo; to: LocationInfo }) => {
      const res = await apiRequest("POST", "/api/mobile/empty-trip/start", {
        originName: body.from.name,
        originAddress: body.from.address,
        originCity: body.from.city,
        destinationName: body.to.name,
        destinationAddress: body.to.address,
        destinationCity: body.to.city,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mobile/today"] });
    },
  });

  const createExtraServiceMutation = useMutation({
    mutationFn: async (body: typeof extraForm) => {
      const res = await apiRequest("POST", "/api/mobile/scheduled-services", body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mobile/today"] });
      setExtraModalVisible(false);
      setExtraForm({
        scheduledTime: "",
        serviceType: "",
        originName: "",
        originAddress: "",
        originCity: "",
        destinationName: "",
        destinationAddress: "",
        destinationCity: "",
        notes: "",
      });
    },
  });

  if (!vehicleId) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: theme.backgroundRoot }]}>
        <Feather name="alert-triangle" size={56} color={theme.textSecondary} />
        <ThemedText style={[styles.noVehicleTitle, { color: theme.text }]}>
          Nessun mezzo assegnato
        </ThemedText>
        <ThemedText style={[styles.noVehicleSubtitle, { color: theme.textSecondary }]}>
          Contatta l'amministratore
        </ThemedText>
      </View>
    );
  }

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "in_progress":
        return { bg: "#fef3c7", color: "#92400e", icon: "play-circle" as const, label: "In Corso" };
      case "waiting_for_visit":
        return { bg: "#dbeafe", color: "#1d4ed8", icon: "coffee" as const, label: "Fermo per Visita" };
      case "completed":
        return { bg: "#d1fae5", color: "#065f46", icon: "check-circle" as const, label: "Completato" };
      case "suspended":
        return { bg: "#ffedd5", color: "#c2410c", icon: "pause-circle" as const, label: "Sospeso" };
      case "cancelled":
        return { bg: "#fee2e2", color: "#991b1b", icon: "x-circle" as const, label: "Annullato" };
      default:
        return { bg: "#eff6ff", color: "#1d4ed8", icon: "clock" as const, label: "Programmato" };
    }
  };

  const renderServiceCard = (item: ServiceData, index: number) => {
    const st = getStatusInfo(item.status);
    const badge = getServiceTypeBadge(item.serviceType);
    const km = item.estimatedKm || item.kmEstimated;

    return (
      <Animated.View entering={FadeInDown.delay(index * 60).duration(350)}>
        <Card
          style={styles.serviceCard}
          onPress={
            item.status === "scheduled" || item.status === "in_progress" || item.status === "waiting_for_visit"
              ? () => navigation.navigate("ServiceDetail" as any, { serviceId: item.id })
              : undefined
          }
        >
          <View style={styles.cardHeader}>
            <View style={styles.timeContainer}>
              <Feather name="clock" size={14} color={theme.primary} />
              <ThemedText style={[styles.timeText, { color: theme.primary }]}>
                {item.scheduledTime || "--:--"}
              </ThemedText>
            </View>
            <View style={[styles.typeBadge, { backgroundColor: badge.bg }]}>
              <ThemedText style={[styles.typeBadgeText, { color: badge.color }]}>
                {badge.label}
              </ThemedText>
            </View>
          </View>

          <View style={styles.serviceTypeRow}>
            {item.progressiveCode ? (
              <ThemedText style={[styles.progCode, { color: theme.textSecondary }]}>
                {item.progressiveCode}
              </ThemedText>
            ) : null}
          </View>

          {item.hasPatient ? (
            <View style={[styles.patientRow, { backgroundColor: isDark ? "#1e293b" : "#f8fafc" }]}>
              <Feather
                name={item.gender === "F" ? "user" : "user"}
                size={14}
                color={item.gender === "F" ? "#ec4899" : "#3b82f6"}
              />
              <ThemedText style={[styles.patientPresent, { color: theme.text }]}>
                {item.patientName || "Presente"}
              </ThemedText>
              {item.gender ? (
                <View style={[styles.genderChip, { backgroundColor: item.gender === "F" ? "#fce7f3" : "#dbeafe" }]}>
                  <ThemedText style={{ fontSize: 11, fontWeight: "600", color: item.gender === "F" ? "#db2777" : "#2563eb" }}>
                    {item.gender}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.routeContainer}>
            <View style={styles.routePoint}>
              <View style={[styles.routeDot, { backgroundColor: "#10b981" }]} />
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.routeName} numberOfLines={2}>
                  {item.originName || item.originAddress || "Origine"}
                </ThemedText>
                {item.originCity ? (
                  <ThemedText style={[styles.routeCity, { color: theme.textSecondary }]}>
                    {item.originCity} {item.originProvince || ""}
                  </ThemedText>
                ) : null}
              </View>
            </View>

            <View style={styles.routeLine}>
              <View style={[styles.routeLineBar, { backgroundColor: theme.border }]} />
              {km ? (
                <ThemedText style={[styles.kmBadge, { color: theme.textSecondary }]}>
                  {km} km
                </ThemedText>
              ) : null}
            </View>

            <View style={styles.routePoint}>
              <View style={[styles.routeDot, { backgroundColor: "#ef4444" }]} />
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.routeName} numberOfLines={2}>
                  {item.destinationName || item.destinationAddress || "Destinazione"}
                </ThemedText>
                {item.destinationCity ? (
                  <ThemedText style={[styles.routeCity, { color: theme.textSecondary }]}>
                    {item.destinationCity} {item.destinationProvince || ""}
                  </ThemedText>
                ) : null}
              </View>
            </View>
          </View>

          {(item.notes || item.transportMode) ? (
            <View style={[styles.notesSection, { borderTopColor: theme.border }]}>
              {item.transportMode ? (
                <View style={styles.noteRow}>
                  <Feather name="truck" size={12} color={theme.textSecondary} />
                  <ThemedText style={[styles.noteText, { color: theme.textSecondary }]}>
                    {item.transportMode}
                  </ThemedText>
                </View>
              ) : null}
              {item.notes ? (
                <View style={styles.noteRow}>
                  <Feather name="file-text" size={12} color={theme.textSecondary} />
                  <ThemedText style={[styles.noteText, { color: theme.textSecondary }]}>
                    {item.notes}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
              <Feather name={st.icon} size={12} color={st.color} />
              <ThemedText style={[styles.statusText, { color: st.color }]}>
                {st.label}
              </ThemedText>
            </View>

            {item.status === "scheduled" ? (
              <Pressable
                style={styles.avviaButton}
                onPress={() => navigation.navigate("ServiceDetail" as any, { serviceId: item.id })}
              >
                <Feather name="play" size={14} color="#fff" />
                <ThemedText style={styles.avviaText}>AVVIA</ThemedText>
              </Pressable>
            ) : null}

            {item.status === "in_progress" && item.actualStartTime ? (
              <Pressable
                style={styles.inCorsoButton}
                onPress={() => navigation.navigate("ServiceDetail" as any, { serviceId: item.id })}
              >
                <View style={styles.pulseDot} />
                <ElapsedTimer startTime={item.actualStartTime} />
              </Pressable>
            ) : null}
          </View>
        </Card>
      </Animated.View>
    );
  };

  const renderEmptyTripSuggestion = (from: LocationInfo, to: LocationInfo, index: number) => {
    return (
      <Animated.View entering={FadeInDown.delay(index * 60).duration(350)}>
        <View style={[styles.emptyTripCard, { backgroundColor: isDark ? "#422006" : "#fffbeb", borderColor: isDark ? "#78350f" : "#fbbf24" }]}>
          <View style={styles.emptyTripHeader}>
            <Feather name="truck" size={16} color="#d97706" />
            <ThemedText style={styles.emptyTripLabel}>Trasferimento a vuoto</ThemedText>
          </View>
          <View style={styles.emptyTripRoute}>
            <ThemedText style={[styles.emptyTripPoint, { color: isDark ? "#fbbf24" : "#92400e" }]}>
              {from.name}
            </ThemedText>
            {from.city ? (
              <ThemedText style={[styles.emptyTripCity, { color: isDark ? "#d97706" : "#b45309" }]}>
                {from.city}
              </ThemedText>
            ) : null}
            <Feather name="arrow-down" size={14} color="#d97706" style={{ alignSelf: "center", marginVertical: 4 }} />
            <ThemedText style={[styles.emptyTripPoint, { color: isDark ? "#fbbf24" : "#92400e" }]}>
              {to.name}
            </ThemedText>
            {to.city ? (
              <ThemedText style={[styles.emptyTripCity, { color: isDark ? "#d97706" : "#b45309" }]}>
                {to.city}
              </ThemedText>
            ) : null}
          </View>
          <Pressable
            style={styles.emptyTripAvvia}
            onPress={() => startEmptyTripMutation.mutate({ from, to })}
            disabled={startEmptyTripMutation.isPending}
          >
            {startEmptyTripMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="play" size={14} color="#fff" />
                <ThemedText style={styles.avviaText}>AVVIA</ThemedText>
              </>
            )}
          </Pressable>
        </View>
      </Animated.View>
    );
  };

  const renderItem = useCallback(
    ({ item, index }: { item: TodayItem; index: number }) => {
      if (item.type === "service" || item.type === "empty_trip") {
        return renderServiceCard(item.data, index);
      }
      if (item.type === "empty_trip_suggestion") {
        return renderEmptyTripSuggestion(item.from, item.to, index);
      }
      return null;
    },
    [theme, isDark, navigation, startEmptyTripMutation.isPending]
  );

  const serviceCount = (items || []).filter((i) => i.type === "service" || i.type === "empty_trip").length;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={items || []}
        keyExtractor={(item, index) => {
          if (item.type === "service" || item.type === "empty_trip") return item.data.id;
          return `empty_trip_sug_${index}`;
        }}
        renderItem={renderItem}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingHorizontal: Spacing.md,
          paddingBottom: insets.bottom + Spacing.xl + 80,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={theme.primary}
          />
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                Caricamento servizi...
              </ThemedText>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Feather
                name="calendar"
                size={48}
                color={theme.textSecondary}
                style={{ marginBottom: Spacing.md }}
              />
              <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
                Nessun servizio per oggi
              </ThemedText>
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                Non ci sono servizi programmati per il tuo mezzo
              </ThemedText>
            </View>
          )
        }
        ListHeaderComponent={
          serviceCount > 0 ? (
            <View style={styles.headerSummary}>
              <ThemedText style={[styles.summaryText, { color: theme.textSecondary }]}>
                {serviceCount} serviz{serviceCount === 1 ? "io" : "i"} programmati per oggi
              </ThemedText>
            </View>
          ) : null
        }
        ListFooterComponent={
          <View style={{ gap: Spacing.sm }}>
            <Pressable
              style={[styles.emptyTripButton, { backgroundColor: isDark ? "#1e3a5f" : "#eff6ff", borderColor: isDark ? "#2563eb" : "#93c5fd" }]}
              onPress={openEmptyTripModal}
            >
              <Feather name="truck" size={20} color={isDark ? "#93c5fd" : "#2563eb"} />
              <View style={{ flex: 1 }}>
                <ThemedText style={{ fontSize: 15, fontWeight: "700", color: isDark ? "#93c5fd" : "#1d4ed8" }}>
                  Viaggio Senza Paziente
                </ThemedText>
                <ThemedText style={{ fontSize: 12, color: isDark ? "#60a5fa" : "#3b82f6" }}>
                  Rientro in sede o trasferimento a vuoto
                </ThemedText>
              </View>
              <Feather name="chevron-right" size={20} color={isDark ? "#60a5fa" : "#3b82f6"} />
            </Pressable>
            <Pressable
              style={[styles.extraButton, { borderColor: theme.primary }]}
              onPress={() => setExtraModalVisible(true)}
            >
              <Feather name="plus" size={20} color={theme.primary} />
              <ThemedText style={[styles.extraButtonText, { color: theme.primary }]}>
                Servizio extra
              </ThemedText>
            </Pressable>
          </View>
        }
      />

      <Modal
        visible={extraModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setExtraModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={[styles.modalTitle, { color: theme.text }]}>
                Nuovo servizio extra
              </ThemedText>
              <Pressable onPress={() => setExtraModalVisible(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.modalScroll}>
              <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
                Orario
              </ThemedText>
              <TextInput
                style={[styles.modalInput, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
                placeholder="es. 14:30"
                placeholderTextColor={theme.textSecondary}
                value={extraForm.scheduledTime}
                onChangeText={(v) => setExtraForm((p) => ({ ...p, scheduledTime: v }))}
              />

              <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
                Tipo servizio
              </ThemedText>
              <TextInput
                style={[styles.modalInput, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
                placeholder="es. Prestazione Specialistica"
                placeholderTextColor={theme.textSecondary}
                value={extraForm.serviceType}
                onChangeText={(v) => setExtraForm((p) => ({ ...p, serviceType: v }))}
              />

              <ThemedText style={[styles.inputLabel, { color: theme.textSecondary, marginTop: Spacing.md }]}>
                Origine
              </ThemedText>
              <TextInput
                style={[styles.modalInput, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
                placeholder="Nome struttura"
                placeholderTextColor={theme.textSecondary}
                value={extraForm.originName}
                onChangeText={(v) => setExtraForm((p) => ({ ...p, originName: v }))}
              />
              <TextInput
                style={[styles.modalInput, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
                placeholder="Indirizzo"
                placeholderTextColor={theme.textSecondary}
                value={extraForm.originAddress}
                onChangeText={(v) => setExtraForm((p) => ({ ...p, originAddress: v }))}
              />
              <TextInput
                style={[styles.modalInput, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
                placeholder="Città"
                placeholderTextColor={theme.textSecondary}
                value={extraForm.originCity}
                onChangeText={(v) => setExtraForm((p) => ({ ...p, originCity: v }))}
              />

              <ThemedText style={[styles.inputLabel, { color: theme.textSecondary, marginTop: Spacing.md }]}>
                Destinazione
              </ThemedText>
              <TextInput
                style={[styles.modalInput, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
                placeholder="Nome struttura"
                placeholderTextColor={theme.textSecondary}
                value={extraForm.destinationName}
                onChangeText={(v) => setExtraForm((p) => ({ ...p, destinationName: v }))}
              />
              <TextInput
                style={[styles.modalInput, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
                placeholder="Indirizzo"
                placeholderTextColor={theme.textSecondary}
                value={extraForm.destinationAddress}
                onChangeText={(v) => setExtraForm((p) => ({ ...p, destinationAddress: v }))}
              />
              <TextInput
                style={[styles.modalInput, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
                placeholder="Città"
                placeholderTextColor={theme.textSecondary}
                value={extraForm.destinationCity}
                onChangeText={(v) => setExtraForm((p) => ({ ...p, destinationCity: v }))}
              />

              <ThemedText style={[styles.inputLabel, { color: theme.textSecondary, marginTop: Spacing.md }]}>
                Note
              </ThemedText>
              <TextInput
                style={[styles.modalInput, styles.modalTextarea, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
                placeholder="Note aggiuntive"
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={3}
                value={extraForm.notes}
                onChangeText={(v) => setExtraForm((p) => ({ ...p, notes: v }))}
              />

              <Pressable
                style={[styles.submitButton, createExtraServiceMutation.isPending && { opacity: 0.6 }]}
                onPress={() => createExtraServiceMutation.mutate(extraForm)}
                disabled={createExtraServiceMutation.isPending}
              >
                {createExtraServiceMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <ThemedText style={styles.submitButtonText}>Crea servizio</ThemedText>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={emptyTripModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEmptyTripModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Pressable onPress={() => setEmptyTripModalVisible(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
              <ThemedText style={[styles.modalTitle, { color: theme.text }]}>
                Viaggio Senza Paziente
              </ThemedText>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={{ padding: Spacing.lg }}>
              <View style={[styles.emptyTripSectionHeader, { backgroundColor: isDark ? "#1e3a5f" : "#eff6ff" }]}>
                <Feather name="map-pin" size={16} color="#2563eb" />
                <ThemedText style={{ fontSize: 14, fontWeight: "700", color: "#2563eb" }}>
                  Partenza
                </ThemedText>
              </View>

              <TextInput
                style={[styles.formInput, { color: theme.text, borderColor: theme.border, backgroundColor: isDark ? "#1e293b" : "#fff" }]}
                placeholder="Nome luogo partenza"
                placeholderTextColor={theme.textSecondary}
                value={emptyTripForm.originName}
                onChangeText={(v) => setEmptyTripForm((p) => ({ ...p, originName: v }))}
              />
              <TextInput
                style={[styles.formInput, { color: theme.text, borderColor: theme.border, backgroundColor: isDark ? "#1e293b" : "#fff" }]}
                placeholder="Indirizzo"
                placeholderTextColor={theme.textSecondary}
                value={emptyTripForm.originAddress}
                onChangeText={(v) => setEmptyTripForm((p) => ({ ...p, originAddress: v }))}
              />
              <TextInput
                style={[styles.formInput, { color: theme.text, borderColor: theme.border, backgroundColor: isDark ? "#1e293b" : "#fff" }]}
                placeholder="Comune"
                placeholderTextColor={theme.textSecondary}
                value={emptyTripForm.originCity}
                onChangeText={(v) => setEmptyTripForm((p) => ({ ...p, originCity: v }))}
              />

              <View style={[styles.emptyTripSectionHeader, { backgroundColor: isDark ? "#14532d" : "#f0fdf4", marginTop: Spacing.md }]}>
                <Feather name="flag" size={16} color="#16a34a" />
                <ThemedText style={{ fontSize: 14, fontWeight: "700", color: "#16a34a" }}>
                  Destinazione
                </ThemedText>
              </View>

              <TextInput
                style={[styles.formInput, { color: theme.text, borderColor: theme.border, backgroundColor: isDark ? "#1e293b" : "#fff" }]}
                placeholder="Nome luogo destinazione"
                placeholderTextColor={theme.textSecondary}
                value={emptyTripForm.destinationName}
                onChangeText={(v) => setEmptyTripForm((p) => ({ ...p, destinationName: v }))}
              />
              <TextInput
                style={[styles.formInput, { color: theme.text, borderColor: theme.border, backgroundColor: isDark ? "#1e293b" : "#fff" }]}
                placeholder="Indirizzo"
                placeholderTextColor={theme.textSecondary}
                value={emptyTripForm.destinationAddress}
                onChangeText={(v) => setEmptyTripForm((p) => ({ ...p, destinationAddress: v }))}
              />
              <TextInput
                style={[styles.formInput, { color: theme.text, borderColor: theme.border, backgroundColor: isDark ? "#1e293b" : "#fff" }]}
                placeholder="Comune"
                placeholderTextColor={theme.textSecondary}
                value={emptyTripForm.destinationCity}
                onChangeText={(v) => setEmptyTripForm((p) => ({ ...p, destinationCity: v }))}
              />

              <Pressable
                style={[
                  styles.submitButton,
                  { backgroundColor: "#2563eb" },
                  startEmptyTripMutation.isPending && styles.submitButtonDisabled,
                ]}
                onPress={() => {
                  startEmptyTripMutation.mutate({
                    from: { name: emptyTripForm.originName, address: emptyTripForm.originAddress, city: emptyTripForm.originCity },
                    to: { name: emptyTripForm.destinationName, address: emptyTripForm.destinationAddress, city: emptyTripForm.destinationCity },
                  });
                  setEmptyTripModalVisible(false);
                }}
                disabled={startEmptyTripMutation.isPending}
              >
                {startEmptyTripMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <ThemedText style={styles.submitButtonText}>Avvia viaggio</ThemedText>
                )}
              </Pressable>
            </ScrollView>
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
  centerContent: {
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  noVehicleTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: Spacing.lg,
    textAlign: "center",
  },
  noVehicleSubtitle: {
    fontSize: 15,
    marginTop: Spacing.sm,
    textAlign: "center",
  },
  headerSummary: {
    marginBottom: Spacing.md,
  },
  summaryText: {
    fontSize: 14,
  },
  serviceCard: {
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  timeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  timeText: {
    fontSize: 18,
    fontWeight: "700",
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  serviceTypeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  progCode: {
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  patientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  patientPresent: {
    fontSize: 14,
    fontWeight: "500",
  },
  genderChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  routeContainer: {
    marginVertical: Spacing.sm,
  },
  routePoint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  routeName: {
    fontSize: 14,
    fontWeight: "500",
  },
  routeCity: {
    fontSize: 12,
    marginTop: 1,
  },
  routeLine: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 4,
    paddingVertical: 4,
    gap: Spacing.sm,
  },
  routeLineBar: {
    width: 2,
    height: 20,
    marginLeft: 3,
  },
  kmBadge: {
    fontSize: 12,
    fontWeight: "500",
  },
  notesSection: {
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
    gap: 6,
  },
  noteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  noteText: {
    fontSize: 12,
    flex: 1,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.md,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  avviaButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#10b981",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  avviaText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  inCorsoButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fef3c7",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#f59e0b",
  },
  emptyTripCard: {
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  emptyTripHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  emptyTripLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#d97706",
  },
  emptyTripRoute: {
    marginBottom: Spacing.sm,
  },
  emptyTripPoint: {
    fontSize: 14,
    fontWeight: "600",
  },
  emptyTripCity: {
    fontSize: 12,
    marginTop: 1,
  },
  emptyTripAvvia: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#d97706",
    paddingVertical: 8,
    borderRadius: 20,
  },
  extraButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: 16,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderStyle: "dashed",
    marginTop: Spacing.md,
  },
  extraButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  modalScroll: {
    padding: Spacing.lg,
    paddingBottom: 40,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 4,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: Spacing.sm,
  },
  modalTextarea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  submitButton: {
    backgroundColor: "#10b981",
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.lg,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  emptyTripButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  emptyTripSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: Spacing.sm,
  },
});
