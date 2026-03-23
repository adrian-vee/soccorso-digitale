import React, { useState, useMemo } from "react";
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, TextInput, Platform, Modal, KeyboardAvoidingView } from "react-native";
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
  expiryDate: string | null;
  expiryAlertDays: number;
  hasExpiry: boolean;
  isActive: boolean;
}

interface ExpiryItem {
  id: string;
  label: string;
  category: string;
  expiryDate: string | null;
  status: "expired" | "expiring";
}

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return "Nessuna data";
  const date = new Date(dateStr);
  return date.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
};

export default function MaterialiScadutiScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const selectedVehicle = user?.vehicle || null;

  const [correctionModalVisible, setCorrectionModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ExpiryItem | null>(null);
  const [correctionDate, setCorrectionDate] = useState("");

  const { data: checklistData, isLoading } = useQuery<{ items: ChecklistTemplateItem[] }>({
    queryKey: [`/api/vehicles/${selectedVehicle?.id}/checklist-items`],
    enabled: !!selectedVehicle?.id,
  });

  const expiredItems = useMemo(() => {
    if (!checklistData?.items) return [];
    
    const today = new Date();
    const items: ExpiryItem[] = checklistData.items
      .filter(item => item.hasExpiry && item.isActive && item.expiryDate)
      .map(item => {
        const expiryDate = new Date(item.expiryDate!);
        const daysUntil = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        let status: "expired" | "expiring" = daysUntil <= 0 ? "expired" : "expiring";
        
        if (daysUntil > 15) return null;
        
        return {
          id: item.id,
          label: item.label,
          category: item.category,
          expiryDate: item.expiryDate,
          status,
        };
      })
      .filter((item): item is ExpiryItem => item !== null);

    return items.sort((a, b) => {
      if (a.status === "expired" && b.status !== "expired") return -1;
      if (a.status !== "expired" && b.status === "expired") return 1;
      return new Date(a.expiryDate!).getTime() - new Date(b.expiryDate!).getTime();
    });
  }, [checklistData]);

  const updateDateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedItem || !correctionDate) throw new Error("No item or date");
      return apiRequest("POST", `/api/checklist-templates/${selectedItem.id}/update-expiry`, {
        expiryDate: correctionDate,
        updatedBy: user?.name || "Equipaggio",
        notes: "Materiale ripristinato",
        vehicleId: selectedVehicle?.id,
        vehicleCode: selectedVehicle?.code,
      });
    },
    onSuccess: async () => {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setCorrectionModalVisible(false);
      setSelectedItem(null);
      setCorrectionDate("");
      await queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${selectedVehicle?.id}/checklist-items`] });
      await queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${selectedVehicle?.id}/material-restorations`] });
      await queryClient.invalidateQueries({ queryKey: ["/api/expiry-alerts"] });
      Alert.alert("Ripristino Confermato", "Il materiale è stato aggiornato con la nuova data di scadenza.", [{ text: "OK" }]);
    },
    onError: () => {
      Alert.alert("Errore", "Impossibile aggiornare la data. Riprova.");
    },
  });

  const handleOpenItem = (item: ExpiryItem) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setSelectedItem(item);
    setCorrectionDate("");
    setCorrectionModalVisible(true);
  };

  const expiredCount = expiredItems.filter(i => i.status === "expired").length;
  const expiringCount = expiredItems.filter(i => i.status === "expiring").length;

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, { paddingTop: headerHeight + Spacing.xl }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
            Caricamento...
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.md,
        }}
      >
        <Card style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View style={[styles.headerIcon, { backgroundColor: theme.errorLight }]}>
              <Feather name="alert-triangle" size={24} color={theme.error} />
            </View>
            <View style={styles.headerInfo}>
              <ThemedText type="h3">Materiali da Ripristinare</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Ambulanza {selectedVehicle?.code}
              </ThemedText>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={[styles.statBox, { backgroundColor: theme.errorLight }]}>
              <ThemedText type="h2" style={{ color: theme.error }}>{expiredCount}</ThemedText>
              <ThemedText type="small" style={{ color: theme.error }}>Scaduti</ThemedText>
            </View>
            <View style={[styles.statBox, { backgroundColor: theme.warningLight }]}>
              <ThemedText type="h2" style={{ color: theme.warning }}>{expiringCount}</ThemedText>
              <ThemedText type="small" style={{ color: theme.warning }}>In scadenza</ThemedText>
            </View>
          </View>
        </Card>

        {expiredItems.length > 0 ? (
          <Card style={styles.listCard}>
            <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
              Tocca un articolo per inserire la nuova data di scadenza
            </ThemedText>
            {expiredItems.map((item, index) => (
              <Pressable
                key={item.id}
                style={[
                  styles.itemRow,
                  { borderColor: item.status === "expired" ? theme.error : theme.warning },
                  index < expiredItems.length - 1 && { marginBottom: Spacing.sm }
                ]}
                onPress={() => handleOpenItem(item)}
              >
                <View style={[styles.itemIcon, { backgroundColor: item.status === "expired" ? theme.errorLight : theme.warningLight }]}>
                  <Feather 
                    name={item.status === "expired" ? "alert-octagon" : "alert-triangle"} 
                    size={18} 
                    color={item.status === "expired" ? theme.error : theme.warning} 
                  />
                </View>
                <View style={styles.itemInfo}>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>{item.label}</ThemedText>
                  <ThemedText type="small" style={{ color: item.status === "expired" ? theme.error : theme.warning, marginTop: 2 }}>
                    {item.status === "expired" ? "Scaduto" : "In scadenza"}: {formatDate(item.expiryDate)}
                  </ThemedText>
                </View>
                <View style={[styles.editBadge, { backgroundColor: theme.primaryLight }]}>
                  <Feather name="edit-2" size={14} color={theme.primary} />
                </View>
              </Pressable>
            ))}
          </Card>
        ) : (
          <Card style={[styles.listCard, { alignItems: "center", paddingVertical: Spacing.xl }]}>
            <View style={[styles.successIcon, { backgroundColor: theme.successLight }]}>
              <Feather name="check-circle" size={48} color={theme.success} />
            </View>
            <ThemedText type="h3" style={{ color: theme.success, marginTop: Spacing.lg }}>
              Tutto in regola!
            </ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.sm }}>
              Non ci sono materiali scaduti o in scadenza
            </ThemedText>
          </Card>
        )}

        <Pressable
          style={[styles.backButton, { borderColor: theme.border }]}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={18} color={theme.textSecondary} />
          <ThemedText type="body" style={{ color: theme.textSecondary, marginLeft: Spacing.sm }}>
            Torna Indietro
          </ThemedText>
        </Pressable>
      </ScrollView>

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
                  <ThemedText type="h3">Ripristina Materiale</ThemedText>
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

                    <ThemedText type="label" style={{ color: theme.textSecondary, marginTop: Spacing.lg, marginBottom: Spacing.xs }}>
                      DATA SCADENZA NUOVO MATERIALE
                    </ThemedText>
                    <View style={[styles.inputBox, { borderColor: "#00A651" }]}>
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
                      style={[styles.submitButton, { backgroundColor: "#00A651", opacity: correctionDate.trim() ? 1 : 0.5 }]}
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerCard: { padding: Spacing.lg, marginBottom: Spacing.md },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.lg },
  headerIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center" },
  headerInfo: { marginLeft: Spacing.md, flex: 1 },
  statsRow: { flexDirection: "row", gap: Spacing.sm },
  statBox: { flex: 1, padding: Spacing.md, borderRadius: BorderRadius.md, alignItems: "center" },
  listCard: { padding: Spacing.lg },
  itemRow: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderWidth: 1.5, borderRadius: BorderRadius.lg },
  itemIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  itemInfo: { flex: 1, marginLeft: Spacing.md },
  editBadge: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  successIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  backButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, marginTop: Spacing.xl },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalScrollContent: { flexGrow: 1, justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg, paddingBottom: Spacing.xl + 20 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.lg },
  modalItem: { padding: Spacing.md, borderRadius: BorderRadius.md },
  modalItemHeader: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.sm },
  modalItemStatus: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.full },
  inputBox: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  textInput: { flex: 1, marginLeft: Spacing.sm, fontSize: 16 },
  submitButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: Spacing.lg, borderRadius: BorderRadius.lg, marginTop: Spacing.xl },
});
