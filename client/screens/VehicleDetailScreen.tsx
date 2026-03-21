import React, { useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import DateTimePicker from "@react-native-community/datetimepicker";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { AmbulanceIcon } from "@/components/AmbulanceIcon";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { Spacing, BorderRadius } from "@/constants/theme";

interface VehicleStats {
  totalTrips: number;
  tripsLast30Days: number;
  kmLast30Days: number;
  avgKmPerTrip: number;
  avgDurationMinutes: number;
  recentTrips: Array<{
    id: string;
    serviceDate: string;
    originName: string;
    destinationName: string;
    kmTraveled: number;
    departureTime: string;
    returnTime: string;
    progressiveNumber: string;
  }>;
}

interface MaintenanceData {
  nextRevisionDate: string | null;
  nextServiceDate: string | null;
  revisionKm: number | null;
  maintenanceStatus: string;
  lastMaintenanceDate: string | null;
  lastMaintenanceKm: number | null;
}

function StatCard({ 
  icon, 
  value, 
  label, 
  color,
  delay = 0 
}: { 
  icon: string; 
  value: string | number; 
  label: string; 
  color: string;
  delay?: number;
}) {
  const { theme } = useTheme();
  
  return (
    <Animated.View 
      entering={FadeInUp.delay(delay).springify()}
      style={[styles.statCard, { backgroundColor: theme.cardBackground }]}
    >
      <View style={[styles.statIconCircle, { backgroundColor: color + "15" }]}>
        <Feather name={icon as any} size={16} color={color} />
      </View>
      <ThemedText type="h3" style={styles.statValue}>{value}</ThemedText>
      <ThemedText type="small" style={[styles.statLabel, { color: theme.textSecondary }]}>
        {label}
      </ThemedText>
    </Animated.View>
  );
}

function MaintenanceStatusIndicator({ 
  percentage, 
  daysRemaining, 
  kmToRevision
}: { 
  percentage: number | null; 
  daysRemaining: number | null; 
  kmToRevision: number | null;
}) {
  const { theme } = useTheme();
  
  const hasAnyData = percentage !== null || daysRemaining !== null || kmToRevision !== null;
  
  if (!hasAnyData) {
    return (
      <View style={styles.maintenanceIndicator}>
        <View style={styles.noDataContainer}>
          <View style={[styles.noDataIconWrapper, { backgroundColor: theme.primaryLight }]}>
            <Feather name="alert-circle" size={28} color={theme.primary} />
          </View>
          <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md, textAlign: "center", fontWeight: "500" }}>
            Dati manutenzione non disponibili
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center", marginTop: 4 }}>
            Verranno configurati dall'amministrazione
          </ThemedText>
        </View>
      </View>
    );
  }
  
  const hasPercentage = percentage !== null;
  const displayPercentage = percentage ?? 0;
  const progressColor = hasPercentage 
    ? (displayPercentage >= 80 ? theme.success : displayPercentage >= 50 ? theme.warning : theme.error)
    : theme.primary;
  
  return (
    <View style={styles.maintenanceIndicator}>
      <View style={styles.progressCircleContainer}>
        <View style={[styles.progressCircleOuter, { backgroundColor: theme.primaryLight }]}>
          <View style={[styles.progressCircle, { borderColor: progressColor }]}>
            <View style={[styles.progressCircleInner, { backgroundColor: theme.cardBackground }]}>
              {hasPercentage ? (
                <>
                  <ThemedText type="h2" style={{ color: theme.primary, fontWeight: "700" }}>{displayPercentage}%</ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 10 }}>completato</ThemedText>
                </>
              ) : (
                <>
                  <ThemedText type="h3" style={{ color: theme.textSecondary }}>N/D</ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>da configurare</ThemedText>
                </>
              )}
            </View>
          </View>
        </View>
      </View>
      
      <View style={styles.maintenanceStats}>
        <View style={[styles.maintenanceStatCard, { backgroundColor: theme.primaryLight }]}>
          <View style={[styles.maintenanceStatIcon, { backgroundColor: theme.cardBackground }]}>
            <Feather name="calendar" size={16} color={theme.primary} />
          </View>
          <View style={styles.maintenanceStatText}>
            <ThemedText type="h3" style={{ color: theme.primary, fontWeight: "700" }}>{daysRemaining !== null ? daysRemaining : "N/D"}</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 11 }}>giorni rimanenti</ThemedText>
          </View>
        </View>
        
        <View style={[styles.maintenanceStatCard, { backgroundColor: theme.primaryLight }]}>
          <View style={[styles.maintenanceStatIcon, { backgroundColor: theme.cardBackground }]}>
            <Feather name="navigation" size={16} color={theme.primary} />
          </View>
          <View style={styles.maintenanceStatText}>
            <ThemedText type="h3" style={{ color: theme.primary, fontWeight: "700" }}>{kmToRevision !== null ? kmToRevision.toLocaleString("it-IT") : "N/D"} km</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 11 }}>alla revisione</ThemedText>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function VehicleDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const selectedVehicle = user?.vehicle || null;
  const selectedLocation = user?.location || null;
  const queryClient = useQueryClient();
  
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [maintenanceForm, setMaintenanceForm] = useState<MaintenanceData>({
    nextRevisionDate: null,
    nextServiceDate: null,
    revisionKm: null,
    maintenanceStatus: "ok",
    lastMaintenanceDate: null,
    lastMaintenanceKm: null,
  });
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState<"nextRevision" | "nextService" | "lastMaintenance" | null>(null);

  const vehicleId = selectedVehicle?.id;

  const { data: stats, isLoading: statsLoading } = useQuery<VehicleStats>({
    queryKey: [`/api/vehicles/${vehicleId}/stats`],
    enabled: !!vehicleId,
  });

  const updateMaintenanceMutation = useMutation({
    mutationFn: async (data: MaintenanceData) => {
      const response = await apiRequest("PATCH", `/api/vehicles/${vehicleId}/maintenance`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${vehicleId}/stats`] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      setShowMaintenanceModal(false);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert("Successo", "Stato manutenzione aggiornato");
    },
    onError: (error: any) => {
      Alert.alert("Errore", error.message || "Impossibile aggiornare la manutenzione");
    },
  });

  const handleDownloadPdf = async () => {
    if (!vehicleId) return;
    
    setIsGeneratingPdf(true);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    try {
      const url = new URL(`/api/vehicles/${vehicleId}/report-pdf`, getApiUrl());
      
      if (Platform.OS === "web") {
        window.open(url.toString(), "_blank");
      } else {
        const { openBrowserAsync } = await import("expo-web-browser");
        await openBrowserAsync(url.toString());
      }
    } catch (error) {
      Alert.alert("Errore", "Impossibile generare il report PDF");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const openMaintenanceModal = () => {
    if (selectedVehicle) {
      setMaintenanceForm({
        nextRevisionDate: (selectedVehicle as any).nextRevisionDate || null,
        nextServiceDate: (selectedVehicle as any).nextServiceDate || null,
        revisionKm: (selectedVehicle as any).revisionKm || null,
        maintenanceStatus: (selectedVehicle as any).maintenanceStatus || "ok",
        lastMaintenanceDate: (selectedVehicle as any).lastMaintenanceDate || null,
        lastMaintenanceKm: (selectedVehicle as any).lastMaintenanceKm || null,
      });
    }
    setShowMaintenanceModal(true);
  };

  const calculateMaintenancePercentage = (): number | null => {
    const vehicle = selectedVehicle as any;
    if (!vehicle?.revisionKm || !vehicle?.currentKm || !vehicle?.lastMaintenanceKm) return null;
    const totalInterval = vehicle.revisionKm - vehicle.lastMaintenanceKm;
    if (totalInterval <= 0) return null;
    const kmDone = vehicle.currentKm - vehicle.lastMaintenanceKm;
    const remaining = Math.max(0, totalInterval - kmDone);
    return Math.max(0, Math.min(100, Math.round((remaining / totalInterval) * 100)));
  };

  const calculateDaysRemaining = (): number | null => {
    const vehicle = selectedVehicle as any;
    if (!vehicle?.nextRevisionDate) return null;
    const revisionDate = new Date(vehicle.nextRevisionDate);
    const today = new Date();
    const diffTime = revisionDate.getTime() - today.getTime();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };

  const calculateKmToRevision = (): number | null => {
    const vehicle = selectedVehicle as any;
    if (!vehicle?.revisionKm || !vehicle?.currentKm) return null;
    return Math.max(0, vehicle.revisionKm - vehicle.currentKm);
  };

  if (!selectedVehicle) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.emptyState}>
          <AmbulanceIcon size={48} color={theme.textSecondary} />
          <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
            Seleziona un veicolo
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  const statusColor = selectedVehicle.isOnService ? theme.success : theme.textSecondary;
  const statusText = selectedVehicle.isOnService ? "In servizio" : "In sosta";

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.springify()}>
          <Card style={styles.headerCard}>
            <LinearGradient
              colors={isDark ? ["#1a2744", "#0d1a2d"] : ["#f8fafc", "#eef2f7"]}
              style={styles.headerGradient}
            >
              <View style={styles.headerTop}>
                <View style={[styles.vehicleIconLarge, { backgroundColor: theme.primary }]}>
                  <AmbulanceIcon size={28} color="#FFFFFF" />
                </View>
                <View style={styles.headerInfo}>
                  <ThemedText type="h1" style={styles.vehicleCode}>
                    {selectedVehicle.code}
                  </ThemedText>
                  <ThemedText type="body" style={{ color: theme.textSecondary }}>
                    {[(selectedVehicle as any).brand, selectedVehicle.model].filter(Boolean).join(" ") || "Veicolo"}
                  </ThemedText>
                </View>
                <View style={styles.headerBadges}>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
                    <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                    <ThemedText type="small" style={{ color: statusColor }}>{statusText}</ThemedText>
                  </View>
                </View>
              </View>
              {selectedLocation?.name ? (
                <View style={[styles.locationBadgeRow, { backgroundColor: theme.primaryLight }]}>
                  <Feather name="map-pin" size={12} color={theme.primary} />
                  <ThemedText type="small" style={{ color: theme.primary, marginLeft: 4 }}>
                    {selectedLocation.name}
                  </ThemedText>
                </View>
              ) : null}
            </LinearGradient>
          </Card>
        </Animated.View>

        <View style={styles.statsGrid}>
          <StatCard 
            icon="activity" 
            value={selectedVehicle.currentKm?.toLocaleString("it-IT") || 0} 
            label="KM ATTUALI" 
            color={theme.primary}
            delay={0}
          />
          <StatCard 
            icon="clipboard" 
            value={stats?.totalTrips || 0} 
            label="SERVIZI TOTALI" 
            color="#8B5CF6"
            delay={50}
          />
          <StatCard 
            icon="calendar" 
            value={stats?.tripsLast30Days || 0} 
            label="SERVIZI (30GG)" 
            color="#F59E0B"
            delay={100}
          />
          <StatCard 
            icon="zap" 
            value={stats?.kmLast30Days?.toLocaleString("it-IT") || 0} 
            label="KM (30GG)" 
            color="#10B981"
            delay={150}
          />
          <StatCard 
            icon="navigation" 
            value={stats?.avgKmPerTrip || 0} 
            label="KM MEDI" 
            color="#EC4899"
            delay={200}
          />
          <StatCard 
            icon="clock" 
            value={stats?.avgDurationMinutes ? `${stats.avgDurationMinutes}'` : "-"} 
            label="DURATA MEDIA" 
            color="#06B6D4"
            delay={250}
          />
        </View>

        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Feather name="info" size={18} color={theme.primary} />
                <ThemedText type="h3" style={styles.sectionTitle}>Dettagli Veicolo</ThemedText>
              </View>
            </View>
            
            <View style={styles.detailsGrid}>
              <View style={styles.detailItem}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>TARGA</ThemedText>
                <ThemedText type="body" style={styles.detailValue}>
                  {selectedVehicle.licensePlate || "N/D"}
                </ThemedText>
              </View>
              <View style={styles.detailItem}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>MARCA</ThemedText>
                <ThemedText type="body" style={styles.detailValue}>
                  {(selectedVehicle as any).brand || "-"}
                </ThemedText>
              </View>
              <View style={styles.detailItem}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>MODELLO</ThemedText>
                <ThemedText type="body" style={styles.detailValue}>
                  {selectedVehicle.model || "N/D"}
                </ThemedText>
              </View>
              <View style={styles.detailItem}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>ALIMENTAZIONE</ThemedText>
                <ThemedText type="body" style={styles.detailValue}>
                  {selectedVehicle.fuelType || "Gasolio"}
                </ThemedText>
              </View>
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).springify()}>
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Feather name="tool" size={18} color={theme.primary} />
                <ThemedText type="h3" style={styles.sectionTitle}>Stato Manutenzione</ThemedText>
              </View>
              {user?.role === 'admin' ? (
                <Pressable onPress={openMaintenanceModal}>
                  <View style={[styles.editButton, { backgroundColor: theme.primaryLight }]}>
                    <Feather name="edit-2" size={14} color={theme.primary} />
                  </View>
                </Pressable>
              ) : null}
            </View>
            
            <MaintenanceStatusIndicator 
              percentage={calculateMaintenancePercentage()}
              daysRemaining={calculateDaysRemaining()}
              kmToRevision={calculateKmToRevision()}
            />
          </Card>
        </Animated.View>

        {user?.role === 'admin' ? (
          <Animated.View entering={FadeInDown.delay(600).springify()}>
            <Pressable
              style={({ pressed }) => [
                styles.downloadButton,
                { backgroundColor: theme.primary, opacity: pressed ? 0.9 : 1 },
              ]}
              onPress={handleDownloadPdf}
              disabled={isGeneratingPdf}
            >
              {isGeneratingPdf ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="download" size={18} color="#FFFFFF" />
                  <ThemedText type="body" style={styles.downloadButtonText}>
                    Scarica Report PDF
                  </ThemedText>
                </>
              )}
            </Pressable>
          </Animated.View>
        ) : null}
      </ScrollView>

      <Modal
        visible={showMaintenanceModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowMaintenanceModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <Pressable onPress={() => setShowMaintenanceModal(false)}>
              <ThemedText type="body" style={{ color: theme.primary }}>Annulla</ThemedText>
            </Pressable>
            <ThemedText type="h3">Modifica Manutenzione</ThemedText>
            <Pressable 
              onPress={() => updateMaintenanceMutation.mutate(maintenanceForm)}
              disabled={updateMaintenanceMutation.isPending}
            >
              <ThemedText type="body" style={{ color: theme.primary, fontWeight: "600" }}>
                {updateMaintenanceMutation.isPending ? "..." : "Salva"}
              </ThemedText>
            </Pressable>
          </View>
          
          <ScrollView style={styles.modalContent} contentContainerStyle={{ padding: Spacing.lg }}>
            <View style={styles.formGroup}>
              <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: 8 }}>
                STATO MANUTENZIONE
              </ThemedText>
              <View style={styles.statusButtons}>
                {["ok", "warning", "critical"].map((status) => (
                  <Pressable
                    key={status}
                    style={[
                      styles.statusButton,
                      { 
                        backgroundColor: maintenanceForm.maintenanceStatus === status 
                          ? (status === "ok" ? theme.success : status === "warning" ? theme.warning : theme.error)
                          : theme.cardBackground,
                        borderColor: status === "ok" ? theme.success : status === "warning" ? theme.warning : theme.error,
                      },
                    ]}
                    onPress={() => setMaintenanceForm({ ...maintenanceForm, maintenanceStatus: status })}
                  >
                    <ThemedText 
                      type="small" 
                      style={{ 
                        color: maintenanceForm.maintenanceStatus === status ? "#FFFFFF" : theme.text,
                        fontWeight: "600",
                      }}
                    >
                      {status === "ok" ? "OK" : status === "warning" ? "Attenzione" : "Critico"}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: 8 }}>
                DATA PROSSIMA REVISIONE
              </ThemedText>
              <Pressable
                style={[styles.input, styles.dateInput, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
                onPress={() => setShowDatePicker("nextRevision")}
              >
                <ThemedText type="body" style={{ color: maintenanceForm.nextRevisionDate ? theme.text : theme.textSecondary }}>
                  {maintenanceForm.nextRevisionDate 
                    ? new Date(maintenanceForm.nextRevisionDate).toLocaleDateString("it-IT")
                    : "Seleziona data"}
                </ThemedText>
                <Feather name="calendar" size={16} color={theme.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.formGroup}>
              <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: 8 }}>
                KM ALLA REVISIONE
              </ThemedText>
              <RNTextInput
                style={[styles.input, { backgroundColor: theme.cardBackground, color: theme.text, borderColor: theme.border }]}
                value={maintenanceForm.revisionKm?.toString() || ""}
                onChangeText={(text) => setMaintenanceForm({ ...maintenanceForm, revisionKm: parseInt(text) || null })}
                keyboardType="number-pad"
                placeholder="Es. 450000"
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={styles.formGroup}>
              <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: 8 }}>
                DATA PROSSIMO TAGLIANDO
              </ThemedText>
              <Pressable
                style={[styles.input, styles.dateInput, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
                onPress={() => setShowDatePicker("nextService")}
              >
                <ThemedText type="body" style={{ color: maintenanceForm.nextServiceDate ? theme.text : theme.textSecondary }}>
                  {maintenanceForm.nextServiceDate 
                    ? new Date(maintenanceForm.nextServiceDate).toLocaleDateString("it-IT")
                    : "Seleziona data"}
                </ThemedText>
                <Feather name="calendar" size={16} color={theme.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.formGroup}>
              <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: 8 }}>
                DATA ULTIMO TAGLIANDO
              </ThemedText>
              <Pressable
                style={[styles.input, styles.dateInput, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
                onPress={() => setShowDatePicker("lastMaintenance")}
              >
                <ThemedText type="body" style={{ color: maintenanceForm.lastMaintenanceDate ? theme.text : theme.textSecondary }}>
                  {maintenanceForm.lastMaintenanceDate 
                    ? new Date(maintenanceForm.lastMaintenanceDate).toLocaleDateString("it-IT")
                    : "Seleziona data"}
                </ThemedText>
                <Feather name="calendar" size={16} color={theme.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.formGroup}>
              <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: 8 }}>
                KM ULTIMO TAGLIANDO
              </ThemedText>
              <RNTextInput
                style={[styles.input, { backgroundColor: theme.cardBackground, color: theme.text, borderColor: theme.border }]}
                value={maintenanceForm.lastMaintenanceKm?.toString() || ""}
                onChangeText={(text) => setMaintenanceForm({ ...maintenanceForm, lastMaintenanceKm: parseInt(text) || null })}
                keyboardType="number-pad"
                placeholder="Es. 420000"
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            {showDatePicker && Platform.OS !== "web" ? (
              <DateTimePicker
                value={
                  showDatePicker === "nextRevision" && maintenanceForm.nextRevisionDate
                    ? new Date(maintenanceForm.nextRevisionDate)
                    : showDatePicker === "nextService" && maintenanceForm.nextServiceDate
                    ? new Date(maintenanceForm.nextServiceDate)
                    : showDatePicker === "lastMaintenance" && maintenanceForm.lastMaintenanceDate
                    ? new Date(maintenanceForm.lastMaintenanceDate)
                    : new Date()
                }
                mode="date"
                display="spinner"
                onChange={(event, selectedDate) => {
                  if (event.type === "dismissed") {
                    setShowDatePicker(null);
                    return;
                  }
                  if (selectedDate) {
                    const dateStr = selectedDate.toISOString().split("T")[0];
                    if (showDatePicker === "nextRevision") {
                      setMaintenanceForm({ ...maintenanceForm, nextRevisionDate: dateStr });
                    } else if (showDatePicker === "nextService") {
                      setMaintenanceForm({ ...maintenanceForm, nextServiceDate: dateStr });
                    } else if (showDatePicker === "lastMaintenance") {
                      setMaintenanceForm({ ...maintenanceForm, lastMaintenanceDate: dateStr });
                    }
                  }
                  setShowDatePicker(null);
                }}
              />
            ) : null}
          </ScrollView>
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
  headerCard: {
    padding: 0,
    overflow: "hidden",
    marginBottom: Spacing.lg,
  },
  headerGradient: {
    padding: Spacing.lg,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  vehicleIconLarge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  headerInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  vehicleCode: {
    fontSize: 28,
    fontWeight: "800",
  },
  headerBadges: {
    alignItems: "flex-end",
    gap: 8,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  locationBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  locationBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: Spacing.sm,
    alignSelf: "flex-start",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
    marginBottom: Spacing.lg,
  },
  statCard: {
    width: "31%",
    marginHorizontal: "1.16%",
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  statIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: "600",
    textAlign: "center",
  },
  sectionCard: {
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontWeight: "600",
  },
  editButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  detailItem: {
    width: "50%",
    marginBottom: Spacing.md,
  },
  detailValue: {
    fontWeight: "600",
    marginTop: 4,
  },
  maintenanceIndicator: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.lg,
  },
  noDataContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl,
  },
  noDataIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  progressCircleContainer: {
    marginRight: Spacing.lg,
  },
  progressCircleOuter: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: "center",
    justifyContent: "center",
  },
  progressCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  progressCircleInner: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: "center",
    justifyContent: "center",
  },
  maintenanceStats: {
    flex: 1,
    gap: Spacing.sm,
  },
  maintenanceStatCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  maintenanceStatIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  maintenanceStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  maintenanceStatText: {
    flex: 1,
  },
  downloadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: 10,
  },
  downloadButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  modalContent: {
    flex: 1,
  },
  formGroup: {
    marginBottom: Spacing.lg,
  },
  statusButtons: {
    flexDirection: "row",
    gap: 10,
  },
  statusButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    borderWidth: 1,
  },
  input: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    fontSize: 16,
  },
  dateInput: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
