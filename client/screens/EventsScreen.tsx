import React, { useCallback, useState } from "react";
import { View, StyleSheet, FlatList, Pressable, ActivityIndicator, Platform, Alert } from "react-native";
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

interface ServiceEvent {
  id: string;
  eventName: string;
  eventType: string;
  eventDate: string;
  startTime: string;
  endTime: string | null;
  locationAddress: string | null;
  description: string | null;
  status: string;
  requiredStaff: number;
  currentStaffCount: number;
  allowSelfSignup: boolean;
  notes: string | null;
}

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  primaryRole: string;
}

interface EventAssignment {
  id: string;
  eventId: string;
  staffMemberId: string;
  assignedRole: string;
  status: string;
}

export default function EventsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [signingUp, setSigningUp] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];

  const { data: events, isLoading } = useQuery<ServiceEvent[]>({
    queryKey: [`/api/service-events?dateFrom=${today}`],
  });

  const { data: staffMember } = useQuery<StaffMember | null>({
    queryKey: user?.id ? [`/api/staff-members/by-user/${user.id}`] : [null],
    enabled: !!user?.id,
  });

  const { data: myAssignments } = useQuery<EventAssignment[]>({
    queryKey: staffMember?.id ? [`/api/event-assignments?staffMemberId=${staffMember.id}`] : [null],
    enabled: !!staffMember?.id,
  });

  const signupMutation = useMutation({
    mutationFn: async ({ eventId, role }: { eventId: string; role: string }) => {
      if (!staffMember?.id) throw new Error("Staff member not found");
      return apiRequest("POST", `/api/service-events/${eventId}/self-signup`, {
        staffMemberId: staffMember.id,
        role,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/service-events`] });
      queryClient.invalidateQueries({ queryKey: [`/api/event-assignments`] });
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert("Iscrizione confermata", "Ti sei iscritto con successo all'evento.");
    },
    onError: (error: Error) => {
      Alert.alert("Errore", error.message || "Impossibile iscriversi all'evento");
    },
    onSettled: () => {
      setSigningUp(null);
    },
  });

  const handleSignup = (eventId: string) => {
    if (!staffMember) {
      Alert.alert("Errore", "Non sei registrato come membro dello staff");
      return;
    }
    setSigningUp(eventId);
    signupMutation.mutate({
      eventId,
      role: staffMember.primaryRole || "soccorritore",
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("it-IT", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  };

  const formatTime = (time: string) => time.slice(0, 5);

  const getEventTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      sporting: "Evento Sportivo",
      cultural: "Evento Culturale",
      medical: "Assistenza Medica",
      emergency: "Emergenza",
      training: "Formazione",
      other: "Altro",
    };
    return labels[type] || type;
  };

  const getEventTypeIcon = (type: string): keyof typeof Feather.glyphMap => {
    const icons: Record<string, keyof typeof Feather.glyphMap> = {
      sporting: "activity",
      cultural: "music",
      medical: "heart",
      emergency: "alert-triangle",
      training: "book",
      other: "calendar",
    };
    return icons[type] || "calendar";
  };

  const isAssigned = (eventId: string) => {
    return myAssignments?.some((a) => a.eventId === eventId);
  };

  const renderEventCard = useCallback(({ item }: { item: ServiceEvent }) => {
    const assigned = isAssigned(item.id);
    const spotsLeft = item.requiredStaff - (item.currentStaffCount || 0);

    return (
      <Card style={styles.eventCard}>
        <View style={styles.eventHeader}>
          <View style={[styles.eventTypeBadge, { backgroundColor: theme.primary + "20" }]}>
            <Feather name={getEventTypeIcon(item.eventType)} size={14} color={theme.primary} />
            <ThemedText type="small" style={{ color: theme.primary, marginLeft: 4 }}>
              {getEventTypeLabel(item.eventType)}
            </ThemedText>
          </View>
          {assigned && (
            <View style={[styles.assignedBadge, { backgroundColor: theme.success + "20" }]}>
              <Feather name="check" size={12} color={theme.success} />
              <ThemedText type="small" style={{ color: theme.success, marginLeft: 4 }}>
                Assegnato
              </ThemedText>
            </View>
          )}
        </View>

        <ThemedText type="label" style={{ marginTop: Spacing.sm }}>
          {item.eventName}
        </ThemedText>

        <View style={styles.eventDetails}>
          <View style={styles.detailRow}>
            <Feather name="calendar" size={14} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
              {formatDate(item.eventDate)}
            </ThemedText>
          </View>
          <View style={styles.detailRow}>
            <Feather name="clock" size={14} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
              {formatTime(item.startTime)}
              {item.endTime ? ` - ${formatTime(item.endTime)}` : ""}
            </ThemedText>
          </View>
          {item.locationAddress && (
            <View style={styles.detailRow}>
              <Feather name="map-pin" size={14} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.xs, flex: 1 }}>
                {item.locationAddress}
              </ThemedText>
            </View>
          )}
          <View style={styles.detailRow}>
            <Feather name="users" size={14} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
              {item.currentStaffCount || 0}/{item.requiredStaff} personale
              {spotsLeft > 0 && ` (${spotsLeft} posti)`}
            </ThemedText>
          </View>
        </View>

        {item.description && (
          <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
            {item.description}
          </ThemedText>
        )}

        {!assigned && item.allowSelfSignup && spotsLeft > 0 && (
          <Pressable
            style={[styles.signupButton, { backgroundColor: theme.primary }]}
            onPress={() => handleSignup(item.id)}
            disabled={signingUp === item.id}
          >
            {signingUp === item.id ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="plus" size={16} color="#fff" />
                <ThemedText style={{ color: "#fff", marginLeft: Spacing.xs }}>
                  Partecipa
                </ThemedText>
              </>
            )}
          </Pressable>
        )}
      </Card>
    );
  }, [theme, staffMember, signingUp, myAssignments, handleSignup]);

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.content, { paddingTop: headerHeight + Spacing.md }]}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : !events?.length ? (
          <View style={styles.emptyState}>
            <Feather name="calendar" size={64} color={theme.textSecondary} />
            <ThemedText type="h3" style={{ marginTop: Spacing.lg, textAlign: "center" }}>
              Nessun evento programmato
            </ThemedText>
            <ThemedText style={{ color: theme.textSecondary, marginTop: Spacing.sm, textAlign: "center" }}>
              Non ci sono eventi o assistenze programmate
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={events}
            keyExtractor={(item) => item.id}
            renderItem={renderEventCard}
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
  eventCard: {
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  eventHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eventTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  assignedBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  eventDetails: {
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  signupButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
});
