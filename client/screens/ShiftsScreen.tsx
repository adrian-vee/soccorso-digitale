import React, { useState, useMemo, useCallback } from "react";
import { View, StyleSheet, FlatList, Pressable, ActivityIndicator, Platform, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
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
import type { ShiftsStackParamList } from "@/navigation/ShiftsStackNavigator";

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
  assignments?: ShiftAssignment[];
}

interface ShiftAssignment {
  id: string;
  staffMemberId: string;
  assignedRole: string;
  status: string;
  checkedInAt: string | null;
  checkedOutAt: string | null;
}

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  primaryRole: string;
  locationId: string;
}

type ViewMode = "calendar" | "list";

type ShiftsNavigationProp = NativeStackNavigationProp<ShiftsStackParamList, "ShiftsList">;

export default function ShiftsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<ShiftsNavigationProp>();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [signingUp, setSigningUp] = useState<string | null>(null);
  const [showCrewPicker, setShowCrewPicker] = useState(false);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);

  const startOfWeek = useMemo(() => {
    const date = new Date(selectedDate);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    date.setDate(diff);
    date.setHours(0, 0, 0, 0);
    return date;
  }, [selectedDate]);

  const endOfWeek = useMemo(() => {
    const date = new Date(startOfWeek);
    date.setDate(date.getDate() + 6);
    return date;
  }, [startOfWeek]);

  const dateFrom = startOfWeek.toISOString().split("T")[0];
  const dateTo = endOfWeek.toISOString().split("T")[0];

  const { data: shifts, isLoading: shiftsLoading } = useQuery<ShiftInstance[]>({
    queryKey: [`/api/shift-instances?dateFrom=${dateFrom}&dateTo=${dateTo}`],
  });

  const { data: openShifts } = useQuery<ShiftInstance[]>({
    queryKey: [`/api/shift-instances/open?dateFrom=${dateFrom}`],
  });

  const { data: staffMember } = useQuery<StaffMember | null>({
    queryKey: user?.id ? [`/api/staff-members/by-user/${user.id}`] : [null],
    enabled: !!user?.id,
  });

  const signupMutation = useMutation({
    mutationFn: async ({ shiftInstanceId, staffMemberId, role }: { shiftInstanceId: string; staffMemberId: string; role: string }) => {
      return apiRequest("POST", `/api/shift-instances/${shiftInstanceId}/signup`, {
        staffMemberId,
        role,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === "string" && key.startsWith("/api/shift-instances");
      }});
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert("Iscrizione confermata", "Iscrizione effettuata con successo.");
    },
    onError: (error: Error) => {
      Alert.alert("Errore", error.message || "Impossibile iscriversi al turno");
    },
    onSettled: () => {
      setSigningUp(null);
      setSelectedShiftId(null);
    },
  });

  const checkInMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      return apiRequest("POST", `/api/shift-assignments/${assignmentId}/check-in`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === "string" && key.startsWith("/api/shift-instances");
      }});
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert("Check-in completato", "Il tuo turno e iniziato. Buon lavoro!");
    },
    onError: (error: Error) => {
      Alert.alert("Errore", error.message || "Impossibile effettuare il check-in");
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      return apiRequest("POST", `/api/shift-assignments/${assignmentId}/check-out`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === "string" && key.startsWith("/api/shift-instances");
      }});
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert("Check-out completato", "Hai completato il tuo turno. Grazie!");
    },
    onError: (error: Error) => {
      Alert.alert("Errore", error.message || "Impossibile effettuare il check-out");
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

  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(date.getDate() + i);
      days.push(date);
    }
    return days;
  }, [startOfWeek]);

  const shiftsGroupedByDate = useMemo(() => {
    if (!shifts) return {};
    const grouped: Record<string, ShiftInstance[]> = {};
    shifts.forEach((shift) => {
      const dateKey = shift.shiftDate;
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(shift);
    });
    return grouped;
  }, [shifts]);

  const navigateWeek = (direction: number) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + direction * 7);
    setSelectedDate(newDate);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("it-IT", { weekday: "short", day: "numeric" });
  };

  const formatTime = (time: string) => {
    return time.slice(0, 5);
  };

  const getStatusColor = (shift: ShiftInstance) => {
    if (shift.status === "completed") return theme.textSecondary;
    if (shift.status === "cancelled") return theme.error;
    if (shift.isCovered) return theme.success;
    return theme.warning;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: "Bozza",
      open: "Aperto",
      published: "Pubblicato",
      confirmed: "Confermato",
      in_progress: "In corso",
      completed: "Completato",
      cancelled: "Annullato",
    };
    return labels[status] || status;
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      autista: "Autista",
      soccorritore: "Soccorritore",
      infermiere: "Infermiere",
      medico: "Medico",
      coordinatore: "Coordinatore",
      tirocinante: "Tirocinante",
    };
    return labels[role] || role;
  };

  const renderShiftCard = useCallback(({ item }: { item: ShiftInstance }) => {
    const statusColor = getStatusColor(item);
    const myAssignment = item.assignments?.find(a => a.staffMemberId === staffMember?.id);
    const isMyShift = !!myAssignment;
    const isCheckedIn = !!myAssignment?.checkedInAt;
    const isCheckedOut = !!myAssignment?.checkedOutAt;
    const canCheckIn = isMyShift && !isCheckedIn && (item.status === "confirmed" || item.status === "published" || item.status === "in_progress");
    const canCheckOut = isMyShift && isCheckedIn && !isCheckedOut;

    return (
      <Card style={styles.shiftCard}>
        <View style={styles.shiftHeader}>
          <View style={styles.shiftTime}>
            <Feather name="clock" size={16} color={theme.primary} />
            <ThemedText type="label" style={{ marginLeft: Spacing.xs }}>
              {formatTime(item.startTime)} - {formatTime(item.endTime)}
            </ThemedText>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
            <ThemedText type="small" style={{ color: statusColor }}>
              {getStatusLabel(item.status)}
            </ThemedText>
          </View>
        </View>

        <View style={styles.shiftInfo}>
          <View style={styles.infoRow}>
            <Feather name="users" size={14} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
              {item.currentStaffCount || 0}/{item.minStaff} personale
            </ThemedText>
          </View>

          {item.vehicleId && (
            <View style={styles.infoRow}>
              <Feather name="truck" size={14} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
                Veicolo assegnato
              </ThemedText>
            </View>
          )}

          {isMyShift && (
            <View style={[styles.myShiftBadge, { backgroundColor: theme.primary + "20" }]}>
              <Feather name="check-circle" size={12} color={theme.primary} />
              <ThemedText type="small" style={{ color: theme.primary, marginLeft: 4 }}>
                Mio turno - {getRoleLabel(myAssignment?.assignedRole || "")}
              </ThemedText>
            </View>
          )}

          {isCheckedIn && !isCheckedOut && (
            <View style={[styles.myShiftBadge, { backgroundColor: theme.success + "20" }]}>
              <Feather name="log-in" size={12} color={theme.success} />
              <ThemedText type="small" style={{ color: theme.success, marginLeft: 4 }}>
                Check-in: {new Date(myAssignment!.checkedInAt!).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
              </ThemedText>
            </View>
          )}

          {isCheckedOut && (
            <View style={[styles.myShiftBadge, { backgroundColor: theme.textSecondary + "20" }]}>
              <Feather name="log-out" size={12} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                Turno completato alle {new Date(myAssignment!.checkedOutAt!).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
              </ThemedText>
            </View>
          )}
        </View>

        {canCheckIn && (
          <Pressable
            style={[styles.checkInButton, { backgroundColor: theme.success }]}
            onPress={() => {
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              checkInMutation.mutate(myAssignment!.id);
            }}
            disabled={checkInMutation.isPending}
          >
            {checkInMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="log-in" size={18} color="#fff" />
                <ThemedText style={{ color: "#fff", marginLeft: Spacing.sm, fontWeight: "600" }}>
                  Check-in
                </ThemedText>
              </>
            )}
          </Pressable>
        )}

        {canCheckOut && (
          <Pressable
            style={[styles.checkOutButton, { backgroundColor: theme.warning }]}
            onPress={() => {
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              checkOutMutation.mutate(myAssignment!.id);
            }}
            disabled={checkOutMutation.isPending}
          >
            {checkOutMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="log-out" size={18} color="#fff" />
                <ThemedText style={{ color: "#fff", marginLeft: Spacing.sm, fontWeight: "600" }}>
                  Check-out
                </ThemedText>
              </>
            )}
          </Pressable>
        )}

        {item.allowSelfSignup && !isMyShift && item.status === "open" && (
          <Pressable
            style={[styles.signupButton, { backgroundColor: theme.primary }]}
            onPress={() => handleSignupPress(item.id)}
            disabled={signingUp === item.id}
          >
            {signingUp === item.id ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="plus" size={16} color="#fff" />
                <ThemedText style={{ color: "#fff", marginLeft: Spacing.xs }}>
                  Iscriviti
                </ThemedText>
              </>
            )}
          </Pressable>
        )}
      </Card>
    );
  }, [theme, staffMember, signingUp, handleSignupPress, checkInMutation, checkOutMutation]);

  const renderDayColumn = useCallback((day: Date) => {
    const dateKey = day.toISOString().split("T")[0];
    const dayShifts = shiftsGroupedByDate[dateKey] || [];
    const isToday = dateKey === new Date().toISOString().split("T")[0];
    const isSelected = dateKey === selectedDate.toISOString().split("T")[0];

    return (
      <View key={dateKey} style={styles.dayColumn}>
        <Pressable
          style={[
            styles.dayHeader,
            isToday && { backgroundColor: theme.primary + "20" },
            isSelected && { borderColor: theme.primary, borderWidth: 2 },
          ]}
          onPress={() => {
            if (Platform.OS !== "web") {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            setSelectedDate(day);
          }}
        >
          <ThemedText
            type="small"
            style={{ color: isToday ? theme.primary : theme.textSecondary, textTransform: "capitalize" }}
          >
            {formatDate(day).split(" ")[0]}
          </ThemedText>
          <ThemedText
            type="label"
            style={{ color: isToday ? theme.primary : theme.text }}
          >
            {day.getDate()}
          </ThemedText>
          {dayShifts.length > 0 && (
            <View style={[styles.shiftDot, { backgroundColor: theme.primary }]} />
          )}
        </Pressable>
      </View>
    );
  }, [shiftsGroupedByDate, selectedDate, theme]);

  const selectedDateKey = selectedDate.toISOString().split("T")[0];
  const selectedDayShifts = shiftsGroupedByDate[selectedDateKey] || [];

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.content, { paddingTop: headerHeight + Spacing.md }]}>
        <View style={styles.weekNavigation}>
          <Pressable onPress={() => navigateWeek(-1)} style={styles.navButton}>
            <Feather name="chevron-left" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="h3">
            {startOfWeek.toLocaleDateString("it-IT", { month: "long", year: "numeric" })}
          </ThemedText>
          <Pressable onPress={() => navigateWeek(1)} style={styles.navButton}>
            <Feather name="chevron-right" size={24} color={theme.text} />
          </Pressable>
        </View>

        <View style={styles.weekView}>
          {weekDays.map(renderDayColumn)}
        </View>

        <View style={styles.quickActionsGrid}>
          <View style={styles.quickActionsRow}>
            <Pressable
              style={[styles.quickActionButton, { backgroundColor: theme.warning + "20" }]}
              onPress={() => {
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate("OpenShifts");
              }}
            >
              <Feather name="alert-circle" size={18} color={theme.warning} />
              <ThemedText type="small" style={{ color: theme.warning, marginLeft: Spacing.xs }}>
                Scoperti {openShifts?.length ? `(${openShifts.length})` : ""}
              </ThemedText>
            </Pressable>
            <Pressable
              style={[styles.quickActionButton, { backgroundColor: theme.primary + "20" }]}
              onPress={() => {
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate("Events");
              }}
            >
              <Feather name="calendar" size={18} color={theme.primary} />
              <ThemedText type="small" style={{ color: theme.primary, marginLeft: Spacing.xs }}>
                Eventi
              </ThemedText>
            </Pressable>
          </View>
          <View style={styles.quickActionsRow}>
            <Pressable
              style={[styles.quickActionButton, { backgroundColor: theme.success + "20" }]}
              onPress={() => {
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate("Availability");
              }}
            >
              <Feather name="check-square" size={18} color={theme.success} />
              <ThemedText type="small" style={{ color: theme.success, marginLeft: Spacing.xs }}>
                Disponibilita
              </ThemedText>
            </Pressable>
            <Pressable
              style={[styles.quickActionButton, { backgroundColor: "#9333ea" + "20" }]}
              onPress={() => {
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate("SwapRequests");
              }}
            >
              <Feather name="repeat" size={18} color="#9333ea" />
              <ThemedText type="small" style={{ color: "#9333ea", marginLeft: Spacing.xs }}>
                Scambi
              </ThemedText>
            </Pressable>
          </View>
        </View>

        <View style={styles.shiftsSection}>
          <ThemedText type="label" style={{ marginBottom: Spacing.sm }}>
            {selectedDate.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}
          </ThemedText>

          {shiftsLoading ? (
            <ActivityIndicator size="large" color={theme.primary} />
          ) : selectedDayShifts.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="calendar" size={48} color={theme.textSecondary} />
              <ThemedText style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
                Nessun turno programmato
              </ThemedText>
            </View>
          ) : (
            <FlatList
              data={selectedDayShifts}
              keyExtractor={(item) => item.id}
              renderItem={renderShiftCard}
              contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.xl }}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
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
  weekNavigation: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  navButton: {
    padding: Spacing.sm,
  },
  weekView: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  dayColumn: {
    flex: 1,
    alignItems: "center",
  },
  dayHeader: {
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    minWidth: 44,
  },
  shiftDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 4,
  },
  shiftsSection: {
    flex: 1,
  },
  shiftCard: {
    marginBottom: Spacing.sm,
    padding: Spacing.md,
  },
  shiftHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  shiftTime: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  shiftInfo: {
    gap: Spacing.xs,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  myShiftBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    alignSelf: "flex-start",
    marginTop: Spacing.xs,
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
  checkInButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  checkOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Spacing["2xl"],
  },
  openShiftsBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  quickActionsGrid: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  quickActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
});
