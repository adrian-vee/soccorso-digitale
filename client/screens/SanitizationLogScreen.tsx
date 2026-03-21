import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  Pressable,
  Modal,
  KeyboardAvoidingView,
  TextInput,
  Alert,
  RefreshControl,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from "@react-native-community/datetimepicker";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl, getAuthToken } from "@/lib/query-client";

type SanitizationType = "straordinaria" | "infettivo";

const SANIT_TYPES: Record<SanitizationType, { label: string; color: string; icon: keyof typeof Feather.glyphMap; description: string }> = {
  straordinaria: { label: "Straordinaria", color: "#00A651", icon: "droplet", description: "Pulizia approfondita" },
  infettivo: { label: "Paziente Infetto", color: "#EF4444", icon: "alert-circle", description: "Dopo trasporto paziente infettivo" },
};

interface SanitizationLog {
  id: string;
  vehicleId: string;
  vehicleCode: string;
  sanitizationType: SanitizationType;
  operatorName: string;
  notes: string | null;
  productsUsed: string | null;
  completedAt: string;
  createdAt: string;
}

interface SanitizationStats {
  total: number;
  straordinaria: number;
  infettivo: number;
}

function formatDateShort(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
}

function formatTimeShort(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

function FlipCard({ log, typeConfig, theme, isDark }: {
  log: SanitizationLog;
  typeConfig: { label: string; color: string; icon: keyof typeof Feather.glyphMap; description: string };
  theme: any;
  isDark: boolean;
}) {
  const flip = useSharedValue(0);
  const [flipped, setFlipped] = React.useState(false);

  const handleFlip = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    flip.value = withTiming(flipped ? 0 : 1, { duration: 400 });
    setFlipped(!flipped);
  };

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1000 }, { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` }],
    backfaceVisibility: "hidden" as const,
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1000 }, { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` }],
    backfaceVisibility: "hidden" as const,
  }));

  const isInfettivo = log.sanitizationType === "infettivo";
  const backColors: [string, string] = isInfettivo
    ? ["rgba(239,68,68,0.15)", "rgba(239,68,68,0.05)"]
    : ["rgba(0,166,81,0.15)", "rgba(0,166,81,0.05)"];

  return (
    <Pressable onPress={handleFlip} style={{ marginBottom: Spacing.sm }}>
      <View style={{ height: 100 }}>
        <Animated.View style={[flipStyles.cardFace, frontStyle]}>
          <Card style={[styles.logCard, { borderLeftWidth: 4, borderLeftColor: typeConfig.color, marginBottom: 0 }]}>
            <View style={styles.logHeader}>
              <View style={styles.logOperator}>
                <Feather name="user" size={14} color={theme.textSecondary} />
                <ThemedText type="body" style={{ fontWeight: "600", marginLeft: Spacing.xs }}>{log.operatorName}</ThemedText>
              </View>
              <View style={[styles.typeBadge, { backgroundColor: typeConfig.color + "20" }]}>
                <Feather name={typeConfig.icon as any} size={12} color={typeConfig.color} />
                <ThemedText type="small" style={{ color: typeConfig.color, fontWeight: "600", marginLeft: 4 }}>
                  {typeConfig.label}
                </ThemedText>
              </View>
            </View>
            <View style={styles.logDateTime}>
              <Feather name="calendar" size={12} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                {formatDateShort(log.completedAt)} alle {formatTimeShort(log.completedAt)}
              </ThemedText>
            </View>
          </Card>
        </Animated.View>

        <Animated.View style={[flipStyles.cardFace, flipStyles.cardBack, backStyle]}>
          <LinearGradient
            colors={backColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[flipStyles.backContent, { borderColor: typeConfig.color + "30" }]}
          >
            <View style={flipStyles.backHeader}>
              <View style={[flipStyles.backIconWrap, { backgroundColor: typeConfig.color + "25" }]}>
                <Feather name={isInfettivo ? "alert-circle" : "droplet"} size={20} color={typeConfig.color} />
              </View>
              <ThemedText type="body" style={{ fontWeight: "700", color: typeConfig.color }}>
                {typeConfig.label}
              </ThemedText>
            </View>
            <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4 }}>
              {typeConfig.description}
            </ThemedText>
            {log.notes ? (
              <View style={flipStyles.notesRow}>
                <Feather name="file-text" size={11} color={theme.textSecondary} />
                <ThemedText type="small" style={{ color: theme.text, marginLeft: 4, flex: 1 }} numberOfLines={2}>
                  {log.notes}
                </ThemedText>
              </View>
            ) : (
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 6, fontStyle: "italic" }}>
                Nessuna nota aggiuntiva
              </ThemedText>
            )}
          </LinearGradient>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const flipStyles = StyleSheet.create({
  cardFace: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  cardBack: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backContent: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    justifyContent: "center",
  },
  backHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  notesRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 6,
  },
});

