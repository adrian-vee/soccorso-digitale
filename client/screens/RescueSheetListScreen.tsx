import React from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";

const DISPATCH_COLORS: Record<string, string> = {
  C: "#E0E0E0",
  B: "#00A651",
  V: "#FFC107",
  G: "#FF8C00",
  R: "#DC3545",
};

export default function RescueSheetListScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const vehicleId = user?.vehicle?.id;

  const { data: sheets = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/rescue-sheets", vehicleId],
    enabled: !!vehicleId,
  });

  const renderItem = ({ item }: { item: any }) => {
    const isCompleted = item.status === "completed";
    const dispatchColor = DISPATCH_COLORS[item.dispatchCode] || "#999";
    
    return (
      <View style={[styles.card, { borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" }]}>
        <LinearGradient
          colors={["rgba(0,102,204,0.12)", "rgba(0,166,81,0.08)"]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.statusBadge, { backgroundColor: isCompleted ? "#00A651" : "#6C757D" }]}>
              <Feather name={isCompleted ? "check-circle" : "edit-3"} size={10} color="#FFF" />
              <ThemedText style={styles.statusText}>
                {isCompleted ? "COMPLETATA" : "BOZZA"}
              </ThemedText>
            </View>
            {item.dispatchCode ? (
              <View style={[styles.codeBadge, { backgroundColor: dispatchColor }]}>
                <ThemedText style={[styles.codeText, { color: item.dispatchCode === "C" || item.dispatchCode === "V" ? "#333" : "#FFF" }]}>
                  {item.dispatchCode}
                </ThemedText>
              </View>
            ) : null}
          </View>
          <ThemedText style={styles.progressiveNum}>#{item.progressiveNumber}</ThemedText>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardRow}>
            <Feather name="calendar" size={14} color={theme.textSecondary} />
            <ThemedText style={styles.cardValue}>{item.sheetDate}</ThemedText>
          </View>

          {item.pazienteCognome || item.pazienteNome ? (
            <View style={styles.cardRow}>
              <Feather name="user" size={14} color={theme.textSecondary} />
              <ThemedText style={styles.cardValue}>
                {[item.pazienteCognome, item.pazienteNome].filter(Boolean).join(" ")}
              </ThemedText>
            </View>
          ) : null}

          {item.luogoComune ? (
            <View style={styles.cardRow}>
              <Feather name="map-pin" size={14} color={theme.textSecondary} />
              <ThemedText style={styles.cardValue}>
                {[item.luogoComune, item.luogoVia].filter(Boolean).join(", ")}
              </ThemedText>
            </View>
          ) : null}

          {item.oraAttivazione ? (
            <View style={styles.cardRow}>
              <Feather name="clock" size={14} color={theme.textSecondary} />
              <ThemedText style={styles.cardValue}>Attivazione: {item.oraAttivazione}</ThemedText>
            </View>
          ) : null}
        </View>
      </View>
    );
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

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={theme.primary} size="large" />
        </View>
      ) : sheets.length === 0 ? (
        <View style={[styles.emptyContainer, { paddingTop: headerHeight + 60 }]}>
          <Feather name="file-text" size={48} color={theme.textSecondary} />
          <ThemedText style={[styles.emptyTitle, { color: theme.textSecondary }]}>
            Nessuna scheda di soccorso
          </ThemedText>
          <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            Le schede compilate appariranno qui
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={sheets}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{
            paddingTop: headerHeight + Spacing.sm,
            paddingBottom: tabBarHeight + Spacing.xl,
            paddingHorizontal: Spacing.lg,
          }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Pressable
        style={[styles.fab, { bottom: tabBarHeight + Spacing.lg }]}
        onPress={() => navigation.navigate("RescueSheet")}
      >
        <LinearGradient
          colors={["#0066CC", "#004A99"]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <Feather name="plus" size={24} color="#FFF" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "700", marginTop: Spacing.lg },
  emptySubtitle: { fontSize: 14, marginTop: Spacing.sm, textAlign: "center" },
  card: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    overflow: "hidden",
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  cardHeaderLeft: { flexDirection: "row", gap: 8, alignItems: "center" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusText: { color: "#FFF", fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  codeBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  codeText: { fontSize: 12, fontWeight: "900" },
  progressiveNum: { fontSize: 16, fontWeight: "800", opacity: 0.5 },
  cardBody: { gap: 6 },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardValue: { fontSize: 13, fontWeight: "500" },
  fab: {
    position: "absolute",
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
