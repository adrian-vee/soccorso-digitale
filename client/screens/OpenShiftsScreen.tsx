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
import { CrewPickerModal } from "@/components/CrewPickerModal";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface ShiftInstance {
  id: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  vehicleId: string | null;
  locationId: string;
  status: string;
  minStaff: number;
  maxStaff: number;
  currentStaffCount: number;
  isCovered: boolean;
  allowSelfSignup: boolean;
  notes: string | null;
}

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  primaryRole: string;
  locationId: string;
}

export default function OpenShiftsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [signingUp, setSigningUp] = useState<string | null>(null);
  const [showCrewPicker, setShowCrewPicker] = useState(false);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];

  const { data: openShifts, isLoading } = useQuery<ShiftInstance[]>({
    queryKey: [`/api/shift-instances/open?dateFrom=${today}`],
  });

  const signupMutation = useMutation({
    mutationFn: async ({ shiftInstanceId, staffMemberId, role }: { shiftInstanceId: string; staffMemberId: string; role: string }) => {
      return apiRequest("POST", `/api/shift-instances/${shiftInstanceId}/signup`, {
        staffMemberId,
        role,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("/api/shift-instances");
        }
      });
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert("Iscrizione confermata", "Iscrizione effettuata con successo. L'amministratore vedra la disponibilita.");
    },
    onError: (error: Error) => {
      Alert.alert("Errore", error.message || "Impossibile iscriversi al turno");
    },
    onSettled: () => {
      setSigningUp(null);
      setSelectedShiftId(null);
    },
  });

  const handleSignupPress = (shiftId: string) => {
    setSelectedShiftId(shiftId);
    setShowCrewPicker(true);
  };

  const handleCrewSelect = (member: StaffMember) => {
    setShowCrewPicker(false);
    if (selectedShiftId) {
      setSigningUp(selectedShiftId);
      signupMutation.mutate({
        shiftInstanceId: selectedShiftId,
        staffMemberId: member.id,
        role: member.primaryRole || "soccorritore",
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("it-IT", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  };

  const formatTime = (time: string) => time.slice(0, 5);

  const getMissingStaff = (shift: ShiftInstance) => {
    return Math.max(0, shift.minStaff - (shift.currentStaffCount || 0));
  };

  const renderShiftCard = useCallback(({ item }: { item: ShiftInstance }) => {
    const missingStaff = getMissingStaff(item);

    return (
      <Card style={styles.shiftCard}>
        <View style={styles.dateHeader}>
          <Feather name="calendar" size={16} color={theme.primary} />
          <ThemedText type="label" style={{ marginLeft: Spacing.xs, textTransform: "capitalize" }}>
            {formatDate(item.shiftDate)}
          </ThemedText>
        </View>

        <View style={styles.timeRow}>
          <Feather name="clock" size={14} color={theme.textSecondary} />
          <ThemedText style={{ marginLeft: Spacing.xs }}>
            {formatTime(item.startTime)} - {formatTime(item.endTime)}
          </ThemedText>
        </View>

        <View style={[styles.urgencyBadge, { backgroundColor: theme.warning + "20" }]}>
          <Feather name="alert-triangle" size={14} color={theme.warning} />
          <ThemedText type="small" style={{ color: theme.warning, marginLeft: Spacing.xs }}>
            Mancano {missingStaff} {missingStaff === 1 ? "persona" : "persone"}
          </ThemedText>
        </View>

        {item.notes && (
          <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
            {item.notes}
          </ThemedText>
        )}

        {item.allowSelfSignup && (
          <Pressable
            style={[styles.signupButton, { backgroundColor: theme.primary }]}
            onPress={() => handleSignupPress(item.id)}
            disabled={signingUp === item.id}
          >
            {signingUp === item.id ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="user-plus" size={16} color="#fff" />
                <ThemedText style={{ color: "#fff", marginLeft: Spacing.xs }}>
                  Mi rendo disponibile
                </ThemedText>
              </>
            )}
          </Pressable>
        )}
      </Card>
    );
  }, [theme, signingUp, handleSignupPress]);

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.content, { paddingTop: headerHeight + Spacing.md }]}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : !openShifts?.length ? (
          <View style={styles.emptyState}>
            <Feather name="check-circle" size={64} color={theme.success} />
            <ThemedText type="h3" style={{ marginTop: Spacing.lg, textAlign: "center" }}>
              Tutti i turni sono coperti
            </ThemedText>
            <ThemedText style={{ color: theme.textSecondary, marginTop: Spacing.sm, textAlign: "center" }}>
              Non ci sono turni scoperti al momento
            </ThemedText>
          </View>
        ) : (
          <>
            <View style={[styles.alertBanner, { backgroundColor: theme.warning + "15" }]}>
              <Feather name="alert-circle" size={20} color={theme.warning} />
              <ThemedText style={{ marginLeft: Spacing.sm, flex: 1 }}>
                {openShifts.length} {openShifts.length === 1 ? "turno scoperto" : "turni scoperti"}
              </ThemedText>
            </View>

            <FlatList
              data={openShifts}
              keyExtractor={(item) => item.id}
              renderItem={renderShiftCard}
              contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}
              showsVerticalScrollIndicator={false}
            />
          </>
        )}
      </View>

      <CrewPickerModal
        visible={showCrewPicker}
        onClose={() => {
          setShowCrewPicker(false);
          setSelectedShiftId(null);
        }}
        onSelect={handleCrewSelect}
        title="Chi si iscrive al turno?"
      />
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
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  shiftCard: {
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  dateHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  urgencyBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    alignSelf: "flex-start",
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
