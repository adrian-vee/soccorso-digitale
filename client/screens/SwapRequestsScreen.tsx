import React, { useState } from "react";
import { View, StyleSheet, FlatList, Pressable, ActivityIndicator, Platform, Alert, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface SwapRequest {
  id: string;
  requesterId: string;
  requesterAssignmentId: string;
  targetStaffId: string | null;
  targetAssignmentId: string | null;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  reason: string | null;
  createdAt: string;
  resolvedAt: string | null;
  requesterName?: string;
  targetStaffName?: string;
  shiftDate?: string;
}

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  primaryRole: string;
}

export default function SwapRequestsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState<"incoming" | "outgoing">("incoming");

  const { data: staffMember } = useQuery<StaffMember | null>({
    queryKey: user?.id ? [`/api/staff-members/by-user/${user.id}`] : [null],
    enabled: !!user?.id,
  });

  const { data: swapRequests, isLoading } = useQuery<SwapRequest[]>({
    queryKey: [`/api/shift-swap-requests`],
    enabled: !!staffMember?.id,
  });

  const respondMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "accepted" | "rejected" }) => {
      return apiRequest("PATCH", `/api/shift-swap-requests/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/shift-swap-requests`] });
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === "string" && key.startsWith("/api/shift-instances");
      }});
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert("Risposta inviata", "La tua risposta e stata registrata.");
    },
    onError: (error: Error) => {
      Alert.alert("Errore", error.message || "Impossibile rispondere alla richiesta");
    },
  });

  const filteredRequests = React.useMemo(() => {
    if (!swapRequests || !staffMember) return [];
    if (selectedTab === "incoming") {
      return swapRequests.filter(r => r.targetStaffId === staffMember.id && r.status === "pending");
    }
    return swapRequests.filter(r => r.requesterId === staffMember.id);
  }, [swapRequests, staffMember, selectedTab]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return theme.warning;
      case "accepted": return theme.success;
      case "rejected": return theme.error;
      case "cancelled": return theme.textSecondary;
      default: return theme.textSecondary;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "In attesa",
      accepted: "Accettata",
      rejected: "Rifiutata",
      cancelled: "Annullata",
    };
    return labels[status] || status;
  };

  const handleRespond = (id: string, accept: boolean) => {
    Alert.alert(
      accept ? "Accetta scambio" : "Rifiuta scambio",
      accept ? "Vuoi accettare questa richiesta di scambio turno?" : "Vuoi rifiutare questa richiesta di scambio turno?",
      [
        { text: "Annulla", style: "cancel" },
        {
          text: accept ? "Accetta" : "Rifiuta",
          style: accept ? "default" : "destructive",
          onPress: () => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            respondMutation.mutate({ id, status: accept ? "accepted" : "rejected" });
          },
        },
      ]
    );
  };

  const renderSwapRequest = ({ item }: { item: SwapRequest }) => {
    const statusColor = getStatusColor(item.status);
    const isIncoming = item.targetStaffId === staffMember?.id;
    const canRespond = isIncoming && item.status === "pending";

    return (
      <Card style={styles.requestCard}>
        <View style={styles.requestHeader}>
          <View style={styles.requestInfo}>
            <Feather name="repeat" size={18} color={theme.primary} />
            <ThemedText type="label" style={{ marginLeft: Spacing.sm }}>
              Richiesta di Scambio
            </ThemedText>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
            <ThemedText type="small" style={{ color: statusColor }}>
              {getStatusLabel(item.status)}
            </ThemedText>
          </View>
        </View>

        <View style={styles.requestDetails}>
          <View style={styles.detailRow}>
            <Feather name="user" size={14} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
              {isIncoming ? `Da: ${item.requesterName || "Collega"}` : `A: ${item.targetStaffName || "Collega"}`}
            </ThemedText>
          </View>
          {item.shiftDate && (
            <View style={styles.detailRow}>
              <Feather name="calendar" size={14} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
                {new Date(item.shiftDate).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}
              </ThemedText>
            </View>
          )}
          {item.reason && (
            <View style={styles.detailRow}>
              <Feather name="message-circle" size={14} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.xs, flex: 1 }}>
                {item.reason}
              </ThemedText>
            </View>
          )}
          <View style={styles.detailRow}>
            <Feather name="clock" size={14} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
              {new Date(item.createdAt).toLocaleDateString("it-IT")}
            </ThemedText>
          </View>
        </View>

        {canRespond && (
          <View style={styles.actionButtons}>
            <Pressable
              style={[styles.rejectButton, { backgroundColor: theme.error + "20" }]}
              onPress={() => handleRespond(item.id, false)}
              disabled={respondMutation.isPending}
            >
              <Feather name="x" size={18} color={theme.error} />
              <ThemedText style={{ color: theme.error, marginLeft: Spacing.xs }}>
                Rifiuta
              </ThemedText>
            </Pressable>
            <Pressable
              style={[styles.acceptButton, { backgroundColor: theme.success }]}
              onPress={() => handleRespond(item.id, true)}
              disabled={respondMutation.isPending}
            >
              {respondMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Feather name="check" size={18} color="#fff" />
                  <ThemedText style={{ color: "#fff", marginLeft: Spacing.xs }}>
                    Accetta
                  </ThemedText>
                </>
              )}
            </Pressable>
          </View>
        )}
      </Card>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.content, { paddingTop: headerHeight + Spacing.md }]}>
        <View style={styles.tabContainer}>
          <Pressable
            style={[
              styles.tab,
              selectedTab === "incoming" && { backgroundColor: theme.primary + "20" },
            ]}
            onPress={() => {
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedTab("incoming");
            }}
          >
            <Feather name="inbox" size={18} color={selectedTab === "incoming" ? theme.primary : theme.textSecondary} />
            <ThemedText
              type="label"
              style={{ marginLeft: Spacing.xs, color: selectedTab === "incoming" ? theme.primary : theme.textSecondary }}
            >
              Ricevute
            </ThemedText>
          </Pressable>
          <Pressable
            style={[
              styles.tab,
              selectedTab === "outgoing" && { backgroundColor: theme.primary + "20" },
            ]}
            onPress={() => {
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedTab("outgoing");
            }}
          >
            <Feather name="send" size={18} color={selectedTab === "outgoing" ? theme.primary : theme.textSecondary} />
            <ThemedText
              type="label"
              style={{ marginLeft: Spacing.xs, color: selectedTab === "outgoing" ? theme.primary : theme.textSecondary }}
            >
              Inviate
            </ThemedText>
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : filteredRequests.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="repeat" size={48} color={theme.textSecondary} />
            <ThemedText style={{ color: theme.textSecondary, marginTop: Spacing.md, textAlign: "center" }}>
              {selectedTab === "incoming" 
                ? "Nessuna richiesta di scambio in attesa"
                : "Non hai inviato richieste di scambio"
              }
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={filteredRequests}
            keyExtractor={(item) => item.id}
            renderItem={renderSwapRequest}
            contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  tabContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  requestCard: {
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  requestHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  requestInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  requestDetails: {
    gap: Spacing.xs,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  rejectButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  acceptButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
});
