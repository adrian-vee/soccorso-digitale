import React, { useState, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
  TextInput as RNTextInput,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import DateTimePicker from "@react-native-community/datetimepicker";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/query-client";
import { Spacing, BorderRadius } from "@/constants/theme";

const EVENT_TYPES: { key: string; label: string; icon: string; color: string }[] = [
  { key: "inizio_turno", label: "Inizio Turno", icon: "play-circle", color: "#00C853" },
  { key: "fine_turno", label: "Fine Turno", icon: "stop-circle", color: "#FF5252" },
  { key: "partenza_sede", label: "Partenza Sede", icon: "arrow-up-right", color: "#4DA3FF" },
  { key: "rientro_sede", label: "Rientro Sede", icon: "arrow-down-left", color: "#4DA3FF" },
  { key: "rifornimento", label: "Rifornimento", icon: "droplet", color: "#FF9800" },
  { key: "lavaggio", label: "Lavaggio", icon: "wind", color: "#4DA3FF" },
  { key: "sosta", label: "Sosta", icon: "pause-circle", color: "#9BA1A6" },
  { key: "manutenzione", label: "Manutenzione", icon: "tool", color: "#FF9800" },
  { key: "cambio_equipaggio", label: "Cambio Equipaggio", icon: "users", color: "#8B5CF6" },
  { key: "controllo_mezzo", label: "Controllo Mezzo", icon: "check-circle", color: "#00C853" },
  { key: "incidente", label: "Incidente", icon: "alert-triangle", color: "#FF5252" },
  { key: "guasto", label: "Guasto", icon: "alert-octagon", color: "#FF5252" },
  { key: "altro", label: "Altro", icon: "edit-3", color: "#9BA1A6" },
];

function getEventConfig(eventType: string) {
  return EVENT_TYPES.find((e) => e.key === eventType) || EVENT_TYPES[EVENT_TYPES.length - 1];
}

function getDotColor(eventType: string): string {
  const startEvents = ["inizio_turno", "controllo_mezzo"];
  const endEvents = ["fine_turno", "incidente", "guasto"];
  const tripEvents = ["partenza_sede", "rientro_sede", "lavaggio"];
  const maintenanceEvents = ["rifornimento", "manutenzione"];

  if (startEvents.includes(eventType)) return "#00C853";
  if (endEvents.includes(eventType)) return "#FF5252";
  if (tripEvents.includes(eventType)) return "#4DA3FF";
  if (maintenanceEvents.includes(eventType)) return "#FF9800";
  return "#9BA1A6";
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatTime(timeStr: string): string {
  if (!timeStr) return "--:--";
  return timeStr.slice(0, 5);
}

interface ShiftLogEvent {
  id: number;
  vehicleId: string;
  shiftDate: string;
  eventType: string;
  eventTime: string;
  kmReading: number | null;
  description: string | null;
  createdAt: string;
}

export default function ShiftLogScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const vehicleId = user?.vehicle?.id;

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [formEventType, setFormEventType] = useState("inizio_turno");
  const [formTime, setFormTime] = useState(new Date());
  const [formKm, setFormKm] = useState("");
  const [formDescription, setFormDescription] = useState("");

  const dateStr = formatDate(selectedDate);

  const { data, isLoading, refetch } = useQuery<ShiftLogEvent[]>({
    queryKey: [`/api/shift-logs?vehicleId=${vehicleId}&date=${dateStr}`],
    enabled: !!vehicleId,
  });

  const events = useMemo(() => {
    if (!Array.isArray(data)) return [];
    return [...data].sort((a, b) => a.eventTime.localeCompare(b.eventTime));
  }, [data]);

  const mutation = useMutation({
    mutationFn: async (payload: {
      vehicleId: string;
      shiftDate: string;
      eventType: string;
      eventTime: string;
      kmReading?: number;
      description?: string;
    }) => {
      await apiRequest("POST", "/api/shift-logs", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/shift-logs?vehicleId=${vehicleId}&date=${dateStr}`] });
      setShowAddModal(false);
      resetForm();
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
    onError: (error: any) => {
      Alert.alert("Errore", error.message || "Impossibile aggiungere l'evento");
    },
  });

  const resetForm = () => {
    setFormEventType("inizio_turno");
    setFormTime(new Date());
    setFormKm("");
    setFormDescription("");
  };

  const handleAddEvent = () => {
    if (!vehicleId) return;
    const hours = String(formTime.getHours()).padStart(2, "0");
    const minutes = String(formTime.getMinutes()).padStart(2, "0");
    const eventTime = `${hours}:${minutes}:00`;

    const payload: any = {
      vehicleId,
      shiftDate: dateStr,
      eventType: formEventType,
      eventTime,
    };
    if (formKm.trim()) {
      payload.kmReading = parseInt(formKm, 10);
    }
    if (formDescription.trim()) {
      payload.description = formDescription.trim();
    }
    mutation.mutate(payload);
  };

  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const summaryStats = useMemo(() => {
    if (!events.length)
      return { count: 0, startTime: null, endTime: null, totalKm: null };
    const startEvent = events.find((e) => e.eventType === "inizio_turno");
    const endEvent = [...events].reverse().find((e) => e.eventType === "fine_turno");
    const kmReadings = events.filter((e) => e.kmReading != null).map((e) => e.kmReading as number);
    let totalKm: number | null = null;
    if (kmReadings.length >= 2) {
      totalKm = Math.max(...kmReadings) - Math.min(...kmReadings);
    }
    return {
      count: events.length,
      startTime: startEvent ? formatTime(startEvent.eventTime) : null,
      endTime: endEvent ? formatTime(endEvent.eventTime) : null,
      totalKm,
    };
  }, [events]);

  const handleDateChange = (_event: any, date?: Date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }
    if (date) {
      setSelectedDate(date);
    }
  };

  const handleTimeChange = (_event: any, date?: Date) => {
    if (Platform.OS === "android") {
      setShowTimePicker(false);
    }
    if (date) {
      setFormTime(date);
    }
  };

  if (!vehicleId) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.emptyState}>
          <Feather name="clipboard" size={48} color={theme.textSecondary} />
          <ThemedText
            type="body"
            style={{ color: theme.textSecondary, marginTop: Spacing.md }}
          >
            Nessun veicolo assegnato
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: tabBarHeight + Spacing.xl + 80,
          paddingHorizontal: Spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.springify()}>
          <Card style={styles.dateCard}>
            <View style={styles.dateRow}>
              <View style={styles.dateInfo}>
                <Feather name="calendar" size={20} color={theme.primary} />
                <ThemedText type="h3" style={{ marginLeft: Spacing.sm }}>
                  {selectedDate.toLocaleDateString("it-IT", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </ThemedText>
              </View>
              <Pressable
                onPress={() => setShowDatePicker(true)}
                style={[styles.dateButton, { backgroundColor: theme.primaryLight }]}
              >
                <Feather name="edit-2" size={16} color={theme.primary} />
              </Pressable>
            </View>
          </Card>
        </Animated.View>

        {showDatePicker ? (
          <View style={styles.datePickerContainer}>
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display={Platform.OS === "ios" ? "inline" : "default"}
              onChange={handleDateChange}
              themeVariant={isDark ? "dark" : "light"}
            />
            {Platform.OS === "ios" ? (
              <Pressable
                onPress={() => setShowDatePicker(false)}
                style={[styles.doneButton, { backgroundColor: theme.primary }]}
              >
                <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                  Conferma
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, { backgroundColor: theme.cardBackground }]}>
              <View style={[styles.summaryIconCircle, { backgroundColor: theme.primaryLight }]}>
                <Feather name="list" size={14} color={theme.primary} />
              </View>
              <ThemedText type="h3">{summaryStats.count}</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Eventi
              </ThemedText>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: theme.cardBackground }]}>
              <View style={[styles.summaryIconCircle, { backgroundColor: "rgba(0, 200, 83, 0.15)" }]}>
                <Feather name="play" size={14} color="#00C853" />
              </View>
              <ThemedText type="h3">{summaryStats.startTime || "--:--"}</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Inizio
              </ThemedText>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: theme.cardBackground }]}>
              <View style={[styles.summaryIconCircle, { backgroundColor: "rgba(255, 82, 82, 0.15)" }]}>
                <Feather name="square" size={14} color="#FF5252" />
              </View>
              <ThemedText type="h3">{summaryStats.endTime || "--:--"}</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Fine
              </ThemedText>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: theme.cardBackground }]}>
              <View style={[styles.summaryIconCircle, { backgroundColor: "rgba(255, 152, 0, 0.15)" }]}>
                <Feather name="navigation" size={14} color="#FF9800" />
              </View>
              <ThemedText type="h3">
                {summaryStats.totalKm != null ? summaryStats.totalKm : "--"}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Km
              </ThemedText>
            </View>
          </View>
        </Animated.View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : events.length === 0 ? (
          <Animated.View entering={FadeInDown.delay(200).springify()}>
            <Card style={styles.emptyCard}>
              <View style={styles.emptyCardContent}>
                <View style={[styles.emptyIconCircle, { backgroundColor: theme.primaryLight }]}>
                  <Feather name="clipboard" size={32} color={theme.primary} />
                </View>
                <ThemedText
                  type="body"
                  style={{
                    color: theme.textSecondary,
                    marginTop: Spacing.md,
                    textAlign: "center",
                  }}
                >
                  Nessun evento registrato per questa data
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{
                    color: theme.textSecondary,
                    textAlign: "center",
                    marginTop: Spacing.xs,
                  }}
                >
                  Tocca il pulsante + per aggiungere un evento
                </ThemedText>
              </View>
            </Card>
          </Animated.View>
        ) : (
          <View style={styles.timeline}>
            {events.map((event, index) => {
              const config = getEventConfig(event.eventType);
              const dotColor = getDotColor(event.eventType);
              const isLast = index === events.length - 1;

              return (
                <Animated.View
                  key={event.id}
                  entering={FadeInDown.delay(200 + index * 60).springify()}
                >
                  <View style={styles.timelineItem}>
                    <View style={styles.timelineLeft}>
                      <ThemedText
                        type="small"
                        style={[styles.timelineTime, { color: theme.textSecondary }]}
                      >
                        {formatTime(event.eventTime)}
                      </ThemedText>
                    </View>
                    <View style={styles.timelineCenter}>
                      <View
                        style={[styles.timelineDot, { backgroundColor: dotColor }]}
                      />
                      {!isLast ? (
                        <View
                          style={[
                            styles.timelineLine,
                            { backgroundColor: theme.border },
                          ]}
                        />
                      ) : null}
                    </View>
                    <View style={styles.timelineRight}>
                      <Card style={[styles.eventCard, { marginBottom: isLast ? 0 : Spacing.sm }]}>
                        <View style={styles.eventHeader}>
                          <View
                            style={[
                              styles.eventIconCircle,
                              { backgroundColor: config.color + "20" },
                            ]}
                          >
                            <Feather
                              name={config.icon as any}
                              size={16}
                              color={config.color}
                            />
                          </View>
                          <ThemedText type="body" style={{ fontWeight: "600", flex: 1 }}>
                            {config.label}
                          </ThemedText>
                        </View>
                        {event.kmReading != null ? (
                          <View style={styles.eventDetail}>
                            <Feather
                              name="navigation"
                              size={12}
                              color={theme.textSecondary}
                            />
                            <ThemedText
                              type="small"
                              style={{
                                color: theme.textSecondary,
                                marginLeft: Spacing.xs,
                              }}
                            >
                              {event.kmReading.toLocaleString("it-IT")} km
                            </ThemedText>
                          </View>
                        ) : null}
                        {event.description ? (
                          <View style={styles.eventDetail}>
                            <Feather
                              name="message-circle"
                              size={12}
                              color={theme.textSecondary}
                            />
                            <ThemedText
                              type="small"
                              style={{
                                color: theme.textSecondary,
                                marginLeft: Spacing.xs,
                                flex: 1,
                              }}
                            >
                              {event.description}
                            </ThemedText>
                          </View>
                        ) : null}
                      </Card>
                    </View>
                  </View>
                </Animated.View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Pressable
        onPress={openAddModal}
        style={[styles.fab, { backgroundColor: theme.primary, bottom: tabBarHeight + Spacing.lg }]}
      >
        <Feather name="plus" size={24} color="#FFFFFF" />
      </Pressable>

      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContent, { backgroundColor: theme.backgroundRoot }]}
          >
            <View style={styles.modalHeader}>
              <ThemedText type="h2">Nuovo Evento</ThemedText>
              <Pressable onPress={() => setShowAddModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScroll}
              showsVerticalScrollIndicator={false}
            >
              <ThemedText
                type="label"
                style={[styles.fieldLabel, { color: theme.textSecondary }]}
              >
                TIPO EVENTO
              </ThemedText>
              <View style={styles.eventTypeGrid}>
                {EVENT_TYPES.map((et) => {
                  const isSelected = formEventType === et.key;
                  return (
                    <Pressable
                      key={et.key}
                      onPress={() => setFormEventType(et.key)}
                      style={[
                        styles.eventTypeOption,
                        {
                          backgroundColor: isSelected
                            ? et.color + "20"
                            : theme.cardBackground,
                          borderColor: isSelected ? et.color : theme.border,
                          borderWidth: isSelected ? 2 : 1,
                        },
                      ]}
                    >
                      <Feather
                        name={et.icon as any}
                        size={18}
                        color={isSelected ? et.color : theme.textSecondary}
                      />
                      <ThemedText
                        type="small"
                        style={{
                          marginTop: 4,
                          color: isSelected ? et.color : theme.text,
                          fontWeight: isSelected ? "600" : "400",
                          textAlign: "center",
                        }}
                        numberOfLines={2}
                      >
                        {et.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              <ThemedText
                type="label"
                style={[styles.fieldLabel, { color: theme.textSecondary }]}
              >
                ORA
              </ThemedText>
              <Pressable
                onPress={() => setShowTimePicker(true)}
                style={[
                  styles.timePickerButton,
                  {
                    backgroundColor: theme.inputBackground,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Feather name="clock" size={18} color={theme.primary} />
                <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                  {String(formTime.getHours()).padStart(2, "0")}:
                  {String(formTime.getMinutes()).padStart(2, "0")}
                </ThemedText>
              </Pressable>

              {showTimePicker ? (
                <View style={styles.timePickerContainer}>
                  <DateTimePicker
                    value={formTime}
                    mode="time"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={handleTimeChange}
                    themeVariant={isDark ? "dark" : "light"}
                    is24Hour
                  />
                  {Platform.OS === "ios" ? (
                    <Pressable
                      onPress={() => setShowTimePicker(false)}
                      style={[styles.doneButton, { backgroundColor: theme.primary }]}
                    >
                      <ThemedText
                        type="body"
                        style={{ color: "#FFFFFF", fontWeight: "600" }}
                      >
                        Conferma
                      </ThemedText>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              <ThemedText
                type="label"
                style={[styles.fieldLabel, { color: theme.textSecondary }]}
              >
                KM (OPZIONALE)
              </ThemedText>
              <RNTextInput
                value={formKm}
                onChangeText={setFormKm}
                placeholder="Es. 125430"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.inputBackground,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
              />

              <ThemedText
                type="label"
                style={[styles.fieldLabel, { color: theme.textSecondary }]}
              >
                DESCRIZIONE (OPZIONALE)
              </ThemedText>
              <RNTextInput
                value={formDescription}
                onChangeText={setFormDescription}
                placeholder="Note aggiuntive..."
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={3}
                style={[
                  styles.textInputMultiline,
                  {
                    backgroundColor: theme.inputBackground,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
              />

              <Pressable
                onPress={handleAddEvent}
                disabled={mutation.isPending}
                style={[
                  styles.submitButton,
                  {
                    backgroundColor: mutation.isPending
                      ? theme.textSecondary
                      : theme.primary,
                  },
                ]}
              >
                {mutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Feather name="plus-circle" size={20} color="#FFFFFF" />
                    <ThemedText
                      type="body"
                      style={{
                        color: "#FFFFFF",
                        fontWeight: "600",
                        marginLeft: Spacing.sm,
                      }}
                    >
                      Aggiungi Evento
                    </ThemedText>
                  </>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  dateCard: {
    marginBottom: Spacing.md,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  dateButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    justifyContent: "center",
    alignItems: "center",
  },
  datePickerContainer: {
    marginBottom: Spacing.md,
  },
  doneButton: {
    alignSelf: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.sm,
  },
  summaryRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  summaryCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.lg,
  },
  summaryIconCircle: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  loadingContainer: {
    paddingVertical: Spacing["3xl"],
    alignItems: "center",
  },
  emptyCard: {
    marginBottom: Spacing.md,
  },
  emptyCardContent: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    justifyContent: "center",
    alignItems: "center",
  },
  timeline: {
    paddingLeft: Spacing.xs,
  },
  timelineItem: {
    flexDirection: "row",
    minHeight: 70,
  },
  timelineLeft: {
    width: 50,
    paddingTop: Spacing.md,
    alignItems: "flex-end",
    paddingRight: Spacing.sm,
  },
  timelineTime: {
    fontWeight: "600",
    fontSize: 12,
  },
  timelineCenter: {
    width: 24,
    alignItems: "center",
  },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginTop: Spacing.md,
    zIndex: 1,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 2,
  },
  timelineRight: {
    flex: 1,
    paddingLeft: Spacing.sm,
  },
  eventCard: {
    padding: Spacing.md,
  },
  eventHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  eventIconCircle: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    justifyContent: "center",
    alignItems: "center",
  },
  eventDetail: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xs,
    paddingLeft: 40,
  },
  fab: {
    position: "absolute",
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    maxHeight: "90%",
    borderTopLeftRadius: BorderRadius["2xl"],
    borderTopRightRadius: BorderRadius["2xl"],
    paddingTop: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing["3xl"],
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  modalScroll: {
    maxHeight: "100%",
  },
  fieldLabel: {
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  eventTypeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  eventTypeOption: {
    width: "30%",
    flexGrow: 1,
    minWidth: 90,
    maxWidth: 120,
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.lg,
  },
  timePickerButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  timePickerContainer: {
    marginTop: Spacing.sm,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 15,
  },
  textInputMultiline: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: "top",
  },
  submitButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.xl,
    marginBottom: Spacing.xl,
  },
});
