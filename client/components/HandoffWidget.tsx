import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  FadeInDown,
} from "react-native-reanimated";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { getApiUrl, getAuthToken, apiRequest } from "@/lib/query-client";
import type { HomeStackParamList } from "@/navigation/HomeStackNavigator";

interface Handoff {
  id: string;
  vehicleId: string;
  vehicleCode: string;
  createdByUserId: string;
  createdByName: string;
  message: string;
  priority: "urgent" | "normal" | "low";
  category: "general" | "maintenance" | "equipment" | "patient" | "safety";
  kmAtHandoff: number | null;
  status: "pending" | "read" | "archived";
  readByUserId: string | null;
  readByName: string | null;
  readAt: string | null;
  expiresAt: string;
  createdAt: string;
}

const PRIORITY_CONFIG = {
  urgent: {
    icon: "alert-triangle" as const,
    colors: ["#DC3545", "#C82333"],
    bgColor: "rgba(220, 53, 69, 0.15)",
    textColor: "#DC3545",
    label: "Urgente",
  },
  normal: {
    icon: "info" as const,
    colors: ["#0066CC", "#0052A3"],
    bgColor: "rgba(0, 102, 204, 0.15)",
    textColor: "#0066CC",
    label: "Normale",
  },
  low: {
    icon: "chevron-down" as const,
    colors: ["#6C757D", "#545B62"],
    bgColor: "rgba(108, 117, 125, 0.15)",
    textColor: "#6C757D",
    label: "Bassa priorità",
  },
};

const CATEGORY_CONFIG = {
  general: { icon: "message-square" as const, label: "Generale" },
  maintenance: { icon: "tool" as const, label: "Manutenzione" },
  equipment: { icon: "package" as const, label: "Attrezzature" },
  patient: { icon: "heart" as const, label: "Paziente" },
  safety: { icon: "shield" as const, label: "Sicurezza" },
};

