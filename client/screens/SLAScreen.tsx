import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl, getAuthToken } from "@/lib/query-client";

export default function SLAScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const { data: slaData, isLoading } = useQuery<any>({
    queryKey: ["/api/sla/my-stats"],
    queryFn: async () => {
      const token = await getAuthToken();
      const url = new URL("/api/sla/my-stats", getApiUrl());
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(url.toString(), { credentials: "include", headers });
      if (!res.ok) throw new Error("Errore");
      return res.json();
    },
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </View>
    );
  }

  const statusColor = slaData?.status === "green" ? "#059669" : slaData?.status === "yellow" ? "#D97706" : "#DC2626";
  const statusBg = slaData?.status === "green" ? "#ECFDF5" : slaData?.status === "yellow" ? "#FFFBEB" : "#FEF2F2";
  const statusLabel = slaData?.status === "green" ? "CONFORME" : slaData?.status === "yellow" ? "ATTENZIONE" : "CRITICO";

  const violations = slaData?.recentViolations || [];

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <LinearGradient
        colors={isDark ? [theme.backgroundRoot, "#0a1628"] : ["#f8fafc", "#eef5f9"]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: insets.top + 60 + Spacing.md, paddingBottom: insets.bottom + Spacing.xl, paddingHorizontal: Spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(100).duration(500)}>
          <View style={[styles.statusBanner, { backgroundColor: statusBg, borderColor: statusColor + "40" }]}>
            <View style={[styles.statusIconWrap, { backgroundColor: statusColor + "20" }]}>
              <Feather
                name={slaData?.status === "green" ? "check-circle" : slaData?.status === "yellow" ? "alert-triangle" : "alert-octagon"}
                size={24}
                color={statusColor}
              />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={{ fontSize: 20, fontWeight: "800", color: statusColor }}>
                {statusLabel}
              </ThemedText>
              <ThemedText style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
                Mese: {slaData?.month} | {slaData?.totalTrips || 0} trasporti
              </ThemedText>
            </View>
            <View style={[styles.rateBadge, { backgroundColor: statusColor }]}>
              <ThemedText style={{ color: "#FFF", fontWeight: "800", fontSize: 16 }}>
                {slaData?.onTimeRate || 100}%
              </ThemedText>
              <ThemedText style={{ color: "rgba(255,255,255,0.8)", fontSize: 9, fontWeight: "600" }}>
                ON-TIME
              </ThemedText>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(200).duration(500)} style={{ marginTop: Spacing.md }}>
          <View style={styles.kpiRow}>
            <View style={[styles.kpiCard, { backgroundColor: isDark ? "rgba(220,38,38,0.1)" : "#FEF2F2" }]}>
              <View style={[styles.kpiIcon, { backgroundColor: "#DC262620" }]}>
                <Feather name="x-circle" size={16} color="#DC2626" />
              </View>
              <ThemedText style={{ fontSize: 28, fontWeight: "800", color: "#DC2626" }}>
                {slaData?.violationCount || 0}
              </ThemedText>
              <ThemedText style={{ fontSize: 10, color: theme.textSecondary, fontWeight: "600", marginTop: 2 }}>
                VIOLAZIONI
              </ThemedText>
            </View>

            <View style={[styles.kpiCard, { backgroundColor: isDark ? "rgba(5,150,105,0.1)" : "#ECFDF5" }]}>
              <View style={[styles.kpiIcon, { backgroundColor: "#05966920" }]}>
                <Feather name="check-circle" size={16} color="#059669" />
              </View>
              <ThemedText style={{ fontSize: 28, fontWeight: "800", color: "#059669" }}>
                {slaData?.onTimeRate || 100}%
              </ThemedText>
              <ThemedText style={{ fontSize: 10, color: theme.textSecondary, fontWeight: "600", marginTop: 2 }}>
                PUNTUALI
              </ThemedText>
            </View>

            <View style={[styles.kpiCard, { backgroundColor: isDark ? "rgba(217,119,6,0.1)" : "#FFFBEB" }]}>
              <View style={[styles.kpiIcon, { backgroundColor: "#D9770620" }]}>
                <Feather name="clock" size={16} color="#D97706" />
              </View>
              <ThemedText style={{ fontSize: 28, fontWeight: "800", color: "#D97706" }}>
                {slaData?.avgDelayMinutes || 0}
              </ThemedText>
              <ThemedText style={{ fontSize: 10, color: theme.textSecondary, fontWeight: "600", marginTop: 2 }}>
                MIN RITARDO
              </ThemedText>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(300).duration(500)} style={{ marginTop: Spacing.lg }}>
          <ThemedText style={{ fontSize: 16, fontWeight: "700", color: theme.text, marginBottom: Spacing.sm }}>
            Violazioni Recenti
          </ThemedText>

          {violations.length === 0 ? (
            <Card style={[styles.emptyCard, { borderColor: isDark ? "rgba(5,150,105,0.2)" : "rgba(5,150,105,0.15)" }]}>
              <View style={{ alignItems: "center", paddingVertical: Spacing.xl }}>
                <View style={[styles.emptyIcon, { backgroundColor: "#05966915" }]}>
                  <Feather name="check-circle" size={28} color="#059669" />
                </View>
                <ThemedText style={{ fontSize: 15, fontWeight: "700", color: "#059669", marginTop: Spacing.sm }}>
                  Nessuna Violazione
                </ThemedText>
                <ThemedText style={{ fontSize: 12, color: theme.textSecondary, marginTop: 4, textAlign: "center" }}>
                  Tutti i trasporti del mese sono conformi agli SLA
                </ThemedText>
              </View>
            </Card>
          ) : (
            violations.map((v: any, idx: number) => {
              const sevColor = v.slaViolationType === "delay_60min" ? "#DC2626" : v.slaViolationType === "gps_gap" ? "#6366f1" : "#D97706";
              const sevBg = v.slaViolationType === "delay_60min" ? "#FEF2F2" : v.slaViolationType === "gps_gap" ? "#EEF2FF" : "#FFFBEB";
              const sevLabel = v.slaViolationType === "delay_60min" ? "GRAVE" : v.slaViolationType === "gps_gap" ? "GPS" : "LIEVE";
              const dateStr = v.serviceDate ? new Date(v.serviceDate + "T00:00:00").toLocaleDateString("it-IT", { day: "2-digit", month: "short" }) : "-";

              return (
                <Animated.View key={v.id} entering={FadeIn.delay(350 + idx * 50).duration(400)}>
                  <Card style={[styles.violationCard, { borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }]}>
                    <View style={styles.violationHeader}>
                      <View style={[styles.sevBadge, { backgroundColor: sevBg }]}>
                        <ThemedText style={{ fontSize: 10, fontWeight: "700", color: sevColor }}>{sevLabel}</ThemedText>
                      </View>
                      <ThemedText style={{ fontSize: 11, color: theme.textSecondary }}>{dateStr}</ThemedText>
                    </View>
                    <View style={styles.violationBody}>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={{ fontSize: 13, fontWeight: "600", color: theme.text }} numberOfLines={1}>
                          {v.departure || "N/D"} → {v.destination || "N/D"}
                        </ThemedText>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                          <View style={[styles.vehicleBadge, { backgroundColor: "#EFF6FF" }]}>
                            <Feather name="truck" size={10} color="#2563EB" />
                            <ThemedText style={{ fontSize: 10, fontWeight: "600", color: "#2563EB", marginLeft: 3 }}>{v.vehicleCode}</ThemedText>
                          </View>
                        </View>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <ThemedText style={{ fontSize: 22, fontWeight: "800", color: sevColor }}>
                          +{v.slaViolationMinutes || 0}
                        </ThemedText>
                        <ThemedText style={{ fontSize: 10, color: theme.textSecondary, fontWeight: "500" }}>minuti</ThemedText>
                      </View>
                    </View>
                  </Card>
                </Animated.View>
              );
            })
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    gap: 12,
  },
  statusIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rateBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: "center",
  },
  kpiRow: {
    flexDirection: "row",
    gap: 10,
  },
  kpiCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  kpiIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  emptyCard: {
    borderWidth: 1,
    borderStyle: "dashed",
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  violationCard: {
    marginBottom: 8,
    borderWidth: 1,
    padding: Spacing.md,
  },
  violationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  violationBody: {
    flexDirection: "row",
    alignItems: "center",
  },
  sevBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  vehicleBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
});
