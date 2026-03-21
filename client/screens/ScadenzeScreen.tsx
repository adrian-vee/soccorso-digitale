import React, { useState, useMemo, useLayoutEffect } from "react";
import { View, StyleSheet, FlatList, Pressable, ActivityIndicator, Alert, TextInput, Platform, Modal, KeyboardAvoidingView, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface ChecklistTemplateItem {
  id: string;
  label: string;
  category: string;
  subZone: string | null;
  description: string | null;
  quantity: number;
  isRequired: boolean;
  sortOrder: number;
  isActive: boolean;
  hasExpiry: boolean;
  expiryDate: string | null;
  expiryAlertDays: number;
  zoneColor: string;
}

interface ExpiryItem {
  id: string;
  label: string;
  category: string;
  subZone: string | null;
  quantity: number;
  expiryDate: string | null;
  expiryAlertDays: number;
  zoneColor: string;
  status: "ok" | "expiring" | "expired" | "no_date";
  checked: boolean;
}

interface ScadenzeReport {
  id: string;
  vehicleId: string;
  reportMonth: number;
  reportYear: number;
  completedAt: string;
  totalItemsChecked: number;
  expiredItemsCount: number;
  expiringItemsCount: number;
}

interface MaterialRestoration {
  id: string;
  itemId: string;
  itemLabel: string;
  vehicleId: string;
  vehicleCode: string;
  oldExpiryDate: string | null;
  newExpiryDate: string;
  restoredByName: string;
  notes: string | null;
  createdAt: string;
}

const ZONES = [
  { id: "materiale_zaino", name: "Materiale Zaino", icon: "briefcase", color: "#00A651" },
  { id: "materiale_ambulanza", name: "Materiale Ambulanza", icon: "truck", color: "#0066CC" },
  { id: "materiale_vario", name: "Materiale Vario", icon: "package", color: "#CC0000" },
];

const getZoneId = (category: string): string => {
  const normalized = category.toLowerCase().replace(/\s+/g, "_");
  if (normalized.includes("zaino")) return "materiale_zaino";
  if (normalized.includes("ambulanza")) return "materiale_ambulanza";
  return "materiale_vario";
};

export default function ScadenzeScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<any>();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const selectedVehicle = user?.vehicle || null;
  
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");
  const [submitterName, setSubmitterName] = useState("");
  const [correctionModalVisible, setCorrectionModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ExpiryItem | null>(null);
  const [correctionDate, setCorrectionDate] = useState("");
  const [correctionNotes, setCorrectionNotes] = useState("");
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set(ZONES.map(z => z.id)));
  const [actionType, setActionType] = useState<"ripristinato" | "scaduto" | "aggiorna_data" | null>(null);

  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
  
  const monthNames = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", 
                      "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

  const { data: existingReport, isLoading: loadingReport } = useQuery<ScadenzeReport | null>({
    queryKey: [`/api/scadenze/current?vehicleId=${selectedVehicle?.id}&month=${currentMonth}&year=${currentYear}`],
    enabled: !!selectedVehicle?.id,
  });

  const { data: checklistData, isLoading: loadingChecklist } = useQuery<{ items: ChecklistTemplateItem[] }>({
    queryKey: [`/api/vehicles/${selectedVehicle?.id}/checklist-items`],
    enabled: !!selectedVehicle?.id,
  });

  const { data: restorations } = useQuery<MaterialRestoration[]>({
    queryKey: [`/api/vehicles/${selectedVehicle?.id}/material-restorations`],
    enabled: !!selectedVehicle?.id,
  });

  const recentRestorations = useMemo(() => {
    if (!restorations) return [];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return restorations.filter(r => new Date(r.createdAt) >= thirtyDaysAgo);
  }, [restorations]);

  const expiryItems = useMemo(() => {
    if (!checklistData?.items) return [];
    
    const today = new Date();
    const items: ExpiryItem[] = checklistData.items
      .filter(item => item.hasExpiry && item.isActive)
      .map(item => {
        let status: "ok" | "expiring" | "expired" | "no_date" = "no_date";
        if (item.expiryDate) {
          const expiry = new Date(item.expiryDate);
          const alertDaysMs = (item.expiryAlertDays || 30) * 24 * 60 * 60 * 1000;
          const alertDate = new Date(today.getTime() + alertDaysMs);
          
          if (expiry < today) {
            status = "expired";
          } else if (expiry <= alertDate) {
            status = "expiring";
          } else {
            status = "ok";
          }
        }
        return {
          id: item.id,
          label: item.label,
          category: item.category,
          subZone: item.subZone,
          quantity: item.quantity,
          expiryDate: item.expiryDate,
          expiryAlertDays: item.expiryAlertDays,
          zoneColor: item.zoneColor,
          status,
          checked: checkedItems.has(item.id),
        };
      });

    return items.sort((a, b) => {
      const statusOrder = { expired: 0, expiring: 1, no_date: 2, ok: 3 };
      return statusOrder[a.status] - statusOrder[b.status];
    });
  }, [checklistData, checkedItems]);

  const itemsByZone = useMemo(() => {
    const grouped: Record<string, Record<string, ExpiryItem[]>> = {};
    expiryItems.forEach(item => {
      const zoneId = getZoneId(item.category);
      const subZoneKey = item.subZone || "_main";
      if (!grouped[zoneId]) grouped[zoneId] = {};
      if (!grouped[zoneId][subZoneKey]) grouped[zoneId][subZoneKey] = [];
      grouped[zoneId][subZoneKey].push(item);
    });
    return grouped;
  }, [expiryItems]);

  const stats = useMemo(() => {
    const expired = expiryItems.filter(i => i.status === "expired").length;
    const expiring = expiryItems.filter(i => i.status === "expiring").length;
    const noDate = expiryItems.filter(i => i.status === "no_date").length;
    const ok = expiryItems.filter(i => i.status === "ok").length;
    const checked = checkedItems.size;
    return { expired, expiring, noDate, ok, checked, total: expiryItems.length };
  }, [expiryItems, checkedItems]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/scadenze", {
        vehicleId: selectedVehicle?.id,
        locationId: user?.location?.id,
        submittedByName: submitterName,
        reportMonth: currentMonth,
        reportYear: currentYear,
        totalItemsChecked: expiryItems.length,
        expiredItemsCount: stats.expired,
        expiringItemsCount: stats.expiring,
        items: expiryItems.map(i => ({
          itemId: i.id,
          itemName: i.label,
          quantity: i.quantity,
          expiryDate: i.expiryDate,
          status: i.status,
        })),
        notes,
      });
    },
    onSuccess: async () => {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      await queryClient.invalidateQueries({ 
        queryKey: [`/api/scadenze/current?vehicleId=${selectedVehicle?.id}&month=${currentMonth}&year=${currentYear}`],
        refetchType: 'active'
      });
      await queryClient.refetchQueries({
        queryKey: [`/api/scadenze/current?vehicleId=${selectedVehicle?.id}&month=${currentMonth}&year=${currentYear}`]
      });
    },
    onError: () => {
      Alert.alert("Errore", "Impossibile inviare le scadenze. Riprova.");
    },
  });

  const updateDateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedItem || !correctionDate) throw new Error("No item or date");
      return apiRequest("POST", `/api/checklist-templates/${selectedItem.id}/update-expiry`, {
        expiryDate: correctionDate,
        updatedBy: submitterName || user?.name || "Equipaggio",
        notes: actionType === "ripristinato" ? "Materiale ripristinato" : "Data aggiornata",
      });
    },
    onSuccess: async () => {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setCorrectionModalVisible(false);
      setSelectedItem(null);
      setCorrectionDate("");
      setCorrectionNotes("");
      setActionType(null);
      await queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${selectedVehicle?.id}/checklist-items`] });
      Alert.alert(
        actionType === "ripristinato" ? "Ripristino Confermato" : "Data Aggiornata", 
        actionType === "ripristinato" 
          ? "Il materiale è stato ripristinato con la nuova data di scadenza." 
          : "La data di scadenza è stata aggiornata con successo.", 
        [{ text: "OK" }]
      );
    },
    onError: () => {
      Alert.alert("Errore", "Impossibile aggiornare la data. Riprova.");
    },
  });

  const correctionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedItem) throw new Error("No item selected");
      return apiRequest("POST", "/api/expiry-corrections", {
        checklistItemId: selectedItem.id,
        vehicleId: selectedVehicle?.id,
        requestedByName: submitterName || user?.name || "Equipaggio",
        currentExpiryDate: selectedItem.expiryDate,
        proposedExpiryDate: null,
        notes: correctionNotes || "Data di scadenza mancante o non leggibile",
      });
    },
    onSuccess: () => {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setCorrectionModalVisible(false);
      setSelectedItem(null);
      setCorrectionDate("");
      setCorrectionNotes("");
      Alert.alert("Segnalazione Inviata", "Il coordinatore riceverà la tua segnalazione e verificherà la data di scadenza.", [{ text: "OK" }]);
    },
    onError: () => {
      Alert.alert("Errore", "Impossibile inviare la segnalazione. Riprova.");
    },
  });

  const handleToggleItem = (itemId: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setCheckedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleToggleZone = (zoneId: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setExpandedZones(prev => {
      const newSet = new Set(prev);
      if (newSet.has(zoneId)) {
        newSet.delete(zoneId);
      } else {
        newSet.add(zoneId);
      }
      return newSet;
    });
  };

  const handleCheckAllZone = (zoneId: string) => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    const zoneItems = itemsByZone[zoneId] || {};
    const allItemIds: string[] = [];
    Object.values(zoneItems).forEach(subZoneItems => {
      subZoneItems.forEach(item => allItemIds.push(item.id));
    });
    setCheckedItems(prev => {
      const newSet = new Set(prev);
      allItemIds.forEach(id => newSet.add(id));
      return newSet;
    });
  };

  const handleOpenCorrection = (item: ExpiryItem) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setSelectedItem(item);
    setCorrectionDate("");
    setCorrectionNotes("");
    setActionType(null);
    setCorrectionModalVisible(true);
  };

  const markAsExpiredMutation = useMutation({
    mutationFn: async () => {
      if (!selectedItem) throw new Error("No item selected");
      return apiRequest("POST", "/api/expiry-corrections", {
        checklistItemId: selectedItem.id,
        vehicleId: selectedVehicle?.id,
        requestedByName: submitterName || user?.name || "Equipaggio",
        currentExpiryDate: selectedItem.expiryDate,
        proposedExpiryDate: null,
        notes: "MATERIALE SCADUTO - Da sostituire",
        isExpired: true,
      });
    },
    onSuccess: () => {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setCorrectionModalVisible(false);
      setSelectedItem(null);
      setActionType(null);
      Alert.alert("Segnalazione Scaduto", "Il coordinatore è stato avvisato che il materiale è scaduto e deve essere sostituito.", [{ text: "OK" }]);
    },
    onError: () => {
      Alert.alert("Errore", "Impossibile inviare la segnalazione. Riprova.");
    },
  });

  const handleSubmit = () => {
    if (!submitterName.trim()) {
      Alert.alert("Attenzione", "Inserisci il nome dell'operatore");
      return;
    }
    if (checkedItems.size < expiryItems.length) {
      Alert.alert("Attenzione", "Verifica tutti gli articoli prima di inviare");
      return;
    }
    submitMutation.mutate();
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "N/D";
    const date = new Date(dateStr);
    return date.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const getStatusInfo = (status: ExpiryItem["status"]) => {
    switch (status) {
      case "expired":
        return { bg: theme.errorLight, text: theme.error, icon: "alert-circle" as const, label: "Scaduto" };
      case "expiring":
        return { bg: theme.warningLight, text: theme.warning, icon: "alert-triangle" as const, label: "In scadenza" };
      case "no_date":
        return { bg: theme.border, text: theme.textSecondary, icon: "help-circle" as const, label: "Senza data" };
      default:
        return { bg: theme.successLight, text: theme.success, icon: "check-circle" as const, label: "Valido" };
    }
  };

  const isLoading = loadingReport || loadingChecklist;
  const allChecked = checkedItems.size === expiryItems.length && expiryItems.length > 0;

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, { paddingTop: headerHeight }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText type="body" style={{ marginTop: Spacing.md, color: theme.textSecondary }}>
            Caricamento materiali...
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  // Get expired/expiring items even if report was submitted
  const expiredItemsAfterReport = expiryItems.filter(item => item.status === "expired" || item.status === "expiring");

  if (existingReport) {
    return (
      <ThemedView style={[styles.container, { paddingTop: headerHeight + Spacing.lg }]}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingBottom: tabBarHeight + Spacing.xl }}>
          <Card style={styles.headerCard}>
            <View style={[styles.completedBadge, { backgroundColor: theme.successLight }]}>
              <Feather name="check-circle" size={20} color={theme.success} />
              <ThemedText type="body" style={{ color: theme.success, fontWeight: "600", marginLeft: Spacing.sm }}>
                Scadenze Inviate - {monthNames[currentMonth - 1]} {currentYear}
              </ThemedText>
            </View>
            <View style={[styles.statsRow, { marginTop: Spacing.md }]}>
              <View style={[styles.statBox, { backgroundColor: theme.backgroundRoot }]}>
                <ThemedText type="h3" style={{ color: theme.text }}>{existingReport.totalItemsChecked}</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Verificati</ThemedText>
              </View>
              <View style={[styles.statBox, { backgroundColor: theme.errorLight }]}>
                <ThemedText type="h3" style={{ color: theme.error }}>{existingReport.expiredItemsCount}</ThemedText>
                <ThemedText type="small" style={{ color: theme.error }}>Scaduti</ThemedText>
              </View>
              <View style={[styles.statBox, { backgroundColor: theme.warningLight }]}>
                <ThemedText type="h3" style={{ color: theme.warning }}>{existingReport.expiringItemsCount}</ThemedText>
                <ThemedText type="small" style={{ color: theme.warning }}>In scadenza</ThemedText>
              </View>
            </View>
          </Card>

          {/* Show expired/expiring items for update even after submission */}
          {expiredItemsAfterReport.length > 0 && (
            <Card style={[styles.headerCard, { marginTop: Spacing.md }]}>
              <View style={styles.sectionHeaderRow}>
                <Feather name="alert-triangle" size={18} color={theme.error} />
                <ThemedText type="h3" style={{ marginLeft: Spacing.sm }}>Materiali da Ripristinare</ThemedText>
              </View>
              <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
                Tocca un articolo per aggiornare la data di scadenza
              </ThemedText>
              {expiredItemsAfterReport.map((item) => (
                <Pressable
                  key={item.id}
                  style={[styles.expiredItemRow, { borderColor: item.status === "expired" ? theme.error : theme.warning }]}
                  onPress={() => handleOpenCorrection(item)}
                >
                  <View style={[styles.expiredItemIcon, { backgroundColor: item.status === "expired" ? theme.errorLight : theme.warningLight }]}>
                    <Feather name={item.status === "expired" ? "alert-octagon" : "alert-triangle"} size={16} color={item.status === "expired" ? theme.error : theme.warning} />
                  </View>
                  <View style={styles.expiredItemInfo}>
                    <ThemedText type="body" style={{ fontWeight: "600" }}>{item.label}</ThemedText>
                    <ThemedText type="small" style={{ color: item.status === "expired" ? theme.error : theme.warning }}>
                      {item.status === "expired" ? "Scaduto" : "In scadenza"}: {formatDate(item.expiryDate)}
                    </ThemedText>
                  </View>
                  <Feather name="edit-2" size={16} color={theme.primary} />
                </Pressable>
              ))}
            </Card>
          )}

          {expiredItemsAfterReport.length === 0 && (
            <Card style={[styles.headerCard, { marginTop: Spacing.md, alignItems: "center", paddingVertical: Spacing.xl }]}>
              <View style={[styles.completedIcon, { backgroundColor: theme.successLight, width: 60, height: 60, borderRadius: 30 }]}>
                <Feather name="check" size={32} color={theme.success} />
              </View>
              <ThemedText type="body" style={{ color: theme.success, fontWeight: "600", marginTop: Spacing.md }}>
                Tutti i materiali sono in regola
              </ThemedText>
            </Card>
          )}

          {/* Recent Restorations Section */}
          {recentRestorations.length > 0 && (
            <Card style={[styles.headerCard, { marginTop: Spacing.lg }]}>
              <View style={styles.sectionHeaderRow}>
                <View style={[styles.sectionIcon, { backgroundColor: isDark ? "rgba(0,166,81,0.15)" : "#E8F5E9" }]}>
                  <Feather name="refresh-cw" size={16} color="#00A651" />
                </View>
                <ThemedText type="h3" style={{ marginLeft: Spacing.sm }}>Materiali Ripristinati</ThemedText>
                <View style={[styles.badgeSmall, { backgroundColor: "#00A651", marginLeft: Spacing.sm }]}>
                  <ThemedText type="small" style={{ color: "#FFFFFF", fontWeight: "600" }}>{recentRestorations.length}</ThemedText>
                </View>
              </View>
              
              {recentRestorations.map((restoration, index) => {
                const formatDate = (dateStr: string) => {
                  const date = new Date(dateStr);
                  return date.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
                };
                const formatDateTime = (dateStr: string) => {
                  const date = new Date(dateStr);
                  return date.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" }) + " " + 
                         date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
                };
                
                return (
                  <View 
                    key={restoration.id} 
                    style={[
                      styles.restorationRow,
                      { borderColor: "#00A651", backgroundColor: isDark ? "rgba(0,166,81,0.08)" : "#F8FFF8" },
                      index < recentRestorations.length - 1 && { marginBottom: Spacing.sm }
                    ]}
                  >
                    <View style={[styles.restorationIcon, { backgroundColor: isDark ? "rgba(0,166,81,0.15)" : "#E8F5E9" }]}>
                      <Feather name="check-circle" size={18} color="#00A651" />
                    </View>
                    <View style={styles.restorationInfo}>
                      <ThemedText type="body" style={{ fontWeight: "600" }}>{restoration.itemLabel}</ThemedText>
                      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
                        <Feather name="calendar" size={12} color={theme.textSecondary} />
                        <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                          Nuova scadenza: {formatDate(restoration.newExpiryDate)}
                        </ThemedText>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
                        <Feather name="user" size={12} color={theme.textSecondary} />
                        <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                          {restoration.restoredByName} - {formatDateTime(restoration.createdAt)}
                        </ThemedText>
                      </View>
                    </View>
                  </View>
                );
              })}
            </Card>
          )}

          {/* Back to Profile button */}
          <Pressable
            style={[styles.backToProfileButton, { borderColor: theme.primary }]}
            onPress={() => {
              if (Platform.OS !== "web") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              navigation.navigate("Profile");
            }}
          >
            <Feather name="arrow-left" size={18} color={theme.primary} />
            <ThemedText type="body" style={{ color: theme.primary, fontWeight: "600", marginLeft: Spacing.sm }}>
              Torna al Profilo
            </ThemedText>
          </Pressable>
        </ScrollView>

        {/* Modal for updating expiry - same as main view */}
        <Modal
          visible={correctionModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setCorrectionModalVisible(false)}
        >
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
              <Pressable style={styles.modalOverlay} onPress={() => setCorrectionModalVisible(false)}>
                <Pressable style={[styles.modalContent, { backgroundColor: theme.cardBackground }]} onPress={(e) => e.stopPropagation()}>
                  <View style={styles.modalHeader}>
                    <ThemedText type="h3">Aggiorna Materiale</ThemedText>
                    <Pressable onPress={() => setCorrectionModalVisible(false)}>
                      <Feather name="x" size={24} color={theme.text} />
                    </Pressable>
                  </View>

                  {selectedItem && (
                    <>
                      <View style={[styles.modalItem, { backgroundColor: theme.backgroundRoot }]}>
                        <View style={styles.modalItemHeader}>
                          <Feather name="package" size={20} color={theme.primary} />
                          <ThemedText type="body" style={{ fontWeight: "700", marginLeft: Spacing.sm, flex: 1 }}>
                            {selectedItem.label}
                          </ThemedText>
                        </View>
                        <View style={[styles.modalItemStatus, { backgroundColor: selectedItem.status === "expired" ? theme.errorLight : theme.warningLight }]}>
                          <Feather name={selectedItem.status === "expired" ? "alert-circle" : "alert-triangle"} size={12} color={selectedItem.status === "expired" ? theme.error : theme.warning} />
                          <ThemedText type="small" style={{ color: selectedItem.status === "expired" ? theme.error : theme.warning, marginLeft: 4, fontWeight: "600" }}>
                            {selectedItem.status === "expired" ? "Scaduto" : "In scadenza"} - {formatDate(selectedItem.expiryDate)}
                          </ThemedText>
                        </View>
                      </View>

                      <ThemedText type="label" style={{ color: theme.textSecondary, marginTop: Spacing.md, marginBottom: Spacing.xs }}>
                        NUOVA DATA DI SCADENZA
                      </ThemedText>
                      <View style={[styles.inputBox, { borderColor: '#00A651' }]}>
                        <Feather name="calendar" size={16} color="#00A651" />
                        <TextInput
                          style={[styles.textInput, { color: theme.text }]}
                          placeholder="GG/MM/AAAA"
                          placeholderTextColor={theme.textSecondary}
                          value={correctionDate}
                          onChangeText={setCorrectionDate}
                          keyboardType="numbers-and-punctuation"
                          autoFocus
                        />
                      </View>

                      <Pressable
                        style={[styles.submitButton, { backgroundColor: '#00A651', marginTop: Spacing.lg, opacity: correctionDate.trim() ? 1 : 0.5 }]}
                        onPress={() => updateDateMutation.mutate()}
                        disabled={updateDateMutation.isPending || !correctionDate.trim()}
                      >
                        {updateDateMutation.isPending ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Feather name="check-circle" size={18} color="#FFFFFF" />
                            <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600", marginLeft: Spacing.sm }}>
                              Conferma Ripristino
                            </ThemedText>
                          </>
                        )}
                      </Pressable>
                    </>
                  )}
                </Pressable>
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={ZONES}
        keyExtractor={(zone) => zone.id}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.md,
        }}
        ListHeaderComponent={
          <>
            <Card style={styles.headerCard}>
              <View style={styles.headerRow}>
                <View style={[styles.headerIcon, { backgroundColor: theme.errorLight }]}>
                  <Feather name="calendar" size={24} color={theme.error} />
                </View>
                <View style={styles.headerInfo}>
                  <ThemedText type="h3">Scadenze {monthNames[currentMonth - 1]}</ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    Ambulanza {selectedVehicle?.code}
                  </ThemedText>
                </View>
              </View>
              <View style={styles.statsRow}>
                <View style={[styles.statBox, { backgroundColor: theme.errorLight }]}>
                  <ThemedText type="h2" style={{ color: theme.error }}>{stats.expired}</ThemedText>
                  <ThemedText type="small" style={{ color: theme.error }}>Scaduti</ThemedText>
                </View>
                <View style={[styles.statBox, { backgroundColor: theme.warningLight }]}>
                  <ThemedText type="h2" style={{ color: theme.warning }}>{stats.expiring}</ThemedText>
                  <ThemedText type="small" style={{ color: theme.warning }}>In scadenza</ThemedText>
                </View>
                <View style={[styles.statBox, { backgroundColor: theme.successLight }]}>
                  <ThemedText type="h2" style={{ color: theme.success }}>{stats.ok}</ThemedText>
                  <ThemedText type="small" style={{ color: theme.success }}>Validi</ThemedText>
                </View>
              </View>
              <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
                <View 
                  style={[
                    styles.progressFill, 
                    { 
                      backgroundColor: theme.success,
                      width: `${stats.total > 0 ? (stats.checked / stats.total) * 100 : 0}%` 
                    }
                  ]} 
                />
              </View>
              <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.xs }}>
                {stats.checked}/{stats.total} verificati
              </ThemedText>
            </Card>

            <View style={styles.infoBox}>
              <Feather name="info" size={16} color={theme.primary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, flex: 1, marginLeft: Spacing.sm }}>
                Tocca il pulsante di segnalazione per notificare una data di scadenza errata al coordinatore
              </ThemedText>
            </View>
          </>
        }
        renderItem={({ item: zone }) => {
          const zoneData = itemsByZone[zone.id] || {};
          const subZoneKeys = Object.keys(zoneData).sort((a, b) => {
            if (a === "_main") return -1;
            if (b === "_main") return 1;
            return a.localeCompare(b);
          });
          
          if (subZoneKeys.length === 0) return null;
          
          const totalItems = subZoneKeys.reduce((sum, key) => sum + zoneData[key].length, 0);
          const checkedCount = subZoneKeys.reduce((sum, key) => 
            sum + zoneData[key].filter(i => checkedItems.has(i.id)).length, 0);
          const isExpanded = expandedZones.has(zone.id);
          const expiredInZone = subZoneKeys.reduce((sum, key) => 
            sum + zoneData[key].filter(i => i.status === "expired").length, 0);
          const expiringInZone = subZoneKeys.reduce((sum, key) => 
            sum + zoneData[key].filter(i => i.status === "expiring").length, 0);

          return (
            <View style={styles.zoneSection}>
              <Pressable 
                style={[styles.zoneHeader, { backgroundColor: zone.color + "15" }]}
                onPress={() => handleToggleZone(zone.id)}
              >
                <View style={[styles.zoneIconWrapper, { backgroundColor: zone.color + "30" }]}>
                  <Feather name={zone.icon as any} size={20} color={zone.color} />
                </View>
                <View style={styles.zoneInfo}>
                  <ThemedText type="label" style={{ color: zone.color, fontWeight: "700" }}>
                    {zone.name.toUpperCase()}
                  </ThemedText>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      {checkedCount}/{totalItems}
                    </ThemedText>
                    {expiredInZone > 0 && (
                      <View style={[styles.miniBadge, { backgroundColor: theme.errorLight }]}>
                        <ThemedText type="small" style={{ color: theme.error, fontWeight: "600" }}>
                          {expiredInZone} scad.
                        </ThemedText>
                      </View>
                    )}
                    {expiringInZone > 0 && (
                      <View style={[styles.miniBadge, { backgroundColor: theme.warningLight }]}>
                        <ThemedText type="small" style={{ color: theme.warning, fontWeight: "600" }}>
                          {expiringInZone} in sc.
                        </ThemedText>
                      </View>
                    )}
                  </View>
                </View>
                <Pressable
                  style={[styles.zoneOkButton, { backgroundColor: checkedCount === totalItems ? theme.success : zone.color }]}
                  onPress={() => handleCheckAllZone(zone.id)}
                >
                  <Feather name="check-circle" size={14} color="#FFFFFF" />
                  <ThemedText type="small" style={{ color: "#FFFFFF", fontWeight: "700", marginLeft: 4 }}>
                    Tutto OK
                  </ThemedText>
                </Pressable>
                <Feather 
                  name={isExpanded ? "chevron-up" : "chevron-down"} 
                  size={20} 
                  color={theme.textSecondary} 
                  style={{ marginLeft: Spacing.sm }}
                />
              </Pressable>

              {isExpanded && subZoneKeys.map(subZoneKey => {
                const items = zoneData[subZoneKey];
                const subZoneName = subZoneKey === "_main" ? null : subZoneKey;

                return (
                  <View key={subZoneKey}>
                    {subZoneName && (
                      <View style={[styles.subZoneHeader, { borderLeftColor: zone.color }]}>
                        <Feather name="folder" size={12} color={theme.textSecondary} />
                        <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: "600", marginLeft: 6 }}>
                          {subZoneName}
                        </ThemedText>
                      </View>
                    )}
                    <Card style={[styles.itemsCard, subZoneName && { marginLeft: Spacing.md }]}>
                      {items.map((item, idx) => {
                        const statusInfo = getStatusInfo(item.status);
                        const isChecked = checkedItems.has(item.id);
                        
                        return (
                          <React.Fragment key={item.id}>
                            <View style={styles.itemRow}>
                              <Pressable
                                style={styles.itemMain}
                                onPress={() => handleToggleItem(item.id)}
                              >
                                <View style={[
                                  styles.checkbox,
                                  {
                                    backgroundColor: isChecked ? theme.success : "transparent",
                                    borderColor: isChecked ? theme.success : theme.border,
                                  }
                                ]}>
                                  {isChecked && <Feather name="check" size={14} color="#FFFFFF" />}
                                </View>
                                <View style={styles.itemInfo}>
                                  <ThemedText 
                                    type="body" 
                                    style={[
                                      styles.itemName,
                                      isChecked && { color: theme.textSecondary, textDecorationLine: "line-through" }
                                    ]}
                                  >
                                    {item.quantity > 1 ? `${item.quantity}x ` : ""}{item.label}
                                  </ThemedText>
                                  <View style={styles.itemMeta}>
                                    <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                                      <Feather name={statusInfo.icon} size={10} color={statusInfo.text} />
                                      <ThemedText type="small" style={{ color: statusInfo.text, marginLeft: 3, fontWeight: "600", fontSize: 10 }}>
                                        {statusInfo.label}
                                      </ThemedText>
                                    </View>
                                    {item.expiryDate && (
                                      <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.sm }}>
                                        {formatDate(item.expiryDate)}
                                      </ThemedText>
                                    )}
                                  </View>
                                </View>
                              </Pressable>
                              <Pressable
                                style={[styles.reportButton, { backgroundColor: theme.warningLight }]}
                                onPress={() => handleOpenCorrection(item)}
                              >
                                <Feather name="flag" size={14} color={theme.warning} />
                              </Pressable>
                            </View>
                            {idx < items.length - 1 && (
                              <View style={[styles.divider, { backgroundColor: theme.border }]} />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </Card>
                  </View>
                );
              })}
            </View>
          );
        }}
        ListFooterComponent={
          <View style={styles.footer}>
            <Card style={styles.signatureCard}>
              <ThemedText type="body" style={{ fontWeight: "600", marginBottom: Spacing.sm }}>
                Nome Operatore
              </ThemedText>
              <View style={[styles.inputBox, { borderColor: theme.border }]}>
                <Feather name="user" size={16} color={theme.textSecondary} />
                <TextInput
                  style={[styles.textInput, { color: theme.text }]}
                  placeholder="Inserisci nome e cognome..."
                  placeholderTextColor={theme.textSecondary}
                  value={submitterName}
                  onChangeText={setSubmitterName}
                />
              </View>
            </Card>

            <Card style={styles.notesCard}>
              <ThemedText type="body" style={{ fontWeight: "600", marginBottom: Spacing.sm }}>
                Note (opzionale)
              </ThemedText>
              <TextInput
                style={[styles.textArea, { backgroundColor: theme.cardBackground, borderColor: theme.border, color: theme.text }]}
                placeholder="Eventuali segnalazioni..."
                placeholderTextColor={theme.textSecondary}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />
            </Card>

            <Pressable
              style={[
                styles.submitButton,
                { backgroundColor: allChecked && submitterName.trim() ? theme.success : theme.border,
                  opacity: submitMutation.isPending ? 0.6 : 1 },
              ]}
              onPress={handleSubmit}
              disabled={submitMutation.isPending || !allChecked || !submitterName.trim()}
            >
              {submitMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="send" size={18} color="#FFFFFF" />
                  <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600", marginLeft: Spacing.sm }}>
                    Invia Scadenze
                  </ThemedText>
                </>
              )}
            </Pressable>
          </View>
        }
      />

      <Modal
        visible={correctionModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCorrectionModalVisible(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView 
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
              <View style={styles.modalHeader}>
                <ThemedText type="h3">Correggi Data Scadenza</ThemedText>
                <Pressable onPress={() => setCorrectionModalVisible(false)}>
                  <Feather name="x" size={24} color={theme.text} />
                </Pressable>
              </View>

              {selectedItem && (
                <>
                  <View style={[styles.modalItem, { backgroundColor: theme.backgroundRoot }]}>
                    <View style={styles.modalItemHeader}>
                      <Feather name="package" size={20} color={theme.primary} />
                      <ThemedText type="body" style={{ fontWeight: "700", marginLeft: Spacing.sm, flex: 1 }}>
                        {selectedItem.label}
                      </ThemedText>
                    </View>
                    <View style={[styles.modalItemStatus, { backgroundColor: selectedItem.status === "expired" ? theme.errorLight : selectedItem.status === "expiring" ? theme.warningLight : theme.successLight }]}>
                      <Feather 
                        name={selectedItem.status === "expired" ? "alert-circle" : selectedItem.status === "expiring" ? "alert-triangle" : "check-circle"} 
                        size={12} 
                        color={selectedItem.status === "expired" ? theme.error : selectedItem.status === "expiring" ? theme.warning : theme.success} 
                      />
                      <ThemedText type="small" style={{ color: selectedItem.status === "expired" ? theme.error : selectedItem.status === "expiring" ? theme.warning : theme.success, marginLeft: 4, fontWeight: "600" }}>
                        {selectedItem.status === "expired" ? "Scaduto" : selectedItem.status === "expiring" ? "In scadenza" : "Valido"} - {formatDate(selectedItem.expiryDate)}
                      </ThemedText>
                    </View>
                  </View>

                  {!actionType ? (
                    <>
                      <ThemedText type="label" style={{ color: theme.textSecondary, marginTop: Spacing.lg, marginBottom: Spacing.sm, textAlign: "center" }}>
                        SELEZIONA AZIONE
                      </ThemedText>
                      
                      <Pressable
                        style={[styles.actionOptionCard, { borderColor: theme.primary }]}
                        onPress={() => setActionType("aggiorna_data")}
                      >
                        <View style={[styles.actionIconCircle, { backgroundColor: isDark ? "rgba(0,102,204,0.15)" : "#E6F0FF" }]}>
                          <Feather name="calendar" size={24} color={theme.primary} />
                        </View>
                        <View style={styles.actionTextContainer}>
                          <ThemedText type="body" style={{ fontWeight: "700", color: theme.primary }}>
                            Aggiorna Data Scadenza
                          </ThemedText>
                          <ThemedText type="small" style={{ color: theme.textSecondary }}>
                            Inserisci o correggi la data
                          </ThemedText>
                        </View>
                      </Pressable>
                      
                      <Pressable
                        style={[styles.actionOptionCard, { borderColor: '#00A651' }]}
                        onPress={() => setActionType("ripristinato")}
                      >
                        <View style={[styles.actionIconCircle, { backgroundColor: isDark ? "rgba(0,166,81,0.15)" : "#E6F7EE" }]}>
                          <Feather name="refresh-cw" size={24} color="#00A651" />
                        </View>
                        <View style={styles.actionTextContainer}>
                          <ThemedText type="body" style={{ fontWeight: "700", color: '#00A651' }}>
                            Materiale Ripristinato
                          </ThemedText>
                          <ThemedText type="small" style={{ color: theme.textSecondary }}>
                            Ho sostituito con nuovo materiale
                          </ThemedText>
                        </View>
                      </Pressable>

                      <Pressable
                        style={[styles.actionOptionCard, { borderColor: theme.error }]}
                        onPress={() => setActionType("scaduto")}
                      >
                        <View style={[styles.actionIconCircle, { backgroundColor: theme.errorLight }]}>
                          <Feather name="alert-octagon" size={24} color={theme.error} />
                        </View>
                        <View style={styles.actionTextContainer}>
                          <ThemedText type="body" style={{ fontWeight: "700", color: theme.error }}>
                            Segnala Scaduto
                          </ThemedText>
                          <ThemedText type="small" style={{ color: theme.textSecondary }}>
                            Materiale scaduto, avvisa coordinatore
                          </ThemedText>
                        </View>
                      </Pressable>
                    </>
                  ) : actionType === "aggiorna_data" ? (
                    <>
                      <View style={[styles.selectedActionBadge, { backgroundColor: isDark ? "rgba(0,102,204,0.15)" : "#E6F0FF" }]}>
                        <Feather name="calendar" size={14} color={theme.primary} />
                        <ThemedText type="small" style={{ color: theme.primary, fontWeight: "600", marginLeft: 6 }}>
                          Aggiorna Data
                        </ThemedText>
                        <Pressable onPress={() => setActionType(null)} style={{ marginLeft: "auto" }}>
                          <Feather name="x" size={16} color={theme.primary} />
                        </Pressable>
                      </View>

                      <ThemedText type="label" style={{ color: theme.textSecondary, marginTop: Spacing.md, marginBottom: Spacing.xs }}>
                        NUOVA DATA DI SCADENZA
                      </ThemedText>
                      <View style={[styles.inputBox, { borderColor: theme.primary }]}>
                        <Feather name="calendar" size={16} color={theme.primary} />
                        <TextInput
                          style={[styles.textInput, { color: theme.text }]}
                          placeholder="GG/MM/AAAA"
                          placeholderTextColor={theme.textSecondary}
                          value={correctionDate}
                          onChangeText={setCorrectionDate}
                          keyboardType="numbers-and-punctuation"
                          autoFocus
                        />
                      </View>

                      <Pressable
                        style={[styles.submitButton, { backgroundColor: theme.primary, marginTop: Spacing.lg, opacity: correctionDate.trim() ? 1 : 0.5 }]}
                        onPress={() => updateDateMutation.mutate()}
                        disabled={updateDateMutation.isPending || !correctionDate.trim()}
                      >
                        {updateDateMutation.isPending ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Feather name="check" size={18} color="#FFFFFF" />
                            <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600", marginLeft: Spacing.sm }}>
                              Salva Data
                            </ThemedText>
                          </>
                        )}
                      </Pressable>
                    </>
                  ) : actionType === "ripristinato" ? (
                    <>
                      <View style={[styles.selectedActionBadge, { backgroundColor: isDark ? "rgba(0,166,81,0.15)" : "#E6F7EE" }]}>
                        <Feather name="refresh-cw" size={14} color="#00A651" />
                        <ThemedText type="small" style={{ color: '#00A651', fontWeight: "600", marginLeft: 6 }}>
                          Materiale Ripristinato
                        </ThemedText>
                        <Pressable onPress={() => setActionType(null)} style={{ marginLeft: "auto" }}>
                          <Feather name="x" size={16} color="#00A651" />
                        </Pressable>
                      </View>

                      <ThemedText type="label" style={{ color: theme.textSecondary, marginTop: Spacing.md, marginBottom: Spacing.xs }}>
                        DATA SCADENZA NUOVO MATERIALE
                      </ThemedText>
                      <View style={[styles.inputBox, { borderColor: '#00A651' }]}>
                        <Feather name="calendar" size={16} color="#00A651" />
                        <TextInput
                          style={[styles.textInput, { color: theme.text }]}
                          placeholder="GG/MM/AAAA"
                          placeholderTextColor={theme.textSecondary}
                          value={correctionDate}
                          onChangeText={setCorrectionDate}
                          keyboardType="numbers-and-punctuation"
                          autoFocus
                        />
                      </View>

                      <Pressable
                        style={[styles.submitButton, { backgroundColor: '#00A651', marginTop: Spacing.lg, opacity: correctionDate.trim() ? 1 : 0.5 }]}
                        onPress={() => updateDateMutation.mutate()}
                        disabled={updateDateMutation.isPending || !correctionDate.trim()}
                      >
                        {updateDateMutation.isPending ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Feather name="check-circle" size={18} color="#FFFFFF" />
                            <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600", marginLeft: Spacing.sm }}>
                              Conferma Ripristino
                            </ThemedText>
                          </>
                        )}
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <View style={[styles.selectedActionBadge, { backgroundColor: theme.errorLight }]}>
                        <Feather name="alert-octagon" size={14} color={theme.error} />
                        <ThemedText type="small" style={{ color: theme.error, fontWeight: "600", marginLeft: 6 }}>
                          Segnalazione Scaduto
                        </ThemedText>
                        <Pressable onPress={() => setActionType(null)} style={{ marginLeft: "auto" }}>
                          <Feather name="x" size={16} color={theme.error} />
                        </Pressable>
                      </View>

                      <View style={[styles.warningBox, { backgroundColor: theme.errorLight, borderColor: theme.error }]}>
                        <Feather name="alert-triangle" size={16} color={theme.error} />
                        <ThemedText type="small" style={{ color: theme.error, marginLeft: Spacing.sm, flex: 1 }}>
                          Il coordinatore verrà avvisato e provvederà alla sostituzione del materiale sanitario.
                        </ThemedText>
                      </View>

                      <Pressable
                        style={[styles.submitButton, { backgroundColor: theme.error, marginTop: Spacing.lg }]}
                        onPress={() => markAsExpiredMutation.mutate()}
                        disabled={markAsExpiredMutation.isPending}
                      >
                        {markAsExpiredMutation.isPending ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Feather name="flag" size={18} color="#FFFFFF" />
                            <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600", marginLeft: Spacing.sm }}>
                              Segnala al Coordinatore
                            </ThemedText>
                          </>
                        )}
                      </Pressable>
                    </>
                  )}
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
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  completedContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: Spacing.xl },
  completedIcon: { width: 120, height: 120, borderRadius: 60, justifyContent: "center", alignItems: "center", marginBottom: Spacing.xl },
  completedTitle: { marginBottom: Spacing.md, textAlign: "center" },
  completedSubtitle: { textAlign: "center", marginBottom: Spacing.lg },
  nextDate: { fontWeight: "700", fontSize: 16 },
  summaryCard: { padding: Spacing.lg, marginTop: Spacing.lg, width: "100%" },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: Spacing.sm },
  headerCard: { padding: Spacing.lg, marginBottom: Spacing.md },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.lg },
  headerIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center" },
  headerInfo: { marginLeft: Spacing.md, flex: 1 },
  statsRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.md },
  statBox: { flex: 1, padding: Spacing.md, borderRadius: BorderRadius.md, alignItems: "center" },
  progressBar: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4 },
  infoBox: { flexDirection: "row", alignItems: "center", padding: Spacing.md, marginBottom: Spacing.md },
  zoneSection: { marginBottom: Spacing.md },
  zoneHeader: { flexDirection: "row", alignItems: "center", padding: Spacing.sm, borderRadius: BorderRadius.md, marginBottom: Spacing.sm },
  zoneIconWrapper: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  zoneInfo: { flex: 1, marginLeft: Spacing.sm },
  zoneOkButton: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.sm },
  miniBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  subZoneHeader: { flexDirection: "row", alignItems: "center", paddingLeft: Spacing.md, paddingVertical: Spacing.sm, marginTop: Spacing.xs, borderLeftWidth: 3, marginLeft: Spacing.xs },
  itemsCard: { padding: 0, overflow: "hidden" },
  itemRow: { flexDirection: "row", alignItems: "center" },
  itemMain: { flex: 1, flexDirection: "row", alignItems: "center", padding: Spacing.md },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, justifyContent: "center", alignItems: "center" },
  itemInfo: { flex: 1, marginLeft: Spacing.md },
  itemName: { fontWeight: "500" },
  itemMeta: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  statusBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  reportButton: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center", marginRight: Spacing.sm },
  divider: { height: 1, marginLeft: 56 },
  footer: { marginTop: Spacing.lg },
  signatureCard: { padding: Spacing.lg, marginBottom: Spacing.md },
  inputBox: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  textInput: { flex: 1, marginLeft: Spacing.sm, fontSize: 16 },
  notesCard: { padding: Spacing.lg, marginBottom: Spacing.lg },
  textArea: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: 14, minHeight: 80, textAlignVertical: "top" },
  submitButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: Spacing.lg, borderRadius: BorderRadius.lg, marginBottom: Spacing.xl },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalScrollContent: { flexGrow: 1, justifyContent: "flex-end" },
  modalDivider: { height: 1, marginVertical: Spacing.lg },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg, paddingBottom: Spacing.xl + 20 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.lg },
  modalItem: { padding: Spacing.md, borderRadius: BorderRadius.md },
  modalItemHeader: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.sm },
  modalItemStatus: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.full },
  actionOptionCard: { flexDirection: "row", alignItems: "center", padding: Spacing.lg, borderRadius: BorderRadius.lg, borderWidth: 2, marginBottom: Spacing.md },
  actionIconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  actionTextContainer: { marginLeft: Spacing.md, flex: 1 },
  selectedActionBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, marginTop: Spacing.md },
  warningBox: { flexDirection: "row", alignItems: "flex-start", padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginTop: Spacing.md },
  completedBadge: { flexDirection: "row", alignItems: "center", padding: Spacing.sm, borderRadius: BorderRadius.md },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.sm },
  expiredItemRow: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderWidth: 1, borderRadius: BorderRadius.md, marginBottom: Spacing.sm },
  expiredItemIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  expiredItemInfo: { flex: 1, marginLeft: Spacing.md },
  backToProfileButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1.5, marginTop: Spacing.xl },
  sectionIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  badgeSmall: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  restorationRow: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderWidth: 1, borderRadius: BorderRadius.md, marginTop: Spacing.sm },
  restorationIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  restorationInfo: { flex: 1, marginLeft: Spacing.md },
});