export function HandoffWidget() {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);

  const vehicleId = user?.vehicle?.id;

  const pulseAnimation = useSharedValue(1);
  const glowAnimation = useSharedValue(0);

  React.useEffect(() => {
    pulseAnimation.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    glowAnimation.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnimation.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowAnimation.value,
  }));

  const { data: pendingHandoff, isLoading } = useQuery<Handoff | null>({
    queryKey: ["/api/handoffs/pending", vehicleId],
    queryFn: async () => {
      if (!vehicleId) return null;
      const token = await getAuthToken();
      const url = new URL(`/api/handoffs/pending/${vehicleId}`, getApiUrl());
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(url.toString(), { credentials: "include", headers });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!vehicleId,
    refetchInterval: 30000,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async ({ handoffId, readerName }: { handoffId: string; readerName: string }) => {
      const token = await getAuthToken();
      const url = new URL(`/api/handoffs/${handoffId}/read`, getApiUrl());
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(url.toString(), { 
        method: "POST", 
        credentials: "include", 
        headers,
        body: JSON.stringify({ readerName: readerName.trim() }),
      });
      if (!res.ok) throw new Error("Failed to mark handoff as read");
      return res.json();
    },
    onSuccess: () => {
      setShowViewModal(false);
      setTimeout(() => {
        queryClient.setQueryData(["/api/handoffs/pending", vehicleId], null);
        queryClient.invalidateQueries({ queryKey: ["/api/handoffs/pending", vehicleId] });
        queryClient.invalidateQueries({ queryKey: ["/api/handoffs/vehicle"] });
      }, 350);
    },
  });

  const handleViewHandoff = () => {
    setShowViewModal(true);
  };

  const handleConfirmRead = async (readerName: string) => {
    if (pendingHandoff && readerName.trim()) {
      await markAsReadMutation.mutateAsync({ handoffId: pendingHandoff.id, readerName: readerName.trim() });
    }
  };

  const hasPendingHandoff = pendingHandoff && pendingHandoff.status === "pending";
  const priorityConfig = (pendingHandoff && PRIORITY_CONFIG[pendingHandoff.priority]) || PRIORITY_CONFIG.normal;
  const categoryConfig = (pendingHandoff && CATEGORY_CONFIG[pendingHandoff.category]) || CATEGORY_CONFIG.general;

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffMins < 1) return "ora";
    if (diffMins < 60) return `${diffMins} min fa`;
    if (diffHours < 24) return `${diffHours}h fa`;
    return date.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
  };

  return (
    <>
      <Pressable
        onPress={hasPendingHandoff ? handleViewHandoff : () => setShowCreateModal(true)}
        style={[
          styles.container,
          hasPendingHandoff && {
            borderWidth: 2,
            borderColor: priorityConfig.textColor,
          },
        ]}
      >
        <LinearGradient
          colors={hasPendingHandoff 
            ? ['rgba(220, 53, 69, 0.15)', 'rgba(220, 53, 69, 0.05)']
            : ['rgba(0, 102, 204, 0.12)', 'rgba(0, 166, 81, 0.08)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBg}
        >
          {hasPendingHandoff && pendingHandoff.priority === "urgent" && (
            <Animated.View style={[styles.urgentGlow, glowStyle]}>
              <LinearGradient
                colors={["rgba(220, 53, 69, 0.3)", "transparent"]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
              />
            </Animated.View>
          )}

          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={[styles.iconContainer, { backgroundColor: hasPendingHandoff ? priorityConfig.bgColor : theme.primaryLight }]}>
                {hasPendingHandoff ? (
                  <Animated.View style={pendingHandoff.priority === "urgent" ? pulseStyle : undefined}>
                    <Feather
                      name={priorityConfig.icon}
                      size={20}
                      color={priorityConfig.textColor}
                    />
                  </Animated.View>
                ) : (
                  <Feather name="repeat" size={20} color={theme.primary} />
                )}
              </View>
              <View style={styles.titleContainer}>
                <ThemedText style={styles.title} numberOfLines={1}>
                  {hasPendingHandoff ? "Consegna Ricevuta" : "Consegna Digitale"}
                </ThemedText>
                {hasPendingHandoff && (
                  <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
                    da {pendingHandoff.createdByName} - {formatTime(pendingHandoff.createdAt)}
                  </ThemedText>
                )}
              </View>
            </View>

            {hasPendingHandoff && (
              <View style={[styles.badge, { backgroundColor: priorityConfig.bgColor }]}>
                <ThemedText style={[styles.badgeText, { color: priorityConfig.textColor }]}>
                  {priorityConfig.label}
                </ThemedText>
              </View>
            )}
          </View>

          {hasPendingHandoff ? (
            <Animated.View entering={FadeInDown.duration(300)} style={styles.messagePreview}>
              <View style={styles.categoryRow}>
                <Feather
                  name={categoryConfig.icon}
                  size={14}
                  color={theme.textSecondary}
                />
                <ThemedText style={[styles.categoryLabel, { color: theme.textSecondary }]}>
                  {categoryConfig.label}
                </ThemedText>
              </View>
              <ThemedText style={styles.messageText} numberOfLines={2}>
                {pendingHandoff.message}
              </ThemedText>
              <View style={styles.tapHint}>
                <Feather name="eye" size={14} color={theme.primary} />
                <ThemedText style={[styles.tapHintText, { color: theme.primary }]}>
                  Tocca per leggere e confermare
                </ThemedText>
              </View>
            </Animated.View>
          ) : (
            <View style={styles.emptyState}>
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                Nessun messaggio dal turno precedente
              </ThemedText>
              <View style={styles.createButton}>
                <Feather name="plus" size={16} color={theme.primary} />
                <ThemedText style={[styles.createButtonText, { color: theme.primary }]}>
                  Lascia un messaggio per il prossimo turno
                </ThemedText>
              </View>
            </View>
          )}

          <Pressable 
            style={styles.historyLink} 
            onPress={(e) => {
              e.stopPropagation();
              navigation.navigate("HandoffHistory");
            }}
          >
            <Feather name="clock" size={14} color={theme.textSecondary} />
            <ThemedText style={[styles.historyLinkText, { color: theme.textSecondary }]}>
              Vedi storico consegne
            </ThemedText>
            <Feather name="chevron-right" size={14} color={theme.textSecondary} />
          </Pressable>
        </LinearGradient>
      </Pressable>

      <ViewHandoffModal
        visible={showViewModal}
        handoff={pendingHandoff ?? null}
        onClose={() => setShowViewModal(false)}
        onConfirm={handleConfirmRead}
        isLoading={markAsReadMutation.isPending}
      />

      <CreateHandoffModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        vehicleId={vehicleId}
      />
    </>
  );
}

interface ViewModalProps {
  visible: boolean;
  handoff: Handoff | null;
  onClose: () => void;
  onConfirm: (readerName: string) => void;
  isLoading: boolean;
}

function ViewHandoffModal({ visible, handoff, onClose, onConfirm, isLoading }: ViewModalProps) {
  const { theme } = useTheme();
  const [readerName, setReaderName] = React.useState("");

  React.useEffect(() => {
    if (visible) setReaderName("");
  }, [visible]);

  const priorityConfig = handoff ? (PRIORITY_CONFIG[handoff.priority] || PRIORITY_CONFIG.normal) : PRIORITY_CONFIG.normal;
  const categoryConfig = handoff ? (CATEGORY_CONFIG[handoff.category] || CATEGORY_CONFIG.general) : CATEGORY_CONFIG.general;

  return (
    <Modal visible={visible && !!handoff} animationType="slide" transparent presentationStyle="overFullScreen">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <Pressable style={styles.modalOverlay} onPress={onClose}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <Pressable onPress={(e) => e.stopPropagation()}>
              <LinearGradient
                colors={priorityConfig.colors as [string, string]}
                style={styles.modalHeader}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <View style={styles.modalHeaderContent}>
                  <View style={styles.modalHeaderIcon}>
                    <Feather name={priorityConfig.icon} size={24} color="#FFF" />
                  </View>
                  <View style={styles.modalHeaderText}>
                    <ThemedText style={styles.modalTitle}>Consegna dal Turno Precedente</ThemedText>
                    <ThemedText style={styles.modalSubtitle}>
                      Da: {handoff?.createdByName} - {handoff?.vehicleCode}
                    </ThemedText>
                  </View>
                </View>
              </LinearGradient>

              <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
                <View style={[styles.metaRow, { borderBottomColor: theme.border }]}>
                  <View style={styles.metaItem}>
                    <Feather name="clock" size={16} color={theme.textSecondary} />
                    <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                      {handoff ? new Date(handoff.createdAt).toLocaleString("it-IT") : ''}
                    </ThemedText>
                  </View>
                  <View style={styles.metaItem}>
                    <Feather name={categoryConfig.icon} size={16} color={theme.textSecondary} />
                    <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                      {categoryConfig.label}
                    </ThemedText>
                  </View>
                  {handoff?.kmAtHandoff ? (
                    <View style={styles.metaItem}>
                      <Feather name="navigation" size={16} color={theme.textSecondary} />
                      <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                        {handoff.kmAtHandoff.toLocaleString()} km
                      </ThemedText>
                    </View>
                  ) : null}
                </View>

                <View style={styles.messageContainer}>
                  <ThemedText style={styles.fullMessage}>{handoff?.message}</ThemedText>
                </View>

                <View style={styles.readerNameSection}>
                  <ThemedText style={[styles.sectionLabel, { color: theme.text }]}>
                    Il tuo Nome e Cognome <ThemedText style={{ color: theme.error, fontWeight: "800" }}>*</ThemedText>
                  </ThemedText>
                  <TextInput
                    style={[
                      styles.readerNameInput,
                      {
                        backgroundColor: theme.inputBackground,
                        color: theme.text,
                        borderColor: !readerName.trim() ? theme.error : theme.border,
                      },
                    ]}
                    placeholder="Inserisci il tuo nome e cognome"
                    placeholderTextColor={theme.textSecondary}
                    value={readerName}
                    onChangeText={setReaderName}
                    autoCapitalize="words"
                  />
                </View>

                <Pressable
                  style={[styles.confirmButton, { backgroundColor: readerName.trim() ? theme.success : theme.backgroundTertiary }]}
                  onPress={() => onConfirm(readerName)}
                  disabled={isLoading || !readerName.trim()}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <>
                      <Feather name="check-circle" size={20} color="#FFF" />
                      <ThemedText style={styles.confirmButtonText}>
                        Confermo di aver letto
                      </ThemedText>
                    </>
                  )}
                </Pressable>

                <Pressable style={styles.closeButton} onPress={onClose}>
                  <ThemedText style={[styles.closeButtonText, { color: theme.textSecondary }]}>
                    Chiudi
                  </ThemedText>
                </Pressable>
              </ScrollView>
            </Pressable>
          </View>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

interface CreateModalProps {
  visible: boolean;
  onClose: () => void;
  vehicleId: string | undefined;
}

function CreateHandoffModal({ visible, onClose, vehicleId }: CreateModalProps) {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [submitterName, setSubmitterName] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<"urgent" | "normal" | "low">("normal");
  const [category, setCategory] = useState<keyof typeof CATEGORY_CONFIG>("general");

  const createMutation = useMutation({
    mutationFn: async (data: { vehicleId: string; message: string; priority: string; category: string; createdByName: string }) => {
      const token = await getAuthToken();
      const url = new URL("/api/handoffs", getApiUrl());
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(url.toString(), { 
        method: "POST", 
        credentials: "include", 
        headers,
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create handoff");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/handoffs/pending"] });
      setSubmitterName("");
      setMessage("");
      setPriority("normal");
      setCategory("general");
      onClose();
    },
  });

  const handleCreate = () => {
    if (!vehicleId || !message.trim() || !submitterName.trim()) return;
    createMutation.mutate({
      vehicleId,
      message: message.trim(),
      priority,
      category,
      createdByName: submitterName.trim(),
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"} 
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <Pressable style={styles.modalOverlay} onPress={onClose}>
          <View style={[styles.createModalContent, { backgroundColor: theme.cardBackground }]}>
            <Pressable onPress={(e) => e.stopPropagation()}>
              <LinearGradient
                colors={["#0066CC", "#00A651"]}
                style={styles.modalHeader}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <View style={styles.modalHeaderContent}>
                  <View style={styles.modalHeaderIcon}>
                    <Feather name="edit-3" size={24} color="#FFF" />
                  </View>
                  <View style={styles.modalHeaderText}>
                    <ThemedText style={styles.modalTitle}>Nuova Consegna</ThemedText>
                    <ThemedText style={styles.modalSubtitle}>
                      Lascia un messaggio per il prossimo turno
                    </ThemedText>
                  </View>
                </View>
              </LinearGradient>

              <ScrollView 
                style={styles.createModalBody} 
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                contentContainerStyle={{ paddingBottom: 40 }}
              >
                <View style={styles.messageSection}>
                  <ThemedText style={styles.sectionLabel}>Messaggio <ThemedText style={{ color: theme.error, fontWeight: "800" }}>*</ThemedText></ThemedText>
                  <TextInput
                    style={[
                      styles.messageInput,
                      { 
                        backgroundColor: theme.inputBackground,
                        color: theme.text,
                        borderColor: theme.border,
                      },
                    ]}
                    placeholder="Scrivi il messaggio per il prossimo turno..."
                    placeholderTextColor={theme.textSecondary}
                    value={message}
                    onChangeText={setMessage}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.messageSection}>
                  <ThemedText style={styles.sectionLabel}>
                    Nome e Cognome <ThemedText style={{ color: theme.error, fontWeight: "800" }}>*</ThemedText>
                  </ThemedText>
                  <TextInput
                    style={[
                      styles.nameInput,
                      { 
                        backgroundColor: theme.inputBackground,
                        color: theme.text,
                        borderColor: !submitterName.trim() ? theme.error : theme.border,
                      },
                    ]}
                    placeholder="Il tuo nome e cognome"
                    placeholderTextColor={theme.textSecondary}
                    value={submitterName}
                    onChangeText={setSubmitterName}
                  />
                </View>

                <View style={styles.prioritySection}>
                  <ThemedText style={styles.sectionLabel}>Priorità</ThemedText>
                  <View style={styles.priorityOptions}>
                    {(Object.keys(PRIORITY_CONFIG) as Array<keyof typeof PRIORITY_CONFIG>).map((key) => {
                      const config = PRIORITY_CONFIG[key];
                      const isSelected = priority === key;
                      return (
                        <Pressable
                          key={key}
                          style={[
                            styles.priorityOption,
                            { backgroundColor: isSelected ? config.bgColor : theme.backgroundSecondary },
                            isSelected && { borderColor: config.textColor, borderWidth: 2 },
                          ]}
                          onPress={() => setPriority(key)}
                        >
                          <Feather name={config.icon} size={16} color={isSelected ? config.textColor : theme.textSecondary} />
                          <ThemedText style={[styles.priorityOptionText, { color: isSelected ? config.textColor : theme.textSecondary }]}>
                            {config.label}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.categorySection}>
                  <ThemedText style={styles.sectionLabel}>Categoria</ThemedText>
                  <View style={styles.categoryOptions}>
                    {(Object.keys(CATEGORY_CONFIG) as Array<keyof typeof CATEGORY_CONFIG>).map((key) => {
                      const config = CATEGORY_CONFIG[key];
                      const isSelected = category === key;
                      return (
                        <Pressable
                          key={key}
                          style={[
                            styles.categoryOption,
                            { backgroundColor: isSelected ? theme.primaryLight : theme.backgroundSecondary },
                            isSelected && { borderColor: theme.primary, borderWidth: 2 },
                          ]}
                          onPress={() => setCategory(key)}
                        >
                          <Feather name={config.icon} size={16} color={isSelected ? theme.primary : theme.textSecondary} />
                          <ThemedText style={[styles.categoryOptionText, { color: isSelected ? theme.primary : theme.textSecondary }]}>
                            {config.label}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <Pressable
                  style={[
                    styles.submitButton,
                    { backgroundColor: message.trim() && submitterName.trim() ? theme.primary : theme.backgroundTertiary },
                  ]}
                  onPress={handleCreate}
                  disabled={!message.trim() || !submitterName.trim() || createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <>
                      <Feather name="send" size={18} color="#FFF" />
                      <ThemedText style={styles.submitButtonText}>Invia Consegna</ThemedText>
                    </>
                  )}
                </Pressable>

                <Pressable style={styles.cancelButton} onPress={onClose}>
                  <ThemedText style={[styles.cancelButtonText, { color: theme.textSecondary }]}>
                    Annulla
                  </ThemedText>
                </Pressable>
              </ScrollView>
            </Pressable>
          </View>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
    overflow: "hidden",
    position: "relative",
    borderRadius: BorderRadius.lg,
  },
  gradientBg: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  urgentGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    zIndex: 0,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
    zIndex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.sm,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    ...Typography.h3,
    marginBottom: 2,
  },
  subtitle: {
    ...Typography.small,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    marginLeft: Spacing.sm,
  },
  badgeText: {
    ...Typography.label,
    fontWeight: "600",
  },
  messagePreview: {
    zIndex: 1,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  categoryLabel: {
    ...Typography.small,
    marginLeft: Spacing.xs,
  },
  messageText: {
    ...Typography.body,
    marginBottom: Spacing.sm,
  },
  tapHint: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  tapHintText: {
    ...Typography.small,
    marginLeft: Spacing.xs,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  emptyText: {
    ...Typography.body,
    marginBottom: Spacing.sm,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  createButtonText: {
    ...Typography.body,
    marginLeft: Spacing.xs,
    fontWeight: "500",
  },
  historyLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: Spacing.md,
    marginTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
    gap: 6,
  },
  historyLinkText: {
    fontSize: 13,
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: "80%",
    overflow: "hidden",
  },
  createModalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: "90%",
  },
  modalHeader: {
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
  },
  modalHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  modalHeaderIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  modalHeaderText: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFF",
  },
  modalSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  modalBody: {
    padding: Spacing.lg,
  },
  createModalBody: {
    padding: Spacing.lg,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingBottom: Spacing.md,
    marginBottom: Spacing.md,
    borderBottomWidth: 1,
    gap: Spacing.lg,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaText: {
    ...Typography.small,
    marginLeft: Spacing.xs,
  },
  messageContainer: {
    marginBottom: Spacing.lg,
  },
  fullMessage: {
    ...Typography.body,
    lineHeight: 24,
  },
  readerNameSection: {
    marginBottom: Spacing.lg,
  },
  readerNameInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 15,
    marginTop: Spacing.xs,
  },
  confirmButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  confirmButtonText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 16,
    marginLeft: Spacing.sm,
  },
  closeButton: {
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  closeButtonText: {
    ...Typography.body,
  },
  prioritySection: {
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    ...Typography.h3,
    marginBottom: Spacing.sm,
  },
  priorityOptions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  priorityOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  priorityOptionText: {
    ...Typography.small,
    fontWeight: "500",
  },
  categorySection: {
    marginBottom: Spacing.lg,
  },
  categoryOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  categoryOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  categoryOptionText: {
    ...Typography.small,
    fontWeight: "500",
  },
  messageSection: {
    marginBottom: Spacing.xl,
  },
  nameInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    ...Typography.body,
  },
  messageInput: {
    minHeight: 120,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    ...Typography.body,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  submitButtonText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 16,
  },
  cancelButton: {
    alignItems: "center",
    paddingVertical: Spacing.md,
    marginBottom: Spacing.xl,
  },
  cancelButtonText: {
    ...Typography.body,
  },
});
