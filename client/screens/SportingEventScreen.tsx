import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Alert, RefreshControl, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { AmbulanceIcon } from "@/components/AmbulanceIcon";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";

interface SportingEvent {
  id: string;
  name: string;
  description?: string;
  location?: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  status: "scheduled" | "active" | "completed" | "cancelled";
  vehicleId?: string;
  inventoryTemplateId?: string;
  notes?: string;
}

interface InventoryLog {
  log: {
    id: string;
    eventId: string;
    itemId: string;
    quantityOut: number;
    quantityReturned?: number;
    quantityUsed?: number;
    status: string;
    checkedOutAt?: string;
    checkedInAt?: string;
    varianceReason?: string;
  };
  item: {
    id: string;
    name: string;
    category?: string;
    unit?: string;
  };
}

interface EventData {
  event: SportingEvent | null;
  inventory: InventoryLog[];
}

export default function SportingEventScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const selectedVehicle = user?.vehicle || null;
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery<EventData>({
    queryKey: selectedVehicle ? [`/api/vehicles/${selectedVehicle.id}/active-event`] : ["no-vehicle"],
    enabled: !!selectedVehicle,
  });

  const event = data?.event;
  const inventory = data?.inventory || [];

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return theme.success;
      case "scheduled": return theme.primary;
      case "completed": return theme.textSecondary;
      case "cancelled": return theme.error;
      default: return theme.textSecondary;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active": return "In Corso";
      case "scheduled": return "Programmato";
      case "completed": return "Completato";
      case "cancelled": return "Annullato";
      default: return status;
    }
  };

  const checkedOutItems = inventory.filter(i => i.log.status === "checked_out");
  const returnedItems = inventory.filter(i => i.log.status === "returned" || i.log.status === "partial_return");

  if (!selectedVehicle) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.centerContent, { paddingTop: headerHeight }]}>
          <AmbulanceIcon size={48} color={theme.textSecondary} />
          <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md, textAlign: "center" }}>
            Nessun veicolo selezionato
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.centerContent, { paddingTop: headerHeight }]}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
            Caricamento evento...
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (!event) {
    return (
      <ThemedView style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: tabBarHeight + Spacing.xl,
            paddingHorizontal: Spacing.lg,
          }}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => refetch()} />}
        >
          <Card style={styles.noEventCard}>
            <View style={[styles.iconContainer, { backgroundColor: theme.primaryLight }]}>
              <Feather name="calendar" size={48} color={theme.primary} />
            </View>
            <ThemedText type="h3" style={{ marginTop: Spacing.lg, textAlign: "center" }}>
              Nessun Evento Attivo
            </ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.sm, textAlign: "center" }}>
              Al momento non ci sono eventi sportivi programmati per questo veicolo
            </ThemedText>
          </Card>
        </ScrollView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => refetch()} />}
      >
        <Card style={styles.eventCard}>
          <View style={styles.eventHeader}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(event.status) }]}>
              <ThemedText type="small" style={{ color: "#FFFFFF", fontWeight: "700" }}>
                {getStatusLabel(event.status)}
              </ThemedText>
            </View>
            <View style={styles.typeBadge}>
              <Feather name="activity" size={12} color={theme.primary} />
              <ThemedText type="small" style={{ color: theme.primary, marginLeft: 4 }}>
                Evento Sportivo
              </ThemedText>
            </View>
          </View>

          <ThemedText type="h2" style={{ marginTop: Spacing.md }}>
            {event.name}
          </ThemedText>

          {event.description ? (
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
              {event.description}
            </ThemedText>
          ) : null}

          <View style={styles.eventDetails}>
            <View style={styles.detailRow}>
              <Feather name="calendar" size={16} color={theme.textSecondary} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                {formatDate(event.startDate)}
              </ThemedText>
            </View>

            {event.startTime ? (
              <View style={styles.detailRow}>
                <Feather name="clock" size={16} color={theme.textSecondary} />
                <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                  {event.startTime} - {event.endTime || "TBD"}
                </ThemedText>
              </View>
            ) : null}

            {event.location ? (
              <View style={styles.detailRow}>
                <Feather name="map-pin" size={16} color={theme.textSecondary} />
                <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                  {event.location}
                </ThemedText>
              </View>
            ) : null}
          </View>

          {event.notes ? (
            <View style={[styles.notesBox, { backgroundColor: theme.cardBackground }]}>
              <Feather name="info" size={14} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.sm, flex: 1 }}>
                {event.notes}
              </ThemedText>
            </View>
          ) : null}
        </Card>

        <ThemedText type="h3" style={{ marginTop: Spacing.xl, marginBottom: Spacing.md }}>
          Inventario Evento
        </ThemedText>

        {checkedOutItems.length > 0 ? (
          <Card style={styles.inventoryCard}>
            <View style={styles.inventorySectionHeader}>
              <Feather name="package" size={16} color={theme.warning} />
              <ThemedText type="label" style={{ marginLeft: Spacing.sm, color: theme.warning }}>
                MATERIALE IN USO ({checkedOutItems.length})
              </ThemedText>
            </View>
            {checkedOutItems.map((item, index) => (
              <View 
                key={item.log.id} 
                style={[
                  styles.inventoryItem,
                  index < checkedOutItems.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }
                ]}
              >
                <View style={styles.itemInfo}>
                  <ThemedText type="body">{item.item.name}</ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    {item.item.category || "Generale"}
                  </ThemedText>
                </View>
                <View style={[styles.quantityBadge, { backgroundColor: theme.warningLight }]}>
                  <ThemedText type="body" style={{ color: theme.warning, fontWeight: "700" }}>
                    {item.log.quantityOut}
                  </ThemedText>
                </View>
              </View>
            ))}
          </Card>
        ) : (
          <Card style={styles.emptyInventoryCard}>
            <Feather name="box" size={32} color={theme.textSecondary} />
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.sm, textAlign: "center" }}>
              Nessun materiale in checkout
            </ThemedText>
          </Card>
        )}

        {returnedItems.length > 0 ? (
          <Card style={[styles.inventoryCard, styles.returnedCard]}>
            <View style={styles.inventorySectionHeader}>
              <Feather name="check-circle" size={16} color={theme.success} />
              <ThemedText type="label" style={{ marginLeft: Spacing.sm, color: theme.success }}>
                MATERIALE RESTITUITO ({returnedItems.length})
              </ThemedText>
            </View>
            {returnedItems.map((item, index) => (
              <View 
                key={item.log.id}
                style={[
                  styles.inventoryItem,
                  index < returnedItems.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }
                ]}
              >
                <View style={styles.itemInfo}>
                  <ThemedText type="body">{item.item.name}</ThemedText>
                  {item.log.varianceReason ? (
                    <ThemedText type="small" style={{ color: theme.error }}>
                      Varianza: {item.log.varianceReason}
                    </ThemedText>
                  ) : null}
                </View>
                <View style={styles.returnedQuantities}>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    Restituiti: {item.log.quantityReturned || 0}
                  </ThemedText>
                  {item.log.quantityUsed && item.log.quantityUsed > 0 ? (
                    <ThemedText type="small" style={{ color: theme.warning }}>
                      Usati: {item.log.quantityUsed}
                    </ThemedText>
                  ) : null}
                </View>
              </View>
            ))}
          </Card>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  centerContent: { flex: 1, justifyContent: "center", alignItems: "center", padding: Spacing.xl },
  noEventCard: { alignItems: "center", padding: Spacing.xl },
  iconContainer: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center" },
  eventCard: { padding: Spacing.lg },
  eventHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  typeBadge: { flexDirection: "row", alignItems: "center" },
  eventDetails: { marginTop: Spacing.lg },
  detailRow: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.sm },
  notesBox: { flexDirection: "row", alignItems: "flex-start", padding: Spacing.md, borderRadius: BorderRadius.md, marginTop: Spacing.md },
  inventoryCard: { padding: Spacing.md },
  inventorySectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.md },
  inventoryItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: Spacing.sm },
  itemInfo: { flex: 1 },
  quantityBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, minWidth: 40, alignItems: "center" },
  returnedQuantities: { alignItems: "flex-end" },
  emptyInventoryCard: { alignItems: "center", padding: Spacing.xl },
  returnedCard: { marginTop: Spacing.md },
});
