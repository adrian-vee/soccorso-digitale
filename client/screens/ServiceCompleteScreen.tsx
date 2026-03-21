import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import * as Location from "expo-location";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest, getApiUrl, queryClient } from "@/lib/query-client";
import { useAuth } from "@/contexts/AuthContext";
import type { HomeStackParamList } from "@/navigation/HomeStackNavigator";

type Props = NativeStackScreenProps<HomeStackParamList, "ServiceComplete">;

interface ServiceData {
  id: string;
  progressiveCode: string | null;
  scheduledTime: string | null;
  serviceType: string | null;
  status: string;
  actualStartTime: string | null;
  actualEndTime: string | null;
  startGpsLat: number | null;
  startGpsLng: number | null;
  endGpsLat: number | null;
  endGpsLng: number | null;
  kmStart: number | null;
  kmEnd: number | null;
  originName: string | null;
  originAddress: string | null;
  originCity: string | null;
  destinationName: string | null;
  destinationAddress: string | null;
  destinationCity: string | null;
  notes: string | null;
  isEmptyTrip: boolean | null;
  gender: string | null;
}

export default function ServiceCompleteScreen({ route, navigation }: Props) {
  const { serviceId } = route.params;
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { user } = useAuth();

  const vehicleCurrentKm = user?.vehicle?.currentKm;
  const [kmEnd, setKmEnd] = useState("");
  const [kmInitialized, setKmInitialized] = useState(false);
  const [extraNotes, setExtraNotes] = useState("");
  const [isCompleted, setIsCompleted] = useState(false);
  const [completedData, setCompletedData] = useState<any>(null);
  const [nextService, setNextService] = useState<ServiceData | null>(null);

  const { data: service, isLoading } = useQuery<ServiceData>({
    queryKey: ["/api/scheduled-services", serviceId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/scheduled-services/${serviceId}`);
      return res.json();
    },
  });

  useEffect(() => {
    if (!kmInitialized && vehicleCurrentKm) {
      setKmEnd(String(vehicleCurrentKm));
      setKmInitialized(true);
    }
  }, [vehicleCurrentKm, kmInitialized]);

  const today = new Date().toISOString().split("T")[0];
  const vehicleId = user?.vehicle?.id;

  const { data: todayServices } = useQuery<Array<{ type: string; data: ServiceData }>>({
    queryKey: ["/api/mobile/today"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/mobile/today");
      return res.json();
    },
    enabled: isCompleted,
  });

  useEffect(() => {
    if (isCompleted && todayServices) {
      const scheduled = todayServices
        .filter((item) => item.type === "service" && item.data.status === "scheduled")
        .map((item) => item.data);
      if (scheduled.length > 0) {
        setNextService(scheduled[0]);
      }
    }
  }, [isCompleted, todayServices]);

  const completeMutation = useMutation({
    mutationFn: async (payload: {
      kmEnd: number;
      lat: number | null;
      lng: number | null;
      notes: string;
    }) => {
      const res = await apiRequest(
        "PATCH",
        `/api/mobile/scheduled-services/${serviceId}/complete`,
        {
          kmEnd: payload.kmEnd,
          lat: payload.lat,
          lng: payload.lng,
          notes: payload.notes,
        }
      );
      return res.json();
    },
    onSuccess: (data) => {
      setCompletedData(data);
      setIsCompleted(true);
      queryClient.invalidateQueries({ queryKey: ["/api/mobile/today"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/scheduled-services", serviceId],
      });
    },
  });

  const handleConfirm = useCallback(async () => {
    const kmValue = parseInt(kmEnd, 10);
    if (isNaN(kmValue) || kmValue <= 0) return;

    let lat: number | null = null;
    let lng: number | null = null;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }
    } catch {}

    completeMutation.mutate({ kmEnd: kmValue, lat, lng, notes: extraNotes });
  }, [kmEnd, extraNotes, serviceId]);

  const formatTime = (isoStr: string | null) => {
    if (!isoStr) return "N/D";
    const d = new Date(isoStr);
    return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  };

  const formatCoords = (lat: number | string | null, lng: number | string | null) => {
    if (lat == null || lng == null) return "Non disponibile";
    const latNum = typeof lat === "string" ? parseFloat(lat) : lat;
    const lngNum = typeof lng === "string" ? parseFloat(lng) : lng;
    if (isNaN(latNum) || isNaN(lngNum)) return "Non disponibile";
    return `${latNum.toFixed(5)}, ${lngNum.toFixed(5)}`;
  };

  const calcDuration = (start: string | null) => {
    if (!start) return "N/D";
    const startMs = new Date(start).getTime();
    const nowMs = Date.now();
    const diffSec = Math.floor((nowMs - startMs) / 1000);
    const hrs = Math.floor(diffSec / 3600);
    const mins = Math.floor((diffSec % 3600) / 60);
    const secs = diffSec % 60;
    if (hrs > 0) return `${hrs}h ${mins.toString().padStart(2, "0")}m`;
    return `${mins}m ${secs.toString().padStart(2, "0")}s`;
  };

  const currentKm = user?.vehicle?.currentKm ?? service?.kmStart ?? 0;
  const enteredKm = parseInt(kmEnd, 10);
  const kmDriven = !isNaN(enteredKm) && enteredKm > currentKm ? enteredKm - currentKm : null;

  if (isLoading) {
    return (
      <ThemedView style={[styles.centered, { paddingTop: headerHeight + Spacing.xl }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </ThemedView>
    );
  }

  if (!service) {
    return (
      <ThemedView style={[styles.centered, { paddingTop: headerHeight + Spacing.xl }]}>
        <ThemedText>Servizio non trovato</ThemedText>
      </ThemedView>
    );
  }

  if (isCompleted) {
    return (
      <ThemedView style={{ flex: 1 }}>
        <KeyboardAwareScrollViewCompat
          contentContainerStyle={[
            styles.container,
            {
              paddingTop: headerHeight + Spacing.xl,
              paddingBottom: insets.bottom + Spacing.xl,
            },
          ]}
        >
          <View style={[styles.successBanner, { backgroundColor: theme.success + "20" }]}>
            <View style={[styles.successIcon, { backgroundColor: theme.success }]}>
              <Feather name="check" size={32} color="#FFFFFF" />
            </View>
            <ThemedText type="h2" style={{ marginTop: Spacing.md, textAlign: "center" }}>
              Servizio completato
            </ThemedText>
            <ThemedText
              type="small"
              style={{ color: theme.textSecondary, marginTop: Spacing.xs, textAlign: "center" }}
            >
              {service.progressiveCode ? `#${service.progressiveCode}` : ""}
            </ThemedText>
          </View>

          <Card style={[styles.summaryCard, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>
              Riepilogo
            </ThemedText>
            <SummaryRow
              icon="clock"
              label="Inizio"
              value={formatTime(service.actualStartTime)}
              theme={theme}
            />
            <SummaryRow
              icon="clock"
              label="Fine"
              value={formatTime(new Date().toISOString())}
              theme={theme}
            />
            <SummaryRow
              icon="activity"
              label="Durata"
              value={calcDuration(service.actualStartTime)}
              theme={theme}
            />
            <SummaryRow
              icon="navigation"
              label="GPS Partenza"
              value={formatCoords(service.startGpsLat, service.startGpsLng)}
              theme={theme}
            />
            {kmEnd ? (
              <SummaryRow
                icon="truck"
                label="Km Finale"
                value={`${kmEnd} km`}
                theme={theme}
              />
            ) : null}
            {kmDriven != null ? (
              <SummaryRow
                icon="trending-up"
                label="Km Percorsi"
                value={`${kmDriven} km`}
                theme={theme}
              />
            ) : null}
          </Card>

          {nextService ? (
            <Card style={[styles.nextCard, { backgroundColor: theme.primaryLight }]}>
              <View style={styles.nextHeader}>
                <Feather name="arrow-right-circle" size={18} color={theme.primary} />
                <ThemedText type="label" style={{ color: theme.primary, marginLeft: Spacing.sm }}>
                  PROSSIMO SERVIZIO
                </ThemedText>
              </View>
              <ThemedText type="h3" style={{ marginTop: Spacing.sm }}>
                {nextService.progressiveCode ? `#${nextService.progressiveCode}` : "Servizio"}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
                {nextService.scheduledTime
                  ? formatTime(nextService.scheduledTime)
                  : "Orario non definito"}
              </ThemedText>
              <View style={styles.routeRow}>
                <Feather name="map-pin" size={14} color={theme.success} />
                <ThemedText type="small" style={{ marginLeft: Spacing.xs, flex: 1 }}>
                  {nextService.originName || nextService.originCity || "Partenza"}{" "}
                  {nextService.destinationName || nextService.destinationCity
                    ? `\u2192 ${nextService.destinationName || nextService.destinationCity}`
                    : ""}
                </ThemedText>
              </View>
            </Card>
          ) : null}

          <Pressable
            style={[styles.backButton, { backgroundColor: theme.primary }]}
            onPress={() => navigation.navigate("Oggi")}
          >
            <Feather name="list" size={20} color="#FFFFFF" />
            <ThemedText type="h3" style={{ color: "#FFFFFF", marginLeft: Spacing.sm }}>
              Torna ai servizi
            </ThemedText>
          </Pressable>
        </KeyboardAwareScrollViewCompat>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
      >
        <Card style={[styles.autoSection, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.sectionHeader}>
            <ThemedText type="h3">Dati registrati automaticamente</ThemedText>
          </View>

          <AutoRow
            label="Ora inizio"
            value={formatTime(service.actualStartTime)}
            theme={theme}
          />
          <AutoRow
            label="Ora fine"
            value={formatTime(new Date().toISOString())}
            theme={theme}
          />
          <AutoRow
            label="Durata"
            value={calcDuration(service.actualStartTime)}
            theme={theme}
          />
          <AutoRow
            label="GPS partenza"
            value={formatCoords(service.startGpsLat, service.startGpsLng)}
            theme={theme}
          />
          <AutoRow
            label="GPS arrivo"
            value="Registrato alla conferma"
            theme={theme}
            italic
          />
        </Card>

        <Card style={[styles.manualSection, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h3" style={{ marginBottom: Spacing.lg }}>
            Dati manuali
          </ThemedText>
          <ThemedText type="label" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
            Km contachilometri finale
          </ThemedText>
          <TextInput
            style={[
              styles.kmInput,
              {
                backgroundColor: theme.inputBackground,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
            value={kmEnd}
            onChangeText={setKmEnd}
            keyboardType="numeric"
            placeholder="Es. 145320"
            placeholderTextColor={theme.textSecondary}
            textAlign="center"
          />
          {kmDriven != null ? (
            <View style={[styles.kmCalc, { backgroundColor: theme.successLight }]}>
              <Feather name="trending-up" size={16} color={theme.success} />
              <ThemedText
                type="body"
                style={{ color: theme.success, marginLeft: Spacing.sm, fontWeight: "600" }}
              >
                Km percorsi: {kmDriven} km
              </ThemedText>
            </View>
          ) : null}

          <ThemedText
            type="label"
            style={{ color: theme.textSecondary, marginTop: Spacing.xl, marginBottom: Spacing.sm }}
          >
            Note (opzionale)
          </ThemedText>
          <TextInput
            style={[
              styles.notesInput,
              {
                backgroundColor: theme.inputBackground,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
            value={extraNotes}
            onChangeText={setExtraNotes}
            placeholder="Note aggiuntive..."
            placeholderTextColor={theme.textSecondary}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </Card>

        <Pressable
          style={[
            styles.confirmButton,
            { backgroundColor: theme.success },
            (completeMutation.isPending || !kmEnd) && styles.buttonDisabled,
          ]}
          onPress={handleConfirm}
          disabled={completeMutation.isPending || !kmEnd}
        >
          {completeMutation.isPending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Feather name="check-circle" size={22} color="#FFFFFF" />
              <ThemedText type="h3" style={{ color: "#FFFFFF", marginLeft: Spacing.sm }}>
                CONFERMA E CHIUDI SERVIZIO
              </ThemedText>
            </>
          )}
        </Pressable>

        {completeMutation.isError ? (
          <View style={[styles.errorBox, { backgroundColor: theme.errorLight }]}>
            <Feather name="alert-circle" size={16} color={theme.error} />
            <ThemedText type="small" style={{ color: theme.error, marginLeft: Spacing.sm, flex: 1 }}>
              Errore nella chiusura del servizio. Riprova.
            </ThemedText>
          </View>
        ) : null}
      </KeyboardAwareScrollViewCompat>
    </ThemedView>
  );
}

function AutoRow({
  label,
  value,
  theme,
  italic,
}: {
  label: string;
  value: string;
  theme: any;
  italic?: boolean;
}) {
  return (
    <View style={styles.autoRow}>
      <View style={styles.autoRowLeft}>
        <View style={[styles.autoBadge, { backgroundColor: theme.primaryLight }]}>
          <ThemedText type="label" style={{ color: theme.primary, fontSize: 9, fontWeight: "700" }}>
            AUTO
          </ThemedText>
        </View>
        <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
          {label}
        </ThemedText>
      </View>
      <ThemedText
        type="body"
        style={[
          { color: theme.textSecondary },
          italic ? { fontStyle: "italic", fontSize: 12 } : null,
        ]}
      >
        {value}
      </ThemedText>
    </View>
  );
}

function SummaryRow({
  icon,
  label,
  value,
  theme,
}: {
  icon: any;
  label: string;
  value: string;
  theme: any;
}) {
  return (
    <View style={styles.summaryRow}>
      <View style={styles.summaryRowLeft}>
        <Feather name={icon} size={16} color={theme.textSecondary} />
        <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
          {label}
        </ThemedText>
      </View>
      <ThemedText type="body" style={{ fontWeight: "600" }}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
  },
  autoSection: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
  },
  sectionHeader: {
    marginBottom: Spacing.lg,
  },
  autoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  autoRowLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  autoBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  manualSection: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
  },
  kmInput: {
    fontSize: 28,
    fontWeight: "700",
    borderWidth: 1.5,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    height: 72,
  },
  kmCalc: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  notesInput: {
    fontSize: 15,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    minHeight: 80,
  },
  confirmButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 56,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  successBanner: {
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  summaryRowLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  nextCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
  },
  nextHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 56,
    borderRadius: BorderRadius.lg,
  },
});
