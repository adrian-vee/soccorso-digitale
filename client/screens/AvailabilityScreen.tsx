import React, { useState, useMemo } from "react";
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform, Alert } from "react-native";
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

interface StaffAvailability {
  id: string;
  staffMemberId: string;
  dateStart: string;
  dateEnd: string;
  availabilityType: "available" | "preferred" | "unavailable" | "vacation" | "sick";
  reason: string | null;
}

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  primaryRole: string;
}

type AvailabilityType = "available" | "preferred" | "unavailable" | "vacation" | "sick";

export default function AvailabilityScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedWeek, setSelectedWeek] = useState(new Date());

  const { data: staffMember } = useQuery<StaffMember | null>({
    queryKey: user?.id ? [`/api/staff-members/by-user/${user.id}`] : [null],
    enabled: !!user?.id,
  });

  const startOfWeek = useMemo(() => {
    const date = new Date(selectedWeek);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    date.setDate(diff);
    date.setHours(0, 0, 0, 0);
    return date;
  }, [selectedWeek]);

  const endOfWeek = useMemo(() => {
    const date = new Date(startOfWeek);
    date.setDate(date.getDate() + 6);
    return date;
  }, [startOfWeek]);

  const dateFrom = startOfWeek.toISOString().split("T")[0];
  const dateTo = endOfWeek.toISOString().split("T")[0];

  const { data: availability, isLoading } = useQuery<StaffAvailability[]>({
    queryKey: staffMember?.id ? [`/api/staff-availability/${staffMember.id}?dateFrom=${dateFrom}&dateTo=${dateTo}`] : [null],
    enabled: !!staffMember?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (data: { dateStart: string; dateEnd: string; availabilityType: AvailabilityType; reason?: string }) => {
      if (!staffMember?.id) throw new Error("Staff member not found");
      return apiRequest("POST", `/api/staff-availability`, {
        staffMemberId: staffMember.id,
        ...data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === "string" && key.startsWith("/api/staff-availability");
      }});
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
    onError: (error: Error) => {
      Alert.alert("Errore", error.message || "Impossibile salvare la disponibilita");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/staff-availability/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === "string" && key.startsWith("/api/staff-availability");
      }});
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
    onError: (error: Error) => {
      Alert.alert("Errore", error.message || "Impossibile eliminare la disponibilita");
    },
  });

  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(date.getDate() + i);
      days.push(date);
    }
    return days;
  }, [startOfWeek]);

  const navigateWeek = (direction: number) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const newDate = new Date(selectedWeek);
    newDate.setDate(newDate.getDate() + direction * 7);
    setSelectedWeek(newDate);
  };

  const getAvailabilityForDate = (date: Date): StaffAvailability | undefined => {
    if (!availability) return undefined;
    const dateStr = date.toISOString().split("T")[0];
    return availability.find(a => dateStr >= a.dateStart && dateStr <= a.dateEnd);
  };

  const getTypeColor = (type: AvailabilityType) => {
    switch (type) {
      case "available": return theme.success;
      case "preferred": return theme.primary;
      case "unavailable": return theme.error;
      case "vacation": return theme.warning;
      case "sick": return "#9333ea";
      default: return theme.textSecondary;
    }
  };

  const getTypeLabel = (type: AvailabilityType) => {
    const labels: Record<AvailabilityType, string> = {
      available: "Disponibile",
      preferred: "Preferito",
      unavailable: "Non disponibile",
      vacation: "Ferie",
      sick: "Malattia",
    };
    return labels[type];
  };

  const getTypeIcon = (type: AvailabilityType): keyof typeof Feather.glyphMap => {
    const icons: Record<AvailabilityType, keyof typeof Feather.glyphMap> = {
      available: "check-circle",
      preferred: "star",
      unavailable: "x-circle",
      vacation: "sun",
      sick: "thermometer",
    };
    return icons[type];
  };

  const handleDayPress = (date: Date) => {
    const existingAvailability = getAvailabilityForDate(date);
    const dateStr = date.toISOString().split("T")[0];

    if (existingAvailability) {
      Alert.alert(
        "Disponibilita esistente",
        `Giorno segnato come "${getTypeLabel(existingAvailability.availabilityType)}". Vuoi rimuoverlo?`,
        [
          { text: "Annulla", style: "cancel" },
          {
            text: "Rimuovi",
            style: "destructive",
            onPress: () => deleteMutation.mutate(existingAvailability.id),
          },
        ]
      );
    } else {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      Alert.alert(
        "Segna disponibilita",
        `${date.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}`,
        [
          { text: "Annulla", style: "cancel" },
          {
            text: "Disponibile",
            onPress: () => createMutation.mutate({ dateStart: dateStr, dateEnd: dateStr, availabilityType: "available" }),
          },
          {
            text: "Preferito",
            onPress: () => createMutation.mutate({ dateStart: dateStr, dateEnd: dateStr, availabilityType: "preferred" }),
          },
          {
            text: "Non disponibile",
            onPress: () => createMutation.mutate({ dateStart: dateStr, dateEnd: dateStr, availabilityType: "unavailable" }),
          },
          {
            text: "Ferie",
            onPress: () => createMutation.mutate({ dateStart: dateStr, dateEnd: dateStr, availabilityType: "vacation" }),
          },
        ]
      );
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("it-IT", { weekday: "short", day: "numeric" });
  };

  const renderDayCard = (day: Date, index: number) => {
    const dateStr = day.toISOString().split("T")[0];
    const dayAvailability = getAvailabilityForDate(day);
    const isToday = dateStr === new Date().toISOString().split("T")[0];
    const isPast = day < new Date(new Date().setHours(0, 0, 0, 0));

    return (
      <Pressable
        key={dateStr}
        style={[
          styles.dayCard,
          { backgroundColor: theme.backgroundSecondary },
          isToday && { borderColor: theme.primary, borderWidth: 2 },
          dayAvailability && { backgroundColor: getTypeColor(dayAvailability.availabilityType) + "20" },
        ]}
        onPress={() => !isPast && handleDayPress(day)}
        disabled={isPast || createMutation.isPending || deleteMutation.isPending}
      >
        <ThemedText
          type="small"
          style={{ color: isToday ? theme.primary : theme.textSecondary, textTransform: "capitalize" }}
        >
          {formatDate(day).split(" ")[0]}
        </ThemedText>
        <ThemedText type="h3" style={{ color: isToday ? theme.primary : theme.text }}>
          {day.getDate()}
        </ThemedText>
        {dayAvailability ? (
          <View style={[styles.availabilityIndicator, { backgroundColor: getTypeColor(dayAvailability.availabilityType) }]}>
            <Feather name={getTypeIcon(dayAvailability.availabilityType)} size={14} color="#fff" />
          </View>
        ) : (
          <View style={[styles.emptyIndicator, { borderColor: theme.border }]}>
            <Feather name="plus" size={14} color={theme.textSecondary} />
          </View>
        )}
      </Pressable>
    );
  };

  const availabilityTypes: AvailabilityType[] = ["available", "preferred", "unavailable", "vacation", "sick"];

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
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

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <>
            <View style={styles.weekGrid}>
              {weekDays.map((day, index) => renderDayCard(day, index))}
            </View>

            <Card style={styles.legendCard}>
              <ThemedText type="label" style={{ marginBottom: Spacing.sm }}>
                Legenda
              </ThemedText>
              <View style={styles.legendGrid}>
                {availabilityTypes.map((type) => (
                  <View key={type} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: getTypeColor(type) }]} />
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      {getTypeLabel(type)}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </Card>

            <Card style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Feather name="info" size={18} color={theme.primary} />
                <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.sm, flex: 1 }}>
                  Tocca un giorno per segnare la tua disponibilita. I coordinatori useranno queste informazioni per pianificare i turni.
                </ThemedText>
              </View>
            </Card>
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.md,
  },
  weekNavigation: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  navButton: {
    padding: Spacing.sm,
  },
  loadingContainer: {
    paddingVertical: Spacing["2xl"],
    justifyContent: "center",
    alignItems: "center",
  },
  weekGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  dayCard: {
    width: "13%",
    aspectRatio: 0.8,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xs,
    flexGrow: 1,
  },
  availabilityIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.xs,
  },
  emptyIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.xs,
  },
  legendCard: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  legendGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  infoCard: {
    padding: Spacing.md,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
});
