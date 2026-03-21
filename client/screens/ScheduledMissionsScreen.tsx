import React, { useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { useHeaderHeight } from "@react-navigation/elements";

interface Mission {
  id: string;
  bookingNumber: string;
  serviceType: string;
  status: string;
  requestedDate: string;
  requestedTimeStart: string;
  requestedTimeEnd: string | null;
  pickupAddress: string;
  pickupCity: string | null;
  pickupNotes: string | null;
  dropoffAddress: string;
  dropoffCity: string | null;
  dropoffNotes: string | null;
  patientFirstName: string | null;
  patientLastName: string | null;
  patientPhone: string | null;
  patientNotes: string | null;
  needsWheelchair: boolean;
  needsStretcher: boolean;
  needsOxygen: boolean;
  roundTrip: boolean;
  returnTime: string | null;
  clientNotes: string | null;
  client: {
    firstName: string;
    lastName: string;
    phone: string | null;
    clientType: string;
    facilityName: string | null;
  } | null;
}

const serviceLabels: Record<string, string> = {
  trasporto_sanitario: "Trasporto Sanitario",
  dimissione: "Dimissione",
  visita_medica: "Visita Medica",
  dialisi: "Dialisi",
  riabilitazione: "Riabilitazione",
  altro: "Altro",
};

const statusConfig: Record<string, { label: string; color: string; icon: string; nextStatus?: string; nextLabel?: string }> = {
  assigned: { label: "Assegnata", color: "#6366f1", icon: "check-circle", nextStatus: "in_transit", nextLabel: "Partenza" },
  in_transit: { label: "In Viaggio", color: "#eab308", icon: "navigation", nextStatus: "patient_aboard", nextLabel: "Paziente a Bordo" },
  patient_aboard: { label: "Paziente a Bordo", color: "#f97316", icon: "user-check", nextStatus: "completed", nextLabel: "Completa Missione" },
  completed: { label: "Completata", color: "#22c55e", icon: "check" },
};

export default function ScheduledMissionsScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const queryClient = useQueryClient();

  const { data: missions = [], isLoading, refetch, isRefetching } = useQuery<Mission[]>({
    queryKey: ["/api/hub/crew/missions"],
    refetchInterval: 30000,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PUT", `/api/hub/crew/missions/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hub/crew/missions"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: Error) => {
      Alert.alert("Errore", error.message);
    },
  });

  const handleStatusUpdate = useCallback((mission: Mission) => {
    const config = statusConfig[mission.status];
    if (!config?.nextStatus) return;

    Alert.alert(
      "Aggiorna Stato",
      `Vuoi aggiornare lo stato a "${statusConfig[config.nextStatus]?.label}"?`,
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Conferma",
          onPress: () => updateStatusMutation.mutate({ id: mission.id, status: config.nextStatus! }),
        },
      ]
    );
  }, [updateStatusMutation]);

  const renderMission = useCallback(({ item, index }: { item: Mission; index: number }) => {
    const config = statusConfig[item.status] || statusConfig.assigned;

    return (
      <Animated.View entering={FadeInDown.delay(index * 100).duration(400)}>
        <Card style={styles.missionCard}>
          <View style={styles.missionHeader}>
            <View style={styles.missionNumberRow}>
              <View style={[styles.statusDot, { backgroundColor: config.color }]} />
              <ThemedText type="body" style={styles.missionNumber}>{item.bookingNumber}</ThemedText>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: config.color + "20" }]}>
              <ThemedText style={[styles.statusText, { color: config.color }]}>{config.label}</ThemedText>
            </View>
          </View>

          <View style={styles.timeRow}>
            <Feather name="clock" size={14} color={theme.primary} />
            <ThemedText type="small" style={{ color: theme.primary, fontWeight: "600", marginLeft: 6 }}>
              {item.requestedTimeStart?.slice(0, 5) || "--:--"}
              {item.requestedTimeEnd ? ` - ${item.requestedTimeEnd.slice(0, 5)}` : ""}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 8 }}>
              {serviceLabels[item.serviceType] || item.serviceType}
            </ThemedText>
          </View>

          <View style={styles.routeSection}>
            <View style={styles.routeRow}>
              <View style={[styles.routeDot, { backgroundColor: "#22c55e" }]} />
              <View style={styles.routeTextContainer}>
                <ThemedText type="small" style={{ fontWeight: "600" }}>
                  {item.pickupAddress}{item.pickupCity ? `, ${item.pickupCity}` : ""}
                </ThemedText>
                {item.pickupNotes ? (
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 2 }}>
                    {item.pickupNotes}
                  </ThemedText>
                ) : null}
              </View>
            </View>
            <View style={styles.routeLine} />
            <View style={styles.routeRow}>
              <View style={[styles.routeDot, { backgroundColor: "#ef4444" }]} />
              <View style={styles.routeTextContainer}>
                <ThemedText type="small" style={{ fontWeight: "600" }}>
                  {item.dropoffAddress}{item.dropoffCity ? `, ${item.dropoffCity}` : ""}
                </ThemedText>
                {item.dropoffNotes ? (
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 2 }}>
                    {item.dropoffNotes}
                  </ThemedText>
                ) : null}
              </View>
            </View>
          </View>

          {(item.patientFirstName || item.client) ? (
            <View style={[styles.infoSection, { borderTopColor: theme.border }]}>
              {item.patientFirstName ? (
                <View style={styles.infoRow}>
                  <Feather name="user" size={14} color={theme.textSecondary} />
                  <ThemedText type="small" style={{ marginLeft: 8 }}>
                    {item.patientFirstName} {item.patientLastName || ""}
                    {item.patientPhone ? ` - ${item.patientPhone}` : ""}
                  </ThemedText>
                </View>
              ) : null}
              {item.client ? (
                <View style={styles.infoRow}>
                  <Feather name="phone" size={14} color={theme.textSecondary} />
                  <ThemedText type="small" style={{ marginLeft: 8 }}>
                    {item.client.clientType === "facility" ? item.client.facilityName : `${item.client.firstName} ${item.client.lastName}`}
                    {item.client.phone ? ` - ${item.client.phone}` : ""}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          ) : null}

          {(item.needsWheelchair || item.needsStretcher || item.needsOxygen || item.roundTrip) ? (
            <View style={styles.tagsRow}>
              {item.needsWheelchair ? <View style={[styles.tag, { backgroundColor: "#dbeafe" }]}><ThemedText style={[styles.tagText, { color: "#1e40af" }]}>Sedia a rotelle</ThemedText></View> : null}
              {item.needsStretcher ? <View style={[styles.tag, { backgroundColor: "#fce7f3" }]}><ThemedText style={[styles.tagText, { color: "#9d174d" }]}>Barella</ThemedText></View> : null}
              {item.needsOxygen ? <View style={[styles.tag, { backgroundColor: "#dcfce7" }]}><ThemedText style={[styles.tagText, { color: "#166534" }]}>Ossigeno</ThemedText></View> : null}
              {item.roundTrip ? <View style={[styles.tag, { backgroundColor: "#fef3c7" }]}><ThemedText style={[styles.tagText, { color: "#92400e" }]}>A/R{item.returnTime ? ` ${item.returnTime.slice(0,5)}` : ""}</ThemedText></View> : null}
            </View>
          ) : null}

          {item.clientNotes || item.patientNotes ? (
            <View style={[styles.notesSection, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" }]}>
              <Feather name="file-text" size={12} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 6, flex: 1 }}>
                {item.patientNotes || item.clientNotes}
              </ThemedText>
            </View>
          ) : null}

          {config.nextStatus ? (
            <Pressable
              style={[styles.actionButton, { backgroundColor: statusConfig[config.nextStatus]?.color || theme.primary }]}
              onPress={() => handleStatusUpdate(item)}
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Feather name={statusConfig[config.nextStatus]?.icon as any || "arrow-right"} size={16} color="#fff" />
                  <ThemedText style={styles.actionButtonText}>{config.nextLabel}</ThemedText>
                </>
              )}
            </Pressable>
          ) : null}
        </Card>
      </Animated.View>
    );
  }, [theme, isDark, handleStatusUpdate, updateStatusMutation.isPending]);

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={missions}
        renderItem={renderMission}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingHorizontal: Spacing.md,
          paddingBottom: insets.bottom + Spacing.xl,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            progressViewOffset={headerHeight}
          />
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={theme.primary} />
              <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: 16 }}>
                Caricamento missioni...
              </ThemedText>
            </View>
          ) : (
            <Animated.View entering={FadeIn.duration(400)} style={styles.emptyState}>
              <Feather name="calendar" size={48} color={theme.textSecondary} style={{ opacity: 0.4 }} />
              <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: 16, fontWeight: "600" }}>
                Nessuna missione programmata
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4, textAlign: "center" }}>
                Le missioni assegnate al tuo veicolo appariranno qui
              </ThemedText>
            </Animated.View>
          )
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  missionCard: {
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  missionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  missionNumberRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  missionNumber: {
    fontWeight: "700",
    fontSize: 15,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  routeSection: {
    marginBottom: 8,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
    marginRight: 10,
  },
  routeTextContainer: {
    flex: 1,
  },
  routeLine: {
    width: 2,
    height: 12,
    backgroundColor: "#cbd5e1",
    marginLeft: 4,
    marginVertical: 2,
  },
  infoSection: {
    borderTopWidth: 1,
    paddingTop: 8,
    marginTop: 8,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  tagText: {
    fontSize: 11,
    fontWeight: "600",
  },
  notesSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: BorderRadius.md,
    marginTop: 12,
    gap: 8,
  },
  actionButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
  },
});
