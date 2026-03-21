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
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest, getApiUrl, getAuthToken } from "@/lib/query-client";

type VolunteerType = "continuativo" | "occasionale";
type VolunteerStatus = "active" | "suspended" | "terminated";

interface VolunteerEntry {
  id: string;
  organizationId: string;
  progressiveNumber: number;
  firstName: string;
  lastName: string;
  fiscalCode: string | null;
  birthDate: string | null;
  birthPlace: string | null;
  gender: string | null;
  residenceAddress: string | null;
  residenceCity: string | null;
  residenceProvince: string | null;
  residencePostalCode: string | null;
  phone: string | null;
  email: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  volunteerType: VolunteerType;
  status: VolunteerStatus;
  startDate: string;
  startSignatureConfirmed: boolean;
  startSignatureDate: string | null;
  endDate: string | null;
  endSignatureConfirmed: boolean;
  endSignatureDate: string | null;
  endReason: string | null;
  insuranceNotified: boolean;
  insuranceNotifiedDate: string | null;
  insurancePolicyNumber: string | null;
  role: string | null;
  qualifications: string | null;
  trainingCompleted: any;
  notes: string | null;
  integrityHash: string | null;
  integritySignedAt: string | null;
  integrityAlgorithm: string | null;
  integrityStatus: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RegistryStats {
  total: number;
  active: number;
  continuativi: number;
  occasionali: number;
  suspended: number;
  terminated: number;
  integrity: { valid: number; broken: number; notSigned: number; total: number };
}

interface FormData {
  firstName: string;
  lastName: string;
  fiscalCode: string;
  birthDate: string;
  birthPlace: string;
  gender: string;
  residenceAddress: string;
  residenceCity: string;
  residenceProvince: string;
  residencePostalCode: string;
  phone: string;
  email: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  volunteerType: VolunteerType;
  startDate: string;
  role: string;
  qualifications: string;
  insurancePolicyNumber: string;
  notes: string;
}

const emptyForm: FormData = {
  firstName: "",
  lastName: "",
  fiscalCode: "",
  birthDate: "",
  birthPlace: "",
  gender: "",
  residenceAddress: "",
  residenceCity: "",
  residenceProvince: "",
  residencePostalCode: "",
  phone: "",
  email: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  emergencyContactRelation: "",
  volunteerType: "continuativo",
  startDate: new Date().toISOString().split("T")[0],
  role: "",
  qualifications: "",
  insurancePolicyNumber: "",
  notes: "",
};

const STATUS_CONFIG: Record<VolunteerStatus, { label: string; color: string }> = {
  active: { label: "Attivo", color: "#00A651" },
  suspended: { label: "Sospeso", color: "#FFC107" },
  terminated: { label: "Cessato", color: "#DC3545" },
};

const TYPE_CONFIG: Record<VolunteerType, { label: string; color: string }> = {
  continuativo: { label: "Continuativo", color: "#0066CC" },
  occasionale: { label: "Occasionale", color: "#EA580C" },
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
}

function IntegrityIcon({ status, size = 16 }: { status: string | null; size?: number }) {
  const { theme } = useTheme();
  if (status === "VALID") return <Feather name="check-circle" size={size} color="#00A651" />;
  if (status === "BROKEN") return <Feather name="alert-triangle" size={size} color="#DC3545" />;
  return <Feather name="minus-circle" size={size} color={theme.textSecondary} />;
}

export default function VolunteerRegistryScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [formModalVisible, setFormModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<VolunteerEntry | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: volunteers, isLoading, refetch } = useQuery<VolunteerEntry[]>({
    queryKey: ["/api/admin/volunteer-registry"],
  });

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<RegistryStats>({
    queryKey: ["/api/admin/volunteer-registry-stats"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await apiRequest("POST", "/api/admin/volunteer-registry", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/volunteer-registry"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/volunteer-registry-stats"] });
      setFormModalVisible(false);
      resetForm();
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (err: Error) => Alert.alert("Errore", err.message || "Impossibile creare il volontario"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormData }) => {
      const res = await apiRequest("PUT", `/api/admin/volunteer-registry/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/volunteer-registry"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/volunteer-registry-stats"] });
      setFormModalVisible(false);
      setEditingId(null);
      resetForm();
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (err: Error) => Alert.alert("Errore", err.message || "Impossibile aggiornare il volontario"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/volunteer-registry/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/volunteer-registry"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/volunteer-registry-stats"] });
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (err: Error) => Alert.alert("Errore", err.message || "Impossibile eliminare il volontario"),
  });

  const signMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/volunteer-registry/${id}/sign`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/volunteer-registry"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/volunteer-registry-stats"] });
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Successo", "Voce firmata con successo");
    },
    onError: (err: Error) => Alert.alert("Errore", err.message || "Impossibile firmare la voce"),
  });

  const bulkSignMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/volunteer-registry/bulk-sign");
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/volunteer-registry"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/volunteer-registry-stats"] });
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Successo", `Firma massiva completata: ${data?.signed ?? 0} voci firmate`);
    },
    onError: (err: Error) => Alert.alert("Errore", err.message || "Impossibile completare la firma massiva"),
  });

  const resetForm = useCallback(() => {
    setForm(emptyForm);
    setEditingId(null);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      Alert.alert("Campi obbligatori", "Nome e cognome sono obbligatori");
      return;
    }
    if (!form.startDate.trim()) {
      Alert.alert("Campo obbligatorio", "La data di inizio è obbligatoria");
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  }, [form, editingId]);

  const openCreateModal = useCallback(() => {
    resetForm();
    setFormModalVisible(true);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const openEditModal = useCallback((entry: VolunteerEntry) => {
    setEditingId(entry.id);
    setForm({
      firstName: entry.firstName,
      lastName: entry.lastName,
      fiscalCode: entry.fiscalCode || "",
      birthDate: entry.birthDate || "",
      birthPlace: entry.birthPlace || "",
      gender: entry.gender || "",
      residenceAddress: entry.residenceAddress || "",
      residenceCity: entry.residenceCity || "",
      residenceProvince: entry.residenceProvince || "",
      residencePostalCode: entry.residencePostalCode || "",
      phone: entry.phone || "",
      email: entry.email || "",
      emergencyContactName: entry.emergencyContactName || "",
      emergencyContactPhone: entry.emergencyContactPhone || "",
      emergencyContactRelation: entry.emergencyContactRelation || "",
      volunteerType: entry.volunteerType,
      startDate: entry.startDate,
      role: entry.role || "",
      qualifications: entry.qualifications || "",
      insurancePolicyNumber: entry.insurancePolicyNumber || "",
      notes: entry.notes || "",
    });
    setFormModalVisible(true);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const openDetail = useCallback((entry: VolunteerEntry) => {
    setSelectedEntry(entry);
    setDetailModalVisible(true);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleDelete = useCallback((id: string, name: string) => {
    Alert.alert("Conferma eliminazione", `Eliminare il volontario ${name}?`, [
      { text: "Annulla", style: "cancel" },
      { text: "Elimina", style: "destructive", onPress: () => deleteMutation.mutate(id) },
    ]);
  }, []);

  const handleVerify = useCallback(async (id: string) => {
    try {
      const res = await apiRequest("GET", `/api/admin/volunteer-registry/${id}/verify`);
      const data = await res.json();
      Alert.alert(
        data.valid ? "Integrita valida" : "Integrita compromessa",
        data.valid ? "La voce non è stata modificata dopo la firma." : "La voce è stata modificata dopo la firma. Stato: " + data.status
      );
    } catch (err: any) {
      Alert.alert("Errore", err.message || "Impossibile verificare l'integrita");
    }
  }, []);

  const handleDownloadPdf = useCallback(async (id: string) => {
    try {
      const baseUrl = getApiUrl();
      const token = await getAuthToken();
      const url = new URL(`/api/admin/volunteer-registry/${id}/pdf`, baseUrl);
      if (token) url.searchParams.set("token", token);
      if (Platform.OS === "web") {
        window.open(url.toString(), "_blank");
      } else {
        await WebBrowser.openBrowserAsync(url.toString());
      }
    } catch (err: any) {
      Alert.alert("Errore", "Impossibile scaricare il PDF");
    }
  }, []);

  const handleDownloadFullPdf = useCallback(async () => {
    try {
      const baseUrl = getApiUrl();
      const token = await getAuthToken();
      const url = new URL("/api/admin/volunteer-registry-pdf", baseUrl);
      if (token) url.searchParams.set("token", token);
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (Platform.OS === "web") {
        window.open(url.toString(), "_blank");
      } else {
        await WebBrowser.openBrowserAsync(url.toString());
      }
    } catch (err: any) {
      Alert.alert("Errore", "Impossibile scaricare il PDF del registro");
    }
  }, []);

  const handleBulkSign = useCallback(() => {
    Alert.alert("Firma massiva", "Firmare tutte le voci non firmate o con integrita compromessa?", [
      { text: "Annulla", style: "cancel" },
      { text: "Firma tutto", onPress: () => bulkSignMutation.mutate() },
    ]);
  }, []);

  const updateField = useCallback((field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const isMutating = createMutation.isPending || updateMutation.isPending;

  const renderFormField = (label: string, field: keyof FormData, placeholder: string, required = false, multiline = false) => (
    <View style={styles.formGroup}>
      <ThemedText type="label" style={[styles.formLabel, { color: theme.textSecondary }]}>
        {label}{required ? " *" : ""}
      </ThemedText>
      <TextInput
        style={[
          styles.textInput,
          multiline ? styles.textArea : null,
          { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border },
        ]}
        value={form[field]}
        onChangeText={(v) => updateField(field, v)}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        textAlignVertical={multiline ? "top" : "center"}
      />
    </View>
  );

  const renderDetailRow = (label: string, value: string | null) => (
    <View style={styles.detailRow}>
      <ThemedText type="small" style={{ color: theme.textSecondary, width: 130 }}>{label}</ThemedText>
      <ThemedText type="body" style={{ flex: 1 }}>{value || "-"}</ThemedText>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
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
            onRefresh={() => { refetch(); refetchStats(); }}
          />
        }
      >
        {/* Stats Dashboard */}
        <LinearGradient
          colors={isDark ? ["#0A2E5C", "#0F3D7A"] : ["#0064C5", "#0080E0"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.statsCard}
        >
          <View style={styles.statsHeader}>
            <View style={styles.statsHeaderLeft}>
              <Feather name="users" size={20} color="#FFFFFF" />
              <ThemedText type="h3" style={styles.statsTitle}>Registro Volontari</ThemedText>
            </View>
          </View>
          {statsLoading ? (
            <ActivityIndicator color="#FFFFFF" style={{ marginVertical: Spacing.lg }} />
          ) : (
            <View>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <ThemedText type="h1" style={styles.statNumber}>{stats?.total ?? 0}</ThemedText>
                  <ThemedText type="small" style={styles.statLabel}>Totale</ThemedText>
                </View>
                <View style={[styles.statItem, styles.statDivider]}>
                  <ThemedText type="h2" style={[styles.statNumber, { color: "#6EE7A0" }]}>{stats?.active ?? 0}</ThemedText>
                  <ThemedText type="small" style={styles.statLabel}>Attivi</ThemedText>
                </View>
                <View style={[styles.statItem, styles.statDivider]}>
                  <ThemedText type="h2" style={[styles.statNumber, { color: "#FFD740" }]}>{stats?.suspended ?? 0}</ThemedText>
                  <ThemedText type="small" style={styles.statLabel}>Sospesi</ThemedText>
                </View>
                <View style={[styles.statItem, styles.statDivider]}>
                  <ThemedText type="h2" style={[styles.statNumber, { color: "#FCA5A5" }]}>{stats?.terminated ?? 0}</ThemedText>
                  <ThemedText type="small" style={styles.statLabel}>Cessati</ThemedText>
                </View>
              </View>
              <View style={styles.statsRowSecondary}>
                <View style={[styles.miniStatBadge, { backgroundColor: "rgba(0,102,204,0.3)" }]}>
                  <ThemedText type="small" style={styles.miniStatText}>Continuativi: {stats?.continuativi ?? 0}</ThemedText>
                </View>
                <View style={[styles.miniStatBadge, { backgroundColor: "rgba(234,88,12,0.3)" }]}>
                  <ThemedText type="small" style={styles.miniStatText}>Occasionali: {stats?.occasionali ?? 0}</ThemedText>
                </View>
              </View>
              <View style={styles.statsRowSecondary}>
                <View style={[styles.miniStatBadge, { backgroundColor: "rgba(0,166,81,0.3)" }]}>
                  <Feather name="check-circle" size={12} color="#6EE7A0" />
                  <ThemedText type="small" style={[styles.miniStatText, { marginLeft: 4 }]}>{stats?.integrity?.valid ?? 0}</ThemedText>
                </View>
                <View style={[styles.miniStatBadge, { backgroundColor: "rgba(220,53,69,0.3)" }]}>
                  <Feather name="alert-triangle" size={12} color="#FCA5A5" />
                  <ThemedText type="small" style={[styles.miniStatText, { marginLeft: 4 }]}>{stats?.integrity?.broken ?? 0}</ThemedText>
                </View>
                <View style={[styles.miniStatBadge, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
                  <Feather name="minus-circle" size={12} color="rgba(255,255,255,0.7)" />
                  <ThemedText type="small" style={[styles.miniStatText, { marginLeft: 4 }]}>{stats?.integrity?.notSigned ?? 0}</ThemedText>
                </View>
              </View>
            </View>
          )}
        </LinearGradient>

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          <Pressable onPress={openCreateModal} style={({ pressed }) => [styles.actionBtn, pressed ? { opacity: 0.85 } : null]}>
            <LinearGradient colors={["#00A651", "#00C464"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.actionBtnGradient}>
              <Feather name="plus-circle" size={18} color="#FFFFFF" />
              <ThemedText type="small" style={styles.actionBtnText}>Nuovo Volontario</ThemedText>
            </LinearGradient>
          </Pressable>
          <Pressable
            onPress={handleBulkSign}
            disabled={bulkSignMutation.isPending}
            style={({ pressed }) => [styles.actionBtn, pressed ? { opacity: 0.85 } : null]}
          >
            <LinearGradient colors={["#0066CC", "#0080E0"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.actionBtnGradient}>
              {bulkSignMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Feather name="edit-3" size={18} color="#FFFFFF" />
              )}
              <ThemedText type="small" style={styles.actionBtnText}>Firma Massiva</ThemedText>
            </LinearGradient>
          </Pressable>
          <Pressable onPress={handleDownloadFullPdf} style={({ pressed }) => [styles.actionBtn, pressed ? { opacity: 0.85 } : null]}>
            <LinearGradient colors={isDark ? ["#1a3a5c", "#122a4a"] : ["#E9ECEF", "#DEE2E6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.actionBtnGradient}>
              <Feather name="download" size={18} color={isDark ? "#FFFFFF" : "#212529"} />
              <ThemedText type="small" style={[styles.actionBtnText, { color: isDark ? "#FFFFFF" : "#212529" }]}>Esporta PDF</ThemedText>
            </LinearGradient>
          </Pressable>
        </View>

        {/* Volunteer List */}
        <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>Elenco Volontari</ThemedText>

        {isLoading ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: Spacing.xl }} />
        ) : !volunteers || volunteers.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: isDark ? "rgba(0,102,204,0.15)" : "rgba(0,102,204,0.1)" }]}>
              <Feather name="users" size={32} color={theme.primary} />
            </View>
            <ThemedText type="h3" style={styles.emptyTitle}>Nessun volontario</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center", maxWidth: 280 }}>
              Aggiungi il primo volontario al registro premendo il pulsante sopra.
            </ThemedText>
          </View>
        ) : (
          volunteers.map((v) => {
            const isExpanded = expandedId === v.id;
            const statusConf = STATUS_CONFIG[v.status];
            const typeConf = TYPE_CONFIG[v.volunteerType];
            return (
              <Card key={v.id} style={[styles.volunteerCard, { marginBottom: Spacing.sm }]}>
                <Pressable
                  onPress={() => {
                    setExpandedId(isExpanded ? null : v.id);
                    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <View style={[styles.progressBadge, { backgroundColor: theme.primaryLight }]}>
                        <ThemedText type="small" style={{ color: theme.primary, fontWeight: "700" }}>#{v.progressiveNumber}</ThemedText>
                      </View>
                      <View style={{ marginLeft: Spacing.sm, flex: 1 }}>
                        <ThemedText type="body" style={{ fontWeight: "600" }}>{v.lastName} {v.firstName}</ThemedText>
                        <View style={styles.badgesRow}>
                          <View style={[styles.badge, { backgroundColor: typeConf.color + "20" }]}>
                            <ThemedText type="small" style={{ color: typeConf.color, fontWeight: "600", fontSize: 11 }}>{typeConf.label}</ThemedText>
                          </View>
                          <View style={[styles.badge, { backgroundColor: statusConf.color + "20" }]}>
                            <ThemedText type="small" style={{ color: statusConf.color, fontWeight: "600", fontSize: 11 }}>{statusConf.label}</ThemedText>
                          </View>
                        </View>
                      </View>
                    </View>
                    <View style={styles.cardHeaderRight}>
                      <IntegrityIcon status={v.integrityStatus} />
                      <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color={theme.textSecondary} style={{ marginLeft: Spacing.xs }} />
                    </View>
                  </View>
                </Pressable>

                {isExpanded ? (
                  <View style={[styles.expandedContent, { borderTopColor: theme.border }]}>
                    <View style={styles.expandedInfo}>
                      {v.fiscalCode ? (
                        <View style={styles.infoRow}>
                          <Feather name="hash" size={13} color={theme.textSecondary} />
                          <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 6 }}>CF: {v.fiscalCode}</ThemedText>
                        </View>
                      ) : null}
                      {v.phone ? (
                        <View style={styles.infoRow}>
                          <Feather name="phone" size={13} color={theme.textSecondary} />
                          <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 6 }}>{v.phone}</ThemedText>
                        </View>
                      ) : null}
                      {v.email ? (
                        <View style={styles.infoRow}>
                          <Feather name="mail" size={13} color={theme.textSecondary} />
                          <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 6 }}>{v.email}</ThemedText>
                        </View>
                      ) : null}
                      <View style={styles.infoRow}>
                        <Feather name="calendar" size={13} color={theme.textSecondary} />
                        <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 6 }}>Inizio: {formatDate(v.startDate)}</ThemedText>
                      </View>
                    </View>
                    <View style={styles.expandedActions}>
                      <Pressable onPress={() => openDetail(v)} style={[styles.actionIcon, { backgroundColor: theme.primaryLight }]}>
                        <Feather name="eye" size={16} color={theme.primary} />
                      </Pressable>
                      <Pressable onPress={() => openEditModal(v)} style={[styles.actionIcon, { backgroundColor: theme.primaryLight }]}>
                        <Feather name="edit-2" size={16} color={theme.primary} />
                      </Pressable>
                      <Pressable onPress={() => signMutation.mutate(v.id)} style={[styles.actionIcon, { backgroundColor: theme.successLight }]}>
                        <Feather name="edit-3" size={16} color={theme.success} />
                      </Pressable>
                      <Pressable onPress={() => handleVerify(v.id)} style={[styles.actionIcon, { backgroundColor: theme.warningLight }]}>
                        <Feather name="shield" size={16} color="#FFC107" />
                      </Pressable>
                      <Pressable onPress={() => handleDownloadPdf(v.id)} style={[styles.actionIcon, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" }]}>
                        <Feather name="download" size={16} color={theme.text} />
                      </Pressable>
                      <Pressable onPress={() => handleDelete(v.id, `${v.lastName} ${v.firstName}`)} style={[styles.actionIcon, { backgroundColor: theme.errorLight }]}>
                        <Feather name="trash-2" size={16} color={theme.error} />
                      </Pressable>
                    </View>
                  </View>
                ) : null}
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Create/Edit Modal */}
      <Modal visible={formModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setFormModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => { setFormModalVisible(false); resetForm(); }} hitSlop={12}>
              <ThemedText type="body" style={{ color: theme.primary }}>Annulla</ThemedText>
            </Pressable>
            <ThemedText type="h3">{editingId ? "Modifica Volontario" : "Nuovo Volontario"}</ThemedText>
            <Pressable onPress={handleSubmit} disabled={isMutating} hitSlop={12}>
              {isMutating ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <ThemedText type="body" style={{ color: theme.primary, fontWeight: "700" }}>Salva</ThemedText>
              )}
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <ThemedText type="label" style={[styles.sectionTitle, { color: theme.primary }]}>DATI PERSONALI</ThemedText>
            {renderFormField("NOME", "firstName", "Nome", true)}
            {renderFormField("COGNOME", "lastName", "Cognome", true)}
            {renderFormField("CODICE FISCALE", "fiscalCode", "RSSMRA85A01H501Z")}
            {renderFormField("DATA DI NASCITA", "birthDate", "AAAA-MM-GG")}
            {renderFormField("LUOGO DI NASCITA", "birthPlace", "Città")}
            <View style={styles.formGroup}>
              <ThemedText type="label" style={[styles.formLabel, { color: theme.textSecondary }]}>GENERE</ThemedText>
              <View style={styles.genderRow}>
                {["M", "F", "Altro"].map((g) => (
                  <Pressable
                    key={g}
                    onPress={() => { updateField("gender", g); if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                    style={[styles.genderBtn, { backgroundColor: form.gender === g ? theme.primary + "20" : theme.inputBackground, borderColor: form.gender === g ? theme.primary : theme.border }]}
                  >
                    <ThemedText type="small" style={{ color: form.gender === g ? theme.primary : theme.text, fontWeight: form.gender === g ? "700" : "400" }}>{g}</ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            <ThemedText type="label" style={[styles.sectionTitle, { color: theme.primary }]}>RESIDENZA</ThemedText>
            {renderFormField("INDIRIZZO", "residenceAddress", "Via/Piazza...")}
            {renderFormField("CITTA", "residenceCity", "Città")}
            {renderFormField("PROVINCIA", "residenceProvince", "XX")}
            {renderFormField("CAP", "residencePostalCode", "00000")}

            <ThemedText type="label" style={[styles.sectionTitle, { color: theme.primary }]}>CONTATTI</ThemedText>
            {renderFormField("TELEFONO", "phone", "+39...")}
            {renderFormField("EMAIL", "email", "email@esempio.it")}

            <ThemedText type="label" style={[styles.sectionTitle, { color: theme.primary }]}>CONTATTO EMERGENZA</ThemedText>
            {renderFormField("NOME CONTATTO", "emergencyContactName", "Nome e cognome")}
            {renderFormField("TELEFONO EMERGENZA", "emergencyContactPhone", "+39...")}
            {renderFormField("RELAZIONE", "emergencyContactRelation", "Es: Coniuge, Genitore...")}

            <ThemedText type="label" style={[styles.sectionTitle, { color: theme.primary }]}>TIPO VOLONTARIO</ThemedText>
            <View style={styles.formGroup}>
              <View style={styles.typeSelector}>
                {(["continuativo", "occasionale"] as VolunteerType[]).map((t) => {
                  const conf = TYPE_CONFIG[t];
                  const isSelected = form.volunteerType === t;
                  return (
                    <Pressable
                      key={t}
                      onPress={() => { updateField("volunteerType", t); if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                      style={[styles.typeButton, { backgroundColor: isSelected ? conf.color + "20" : theme.inputBackground, borderColor: isSelected ? conf.color : theme.border, borderWidth: isSelected ? 2 : 1 }]}
                    >
                      <ThemedText type="small" style={{ color: isSelected ? conf.color : theme.text, fontWeight: isSelected ? "700" : "500" }}>{conf.label}</ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            {renderFormField("DATA INIZIO", "startDate", "AAAA-MM-GG", true)}
            {renderFormField("RUOLO", "role", "Es: Soccorritore, Autista...")}
            {renderFormField("QUALIFICHE", "qualifications", "Es: BLS-D, TSSA...")}

            <ThemedText type="label" style={[styles.sectionTitle, { color: theme.primary }]}>ASSICURAZIONE</ThemedText>
            {renderFormField("NUMERO POLIZZA", "insurancePolicyNumber", "Numero polizza assicurativa")}

            <ThemedText type="label" style={[styles.sectionTitle, { color: theme.primary }]}>NOTE</ThemedText>
            {renderFormField("NOTE", "notes", "Note aggiuntive...", false, true)}

            <View style={{ height: Spacing.xl }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Detail Modal */}
      <Modal visible={detailModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDetailModalVisible(false)}>
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setDetailModalVisible(false)} hitSlop={12}>
              <ThemedText type="body" style={{ color: theme.primary }}>Chiudi</ThemedText>
            </Pressable>
            <ThemedText type="h3">Dettaglio Volontario</ThemedText>
            <View style={{ width: 50 }} />
          </View>
          {selectedEntry ? (
            <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.detailHeader}>
                <View style={[styles.progressBadgeLarge, { backgroundColor: theme.primaryLight }]}>
                  <ThemedText type="h2" style={{ color: theme.primary }}>#{selectedEntry.progressiveNumber}</ThemedText>
                </View>
                <ThemedText type="h2" style={{ marginTop: Spacing.sm }}>{selectedEntry.lastName} {selectedEntry.firstName}</ThemedText>
                <View style={styles.badgesRow}>
                  <View style={[styles.badge, { backgroundColor: TYPE_CONFIG[selectedEntry.volunteerType].color + "20" }]}>
                    <ThemedText type="small" style={{ color: TYPE_CONFIG[selectedEntry.volunteerType].color, fontWeight: "600" }}>{TYPE_CONFIG[selectedEntry.volunteerType].label}</ThemedText>
                  </View>
                  <View style={[styles.badge, { backgroundColor: STATUS_CONFIG[selectedEntry.status].color + "20" }]}>
                    <ThemedText type="small" style={{ color: STATUS_CONFIG[selectedEntry.status].color, fontWeight: "600" }}>{STATUS_CONFIG[selectedEntry.status].label}</ThemedText>
                  </View>
                </View>
              </View>

              {/* Integrity Status */}
              <View style={[styles.integrityCard, {
                backgroundColor: selectedEntry.integrityStatus === "VALID" ? theme.successLight
                  : selectedEntry.integrityStatus === "BROKEN" ? theme.errorLight
                  : isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                borderColor: selectedEntry.integrityStatus === "VALID" ? theme.success
                  : selectedEntry.integrityStatus === "BROKEN" ? theme.error
                  : theme.border,
              }]}>
                <IntegrityIcon status={selectedEntry.integrityStatus} size={22} />
                <View style={{ marginLeft: Spacing.sm, flex: 1 }}>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>
                    {selectedEntry.integrityStatus === "VALID" ? "Integrita verificata" : selectedEntry.integrityStatus === "BROKEN" ? "Integrita compromessa" : "Non firmato"}
                  </ThemedText>
                  {selectedEntry.integritySignedAt ? (
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>Firmato il {formatDate(selectedEntry.integritySignedAt)}</ThemedText>
                  ) : null}
                </View>
              </View>

              {/* Detail Actions */}
              <View style={styles.detailActions}>
                <Pressable onPress={() => { setDetailModalVisible(false); openEditModal(selectedEntry); }} style={[styles.detailActionBtn, { backgroundColor: theme.primaryLight }]}>
                  <Feather name="edit-2" size={16} color={theme.primary} />
                  <ThemedText type="small" style={{ color: theme.primary, marginLeft: 6, fontWeight: "600" }}>Modifica</ThemedText>
                </Pressable>
                <Pressable onPress={() => signMutation.mutate(selectedEntry.id)} style={[styles.detailActionBtn, { backgroundColor: theme.successLight }]}>
                  <Feather name="edit-3" size={16} color={theme.success} />
                  <ThemedText type="small" style={{ color: theme.success, marginLeft: 6, fontWeight: "600" }}>Firma</ThemedText>
                </Pressable>
                <Pressable onPress={() => handleVerify(selectedEntry.id)} style={[styles.detailActionBtn, { backgroundColor: theme.warningLight }]}>
                  <Feather name="shield" size={16} color="#FFC107" />
                  <ThemedText type="small" style={{ color: "#FFC107", marginLeft: 6, fontWeight: "600" }}>Verifica</ThemedText>
                </Pressable>
                <Pressable onPress={() => handleDownloadPdf(selectedEntry.id)} style={[styles.detailActionBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" }]}>
                  <Feather name="download" size={16} color={theme.text} />
                  <ThemedText type="small" style={{ color: theme.text, marginLeft: 6, fontWeight: "600" }}>PDF</ThemedText>
                </Pressable>
              </View>

              <ThemedText type="label" style={[styles.sectionTitle, { color: theme.primary }]}>DATI PERSONALI</ThemedText>
              {renderDetailRow("Codice Fiscale", selectedEntry.fiscalCode)}
              {renderDetailRow("Data di nascita", formatDate(selectedEntry.birthDate))}
              {renderDetailRow("Luogo di nascita", selectedEntry.birthPlace)}
              {renderDetailRow("Genere", selectedEntry.gender)}

              <ThemedText type="label" style={[styles.sectionTitle, { color: theme.primary }]}>RESIDENZA</ThemedText>
              {renderDetailRow("Indirizzo", selectedEntry.residenceAddress)}
              {renderDetailRow("Citta", selectedEntry.residenceCity)}
              {renderDetailRow("Provincia", selectedEntry.residenceProvince)}
              {renderDetailRow("CAP", selectedEntry.residencePostalCode)}

              <ThemedText type="label" style={[styles.sectionTitle, { color: theme.primary }]}>CONTATTI</ThemedText>
              {renderDetailRow("Telefono", selectedEntry.phone)}
              {renderDetailRow("Email", selectedEntry.email)}

              <ThemedText type="label" style={[styles.sectionTitle, { color: theme.primary }]}>CONTATTO EMERGENZA</ThemedText>
              {renderDetailRow("Nome", selectedEntry.emergencyContactName)}
              {renderDetailRow("Telefono", selectedEntry.emergencyContactPhone)}
              {renderDetailRow("Relazione", selectedEntry.emergencyContactRelation)}

              <ThemedText type="label" style={[styles.sectionTitle, { color: theme.primary }]}>SERVIZIO</ThemedText>
              {renderDetailRow("Data inizio", formatDate(selectedEntry.startDate))}
              {renderDetailRow("Data fine", formatDate(selectedEntry.endDate))}
              {renderDetailRow("Motivo cessazione", selectedEntry.endReason)}
              {renderDetailRow("Ruolo", selectedEntry.role)}
              {renderDetailRow("Qualifiche", selectedEntry.qualifications)}

              <ThemedText type="label" style={[styles.sectionTitle, { color: theme.primary }]}>ASSICURAZIONE</ThemedText>
              {renderDetailRow("Polizza", selectedEntry.insurancePolicyNumber)}
              {renderDetailRow("Notificata", selectedEntry.insuranceNotified ? "Si" : "No")}

              {selectedEntry.notes ? (
                <View>
                  <ThemedText type="label" style={[styles.sectionTitle, { color: theme.primary }]}>NOTE</ThemedText>
                  <ThemedText type="body" style={{ marginBottom: Spacing.lg }}>{selectedEntry.notes}</ThemedText>
                </View>
              ) : null}

              <View style={{ height: Spacing.xl }} />
            </ScrollView>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statsCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  statsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  statsHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  statsTitle: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: Spacing.sm,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
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
  statsRowSecondary: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  miniStatBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  miniStatText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 11,
  },
  actionsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  actionBtn: {
    flex: 1,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  actionBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    gap: 6,
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 11,
  },
  volunteerCard: {
    padding: Spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  cardHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  progressBadge: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  progressBadgeLarge: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  badgesRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 4,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  expandedContent: {
    borderTopWidth: 1,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
  },
  expandedInfo: {
    gap: 6,
    marginBottom: Spacing.md,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  expandedActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl * 2,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    marginBottom: Spacing.sm,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  modalContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl * 2,
  },
  sectionTitle: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    fontWeight: "700",
    letterSpacing: 1,
  },
  formGroup: {
    marginBottom: Spacing.md,
  },
  formLabel: {
    marginBottom: Spacing.xs,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: 15,
  },
  textArea: {
    minHeight: 80,
  },
  genderRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  genderBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  typeSelector: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  typeButton: {
    flex: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  detailHeader: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  integrityCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  detailActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  detailActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  detailRow: {
    flexDirection: "row",
    paddingVertical: Spacing.xs,
    alignItems: "flex-start",
  },
});
