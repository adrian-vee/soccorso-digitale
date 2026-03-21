import React from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl, getAuthToken } from "@/lib/query-client";
import type { Handoff } from "@shared/schema";

const getPriorityConfig = (isDark: boolean) => ({
  urgent: { label: "Urgente", icon: "alert-triangle" as const, color: "#DC2626", bgColor: isDark ? "rgba(220,38,38,0.15)" : "#FEE2E2" },
  normal: { label: "Normale", icon: "info" as const, color: "#0066CC", bgColor: isDark ? "rgba(0,102,204,0.15)" : "#DBEAFE" },
  low: { label: "Bassa", icon: "minus" as const, color: "#6B7280", bgColor: isDark ? "rgba(107,114,128,0.15)" : "#F3F4F6" },
});

const CATEGORY_CONFIG = {
  general: { label: "Generale", icon: "file-text" as const },
  maintenance: { label: "Manutenzione", icon: "tool" as const },
  equipment: { label: "Attrezzatura", icon: "package" as const },
  patient: { label: "Paziente", icon: "heart" as const },
  safety: { label: "Sicurezza", icon: "shield" as const },
};

export default function HandoffHistoryScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation();
  const { user } = useAuth();

  const vehicleId = user?.vehicle?.id;

  const { data: handoffs, isLoading, refetch, isRefetching } = useQuery<Handoff[]>({
    queryKey: ["/api/handoffs/vehicle", vehicleId],
    queryFn: async () => {
      if (!vehicleId) return [];
      const token = await getAuthToken();
      const url = new URL(`/api/handoffs/vehicle/${vehicleId}`, getApiUrl());
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(url.toString(), { credentials: "include", headers });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!vehicleId,
  });

  const formatDate = (dateStr: string | Date) => {
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    return date.toLocaleDateString("it-IT", { 
      weekday: "short",
      day: "2-digit", 
      month: "short", 
      year: "numeric",
    });
  };

  const formatTime = (dateStr: string | Date) => {
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    return date.toLocaleTimeString("it-IT", { 
      hour: "2-digit", 
      minute: "2-digit" 
    });
  };

  const renderHandoff = ({ item, index }: { item: Handoff; index: number }) => {
    const PRIORITY_CONFIG = getPriorityConfig(isDark);
    const priorityKey = (item.priority as keyof ReturnType<typeof getPriorityConfig>) || "normal";
    const categoryKey = (item.category as keyof typeof CATEGORY_CONFIG) || "general";
    const priorityConfig = PRIORITY_CONFIG[priorityKey] || PRIORITY_CONFIG.normal;
    const categoryConfig = CATEGORY_CONFIG[categoryKey] || CATEGORY_CONFIG.general;
    const isRead = item.status === "read";

    return (
      <View style={[
        styles.card,
        { backgroundColor: theme.cardBackground },
        index === 0 && styles.cardFirst,
      ]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.statusIndicator, { backgroundColor: isRead ? theme.success : priorityConfig.color }]} />
            <View style={styles.headerInfo}>
              <View style={styles.categoryRow}>
                <Feather name={categoryConfig.icon} size={14} color={theme.textSecondary} />
                <ThemedText style={[styles.categoryLabel, { color: theme.textSecondary }]}>
                  {categoryConfig.label}
                </ThemedText>
              </View>
              <ThemedText style={[styles.dateText, { color: theme.text }]}>
                {formatDate(item.createdAt)}
              </ThemedText>
            </View>
          </View>
          <View style={[styles.priorityChip, { backgroundColor: priorityConfig.bgColor }]}>
            <Feather name={priorityConfig.icon} size={12} color={priorityConfig.color} />
            <ThemedText style={[styles.priorityLabel, { color: priorityConfig.color }]}>
              {priorityConfig.label}
            </ThemedText>
          </View>
        </View>

        <View style={[styles.messageContainer, { backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)" }]}>
          <ThemedText style={[styles.messageText, { color: theme.text }]}>
            {item.message || "Nessun messaggio"}
          </ThemedText>
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <View style={[styles.metaIcon, { backgroundColor: theme.primaryLight }]}>
              <Feather name="edit-3" size={12} color={theme.primary} />
            </View>
            <View style={styles.metaContent}>
              <ThemedText style={[styles.metaLabel, { color: theme.textSecondary }]}>Scritta</ThemedText>
              <ThemedText style={[styles.metaValue, { color: theme.text }]}>{formatTime(item.createdAt)}</ThemedText>
              <ThemedText style={[styles.metaAuthor, { color: theme.textSecondary }]} numberOfLines={1}>
                {item.createdByName || '-'}
              </ThemedText>
            </View>
          </View>

          {isRead && item.readAt ? (
            <View style={styles.metaItem}>
              <View style={[styles.metaIcon, { backgroundColor: theme.success + "20" }]}>
                <Feather name="check-circle" size={12} color={theme.success} />
              </View>
              <View style={styles.metaContent}>
                <ThemedText style={[styles.metaLabel, { color: theme.textSecondary }]}>Letta da</ThemedText>
                <ThemedText style={[styles.metaValue, { color: theme.text }]}>{formatTime(item.readAt)}</ThemedText>
                <ThemedText style={[styles.metaAuthor, { color: theme.textSecondary }]} numberOfLines={1}>
                  {item.readByName || '-'}
                </ThemedText>
              </View>
            </View>
          ) : (
            <View style={styles.metaItem}>
              <View style={[styles.metaIcon, { backgroundColor: isDark ? "rgba(217,119,6,0.15)" : "#FEF3C7" }]}>
                <Feather name="clock" size={12} color="#D97706" />
              </View>
              <View style={styles.metaContent}>
                <ThemedText style={[styles.metaLabel, { color: theme.textSecondary }]}>Stato</ThemedText>
                <ThemedText style={[styles.metaValue, { color: "#D97706" }]}>In attesa</ThemedText>
                <ThemedText style={[styles.metaAuthor, { color: theme.textSecondary }]}>di conferma</ThemedText>
              </View>
            </View>
          )}

          {item.kmAtHandoff && (
            <View style={styles.metaItem}>
              <View style={[styles.metaIcon, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" }]}>
                <Feather name="navigation" size={12} color={theme.textSecondary} />
              </View>
              <View style={styles.metaContent}>
                <ThemedText style={[styles.metaLabel, { color: theme.textSecondary }]}>Km</ThemedText>
                <ThemedText style={[styles.metaValue, { color: theme.text }]}>{item.kmAtHandoff.toLocaleString()}</ThemedText>
              </View>
            </View>
          )}
        </View>
      </View>
    );
  };

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIconContainer, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,102,204,0.08)" }]}>
        <Feather name="inbox" size={40} color={theme.primary} />
      </View>
      <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
        Nessuna consegna
      </ThemedText>
      <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        Le consegne tra turni appariranno qui.{"\n"}Crea la prima dalla schermata Home.
      </ThemedText>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <LinearGradient
        colors={isDark 
          ? ["#0a1628", "#0d1f3c", theme.backgroundRoot]
          : ["#0066CC", "#0052A3", theme.backgroundRoot]
        }
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={22} color="#FFF" />
        </Pressable>
        <View style={styles.headerTitleContainer}>
          <ThemedText style={styles.headerTitle}>Storico Consegne</ThemedText>
          <ThemedText style={styles.headerSubtitle}>
            {user?.vehicle?.code || "Veicolo"}
          </ThemedText>
        </View>
        <View style={styles.headerRight}>
          {handoffs && handoffs.length > 0 && (
            <View style={styles.countBadge}>
              <ThemedText style={styles.countText}>{handoffs.length}</ThemedText>
            </View>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
            Caricamento...
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={handoffs}
          renderItem={renderHandoff}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: tabBarHeight + Spacing.xl },
            (!handoffs || handoffs.length === 0) && styles.emptyList,
          ]}
          ListEmptyComponent={EmptyState}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 180,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleContainer: {
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFF",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
  headerRight: {
    width: 40,
    alignItems: "center",
  },
  countBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  emptyList: {
    flex: 1,
  },
  separator: {
    height: Spacing.md,
  },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardFirst: {
    marginTop: 0,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    flex: 1,
  },
  statusIndicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: Spacing.sm,
  },
  headerInfo: {
    flex: 1,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  dateText: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  priorityChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  priorityLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  messageContainer: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "400",
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    minWidth: "45%",
    flex: 1,
  },
  metaIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  metaContent: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 1,
  },
  metaAuthor: {
    fontSize: 11,
    marginTop: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: Spacing.xs,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
});