export default function SanitizationLogScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const selectedVehicle = user?.vehicle || null;
  const vehicleId = selectedVehicle?.id;
  const vehicleCode = selectedVehicle?.code;
  const queryClient = useQueryClient();

  const [modalVisible, setModalVisible] = useState(false);
  const [operatorName, setOperatorName] = useState("");
  const [sanitizationType, setSanitizationType] = useState<SanitizationType>("straordinaria");
  const [notes, setNotes] = useState("");
  const [completedAt, setCompletedAt] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const { data: logs, isLoading: logsLoading, refetch: refetchLogs } = useQuery<SanitizationLog[]>({
    queryKey: ["/api/sanitization-logs", vehicleId],
    queryFn: async () => {
      if (!vehicleId) return [];
      const token = await getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const url = new URL(`/api/sanitization-logs/${vehicleId}`, getApiUrl());
      const res = await fetch(url.toString(), { credentials: "include", headers });
      if (!res.ok) throw new Error("Failed to fetch logs");
      return res.json();
    },
    enabled: !!vehicleId,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<SanitizationStats>({
    queryKey: ["/api/sanitization-logs", vehicleId, "stats"],
    queryFn: async () => {
      if (!vehicleId) return { total: 0, straordinaria: 0, infettivo: 0 };
      const token = await getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const url = new URL(`/api/sanitization-logs/${vehicleId}/stats`, getApiUrl());
      const res = await fetch(url.toString(), { credentials: "include", headers });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    enabled: !!vehicleId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: {
      vehicleId: string;
      vehicleCode: string;
      sanitizationType: string;
      operatorName: string;
      notes: string;
      productsUsed: string;
      completedAt: string;
    }) => {
      const token = await getAuthToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const url = new URL("/api/sanitization-logs", getApiUrl());
      const res = await fetch(url.toString(), {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to create log");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sanitization-logs", vehicleId] });
      queryClient.invalidateQueries({ queryKey: ["/api/sanitization-logs", vehicleId, "stats"] });
      resetForm();
      setModalVisible(false);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
    onError: (error: Error) => {
      Alert.alert("Errore", error.message || "Impossibile salvare la sanificazione");
    },
  });

  const resetForm = useCallback(() => {
    setOperatorName("");
    setSanitizationType("straordinaria");
    setNotes("");
    setCompletedAt(new Date());
  }, []);

  const handleSubmit = useCallback(() => {
    if (!operatorName.trim()) {
      Alert.alert("Campo obbligatorio", "Inserisci il nome dell'operatore");
      return;
    }
    if (!vehicleId || !vehicleCode) {
      Alert.alert("Errore", "Nessun veicolo selezionato");
      return;
    }
    createMutation.mutate({
      vehicleId,
      vehicleCode,
      sanitizationType,
      operatorName: operatorName.trim(),
      notes: notes.trim(),
      productsUsed: "",
      completedAt: completedAt.toISOString(),
    });
  }, [operatorName, vehicleId, vehicleCode, sanitizationType, notes, completedAt]);

  const openModal = useCallback(() => {
    resetForm();
    setModalVisible(true);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, []);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  };

  if (!vehicleId) {
    return (
      <ThemedView style={[styles.container, { paddingTop: headerHeight + Spacing.xl }]}>
        <View style={styles.emptyState}>
          <Feather name="alert-circle" size={48} color={theme.textSecondary} />
          <ThemedText type="h3" style={styles.emptyTitle}>Nessun veicolo</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center" }}>
            Seleziona un veicolo per visualizzare il registro sanificazioni.
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => {
              refetchLogs();
              queryClient.invalidateQueries({ queryKey: ["/api/sanitization-logs", vehicleId, "stats"] });
            }}
          />
        }
      >
        <View>
          <LinearGradient
            colors={isDark ? ["#0A2E5C", "#0F3D7A"] : ["#0064C5", "#0080E0"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.statsCard}
          >
            <View style={styles.statsHeader}>
              <View style={styles.statsHeaderLeft}>
                <Feather name="shield" size={20} color="#FFFFFF" />
                <ThemedText type="h3" style={styles.statsTitle}>Ultimi 30 giorni</ThemedText>
              </View>
              <View style={styles.vehicleBadge}>
                <ThemedText type="small" style={styles.vehicleBadgeText}>{vehicleCode}</ThemedText>
              </View>
            </View>

            {statsLoading ? (
              <ActivityIndicator color="#FFFFFF" style={{ marginVertical: Spacing.lg }} />
            ) : (
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <ThemedText type="h1" style={styles.statNumber}>{stats?.total ?? 0}</ThemedText>
                  <ThemedText type="small" style={styles.statLabel}>Totale</ThemedText>
                </View>
                <View style={[styles.statItem, styles.statDivider]}>
                  <ThemedText type="h2" style={[styles.statNumber, { color: "#6EE7A0" }]}>{stats?.straordinaria ?? 0}</ThemedText>
                  <ThemedText type="small" style={styles.statLabel}>Straordinarie</ThemedText>
                </View>
                <View style={[styles.statItem, styles.statDivider]}>
                  <ThemedText type="h2" style={[styles.statNumber, { color: "#FCA5A5" }]}>{stats?.infettivo ?? 0}</ThemedText>
                  <ThemedText type="small" style={styles.statLabel}>Paziente Infetto</ThemedText>
                </View>
              </View>
            )}
          </LinearGradient>
        </View>

        <View>
          <Pressable onPress={openModal} style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.85 }]}>
            <LinearGradient
              colors={["#00A651", "#00C464"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.addButtonGradient}
            >
              <Feather name="plus-circle" size={22} color="#FFFFFF" />
              <ThemedText type="h3" style={styles.addButtonText}>Registra Sanificazione</ThemedText>
            </LinearGradient>
          </Pressable>
        </View>

        <View style={styles.listSection}>
          <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>Registro</ThemedText>

          {logsLoading ? (
            <ActivityIndicator color={theme.primary} style={{ marginTop: Spacing.xl }} />
          ) : !logs || logs.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: isDark ? "rgba(0,166,81,0.15)" : "rgba(0,166,81,0.1)" }]}>
                <Feather name="droplet" size={32} color="#00A651" />
              </View>
              <ThemedText type="h3" style={styles.emptyTitle}>Nessuna sanificazione</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center", maxWidth: 280 }}>
                Registra la prima sanificazione del veicolo {vehicleCode} premendo il pulsante sopra.
              </ThemedText>
            </View>
          ) : (
            logs.map((log, index) => {
              const typeConfig = SANIT_TYPES[log.sanitizationType as SanitizationType] || SANIT_TYPES.straordinaria;
              return (
                <FlipCard key={log.id} log={log} typeConfig={typeConfig} theme={theme} isDark={isDark} />
              );
            })
          )}
        </View>
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}
        >
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setModalVisible(false)} hitSlop={12}>
              <ThemedText type="body" style={{ color: theme.primary }}>Annulla</ThemedText>
            </Pressable>
            <ThemedText type="h3">Nuova Sanificazione</ThemedText>
            <Pressable
              onPress={handleSubmit}
              disabled={createMutation.isPending}
              hitSlop={12}
            >
              {createMutation.isPending ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <ThemedText type="body" style={{ color: theme.primary, fontWeight: "700" }}>Salva</ThemedText>
              )}
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.formGroup}>
              <ThemedText type="label" style={[styles.formLabel, { color: theme.textSecondary }]}>
                NOME OPERATORE *
              </ThemedText>
              <TextInput
                style={[styles.textInput, {
                  backgroundColor: theme.inputBackground,
                  color: theme.text,
                  borderColor: theme.border,
                }]}
                value={operatorName}
                onChangeText={setOperatorName}
                placeholder="Nome e cognome"
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={styles.formGroup}>
              <ThemedText type="label" style={[styles.formLabel, { color: theme.textSecondary }]}>
                TIPO SANIFICAZIONE
              </ThemedText>
              <View style={styles.typeSelector}>
                {(Object.keys(SANIT_TYPES) as SanitizationType[]).map((key) => {
                  const config = SANIT_TYPES[key];
                  const isSelected = sanitizationType === key;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => {
                        setSanitizationType(key);
                        if (Platform.OS !== "web") {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }
                      }}
                      style={[
                        styles.typeButton,
                        {
                          backgroundColor: isSelected ? config.color + "20" : theme.backgroundSecondary,
                          borderColor: isSelected ? config.color : theme.border,
                          borderWidth: isSelected ? 2 : 1,
                        },
                      ]}
                    >
                      <Feather name={config.icon as any} size={18} color={isSelected ? config.color : theme.textSecondary} />
                      <ThemedText
                        type="small"
                        style={{
                          color: isSelected ? config.color : theme.text,
                          fontWeight: isSelected ? "700" : "500",
                          marginTop: 4,
                        }}
                      >
                        {config.label}
                      </ThemedText>
                      <ThemedText
                        type="small"
                        style={{
                          color: isSelected ? config.color : theme.textSecondary,
                          fontSize: 10,
                          marginTop: 2,
                        }}
                      >
                        {config.description}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.formGroup}>
              <ThemedText type="label" style={[styles.formLabel, { color: theme.textSecondary }]}>
                NOTE
              </ThemedText>
              <TextInput
                style={[styles.textInput, styles.textArea, {
                  backgroundColor: theme.inputBackground,
                  color: theme.text,
                  borderColor: theme.border,
                }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Note aggiuntive..."
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.formGroup}>
              <ThemedText type="label" style={[styles.formLabel, { color: theme.textSecondary }]}>
                DATA E ORA
              </ThemedText>
              {Platform.OS === "web" ? (
                <Pressable
                  style={[styles.textInput, {
                    backgroundColor: theme.inputBackground,
                    borderColor: theme.border,
                    justifyContent: "center",
                  }]}
                >
                  <ThemedText type="body">
                    {completedAt.toLocaleDateString("it-IT")} {completedAt.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                  </ThemedText>
                </Pressable>
              ) : Platform.OS === "ios" ? (
                <DateTimePicker
                  value={completedAt}
                  mode="datetime"
                  display="compact"
                  onChange={(_, date) => { if (date) setCompletedAt(date); }}
                  locale="it-IT"
                  maximumDate={new Date()}
                  themeVariant={isDark ? "dark" : "light"}
                  style={{ alignSelf: "flex-start" }}
                />
              ) : (
                <>
                  <Pressable
                    onPress={() => setShowDatePicker(true)}
                    style={[styles.textInput, {
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.border,
                      justifyContent: "center",
                    }]}
                  >
                    <ThemedText type="body">
                      {completedAt.toLocaleDateString("it-IT")} {completedAt.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                    </ThemedText>
                  </Pressable>
                  {showDatePicker ? (
                    <DateTimePicker
                      value={completedAt}
                      mode="datetime"
                      display="default"
                      onChange={(_, date) => {
                        setShowDatePicker(false);
                        if (date) setCompletedAt(date);
                      }}
                      maximumDate={new Date()}
                    />
                  ) : null}
                </>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statsCard: {
    borderRadius: BorderRadius["2xl"],
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  statsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  statsHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  statsTitle: {
    color: "#FFFFFF",
  },
  vehicleBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  vehicleBadgeText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  statsGrid: {
    flexDirection: "row",
    alignItems: "center",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statDivider: {
    borderLeftWidth: 1,
    borderLeftColor: "rgba(255,255,255,0.2)",
  },
  statNumber: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  statLabel: {
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
  addButton: {
    marginBottom: Spacing.xl,
  },
  addButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.xl,
    gap: Spacing.sm,
  },
  addButtonText: {
    color: "#FFFFFF",
  },
  listSection: {
    flex: 1,
  },
  logCard: {
    marginBottom: Spacing.md,
  },
  logHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  logOperator: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  logDateTime: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  logDetail: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: Spacing.xs,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["3xl"],
    gap: Spacing.md,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    marginTop: Spacing.sm,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  modalContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing["4xl"],
  },
  formGroup: {
    marginBottom: Spacing.xl,
  },
  formLabel: {
    marginBottom: Spacing.sm,
    letterSpacing: 0.5,
  },
  textInput: {
    height: Spacing.inputHeight,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: 15,
  },
  textArea: {
    height: 90,
    paddingTop: Spacing.md,
  },
  typeSelector: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  typeButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
});
