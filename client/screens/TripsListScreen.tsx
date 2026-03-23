import React, { useState, useMemo, useCallback } from "react";
import { View, StyleSheet, FlatList, Pressable, ActivityIndicator, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { TripsStackParamList } from "@/navigation/TripsStackNavigator";

const ITEMS_PER_PAGE = 10;

type TripsNavigationProp = NativeStackNavigationProp<TripsStackParamList, "TripsList">;

interface TripWaypoint {
  id: string;
  waypointOrder: number;
  waypointType: string;
  locationType: string;
  structureName: string | null;
  structureAddress: string | null;
  departmentName: string | null;
  address: string | null;
}

interface Trip {
  id: string;
  progressiveNumber: string;
  serviceDate: string;
  departureTime: string | null;
  originType: string;
  originAddress: string | null;
  originStructureName: string | null;
  originStructureAddress: string | null;
  originDepartmentName: string | null;
  destinationType: string;
  destinationAddress: string | null;
  destinationStructureName: string | null;
  destinationStructureAddress: string | null;
  destinationDepartmentName: string | null;
  kmTraveled: number;
  durationMinutes: number | null;
  isReturnTrip: boolean;
  isEmergencyService: boolean;
  locationName: string | null;
  vehicleCode: string | null;
  weatherIcon: string | null;
  weatherTemp: number | null;
  waypoints?: TripWaypoint[];
}

export default function TripsListScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const selectedVehicle = user?.vehicle || null;
  const navigation = useNavigation<TripsNavigationProp>();
  const isPersonAccount = user?.accountType === "person";
  const locationId = user?.location?.id || user?.locationId;
  
  const [currentPage, setCurrentPage] = useState(1);

  const handleTripPress = (tripId: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    navigation.navigate("TripEdit", { tripId });
  };

  const tripsQueryKey = isPersonAccount && locationId
    ? `/api/trips?locationId=${locationId}`
    : `/api/trips?vehicleId=${selectedVehicle?.id}`;

  const { data: trips, isLoading } = useQuery<Trip[]>({
    queryKey: [tripsQueryKey],
    enabled: isPersonAccount ? !!locationId : !!selectedVehicle?.id,
  });
  
  const allTrips = trips || [];
  
  // Paginate trips
  const totalPages = Math.ceil(allTrips.length / ITEMS_PER_PAGE);
  const paginatedTrips = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return allTrips.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [allTrips, currentPage]);
  
  const handlePageChange = (page: number) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setCurrentPage(page);
  };

  const ListHeader = useCallback(() => (
    <View style={styles.headerSection}>
      <AnnouncementBanner />
      
      {isPersonAccount && user?.location ? (
        <View style={[styles.resultsInfo, { flexDirection: "row", alignItems: "center", gap: 8 }]}>
          <Feather name="map-pin" size={14} color={theme.primary} />
          <ThemedText type="small" style={{ color: theme.primary, fontWeight: "600" }}>
            Sede {user.location.name}
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            - {allTrips.length} {allTrips.length === 1 ? "viaggio" : "viaggi"}
          </ThemedText>
        </View>
      ) : (
        <View style={styles.resultsInfo}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {allTrips.length} {allTrips.length === 1 ? "viaggio" : "viaggi"}
          </ThemedText>
        </View>
      )}
    </View>
  ), [theme, allTrips.length, isPersonAccount, user?.location]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getLocationDisplay = (
    type: string,
    structureName: string | null,
    structureAddress: string | null,
    departmentName: string | null,
    addressOverride: string | null,
    locationName?: string | null
  ) => {
    const typeLabels: Record<string, string> = {
      ospedale: "Ospedale",
      domicilio: "Domicilio",
      casa_di_riposo: "Casa di Riposo",
      sede: "Sede",
      altro: "Altro",
    };

    if (type === "domicilio") {
      return { main: "Domicilio", sub: addressOverride || null };
    }
    
    if (type === "sede") {
      return { main: locationName ? `Sede ${locationName}` : "Sede", sub: null };
    }
    
    if (type === "gps") {
      // Show the GPS address as main, not just "GPS"
      return { main: addressOverride || "GPS", sub: null };
    }

    if (structureName) {
      const subParts = [];
      if (departmentName) subParts.push(departmentName);
      if (structureAddress) subParts.push(structureAddress);
      return {
        main: structureName,
        sub: subParts.length > 0 ? subParts.join(" - ") : null,
      };
    }

    return { main: addressOverride || typeLabels[type] || type, sub: null };
  };

  const renderTripItem = ({ item }: { item: Trip }) => {
    const origin = getLocationDisplay(
      item.originType,
      item.originStructureName,
      item.originStructureAddress,
      item.originDepartmentName,
      item.originAddress,
      item.locationName
    );
    const destination = getLocationDisplay(
      item.destinationType,
      item.destinationStructureName,
      item.destinationStructureAddress,
      item.destinationDepartmentName,
      item.destinationAddress,
      item.locationName
    );

    return (
      <Pressable onPress={() => handleTripPress(item.id)}>
        <Card style={styles.tripCard}>
        <View style={styles.tripHeader}>
          <View style={styles.headerLeft}>
            {item.isReturnTrip && !item.progressiveNumber ? (
              <View style={[styles.badge, { backgroundColor: theme.warning + "20" }]}>
                <Feather name="user-x" size={10} color={theme.warning} />
                <ThemedText type="small" style={{ color: theme.warning, fontWeight: "700", marginLeft: 4, fontSize: 10, textTransform: "uppercase" }}>
                  SENZA PAZIENTE
                </ThemedText>
              </View>
            ) : (
              <View style={[styles.badge, { backgroundColor: theme.primaryLight }]}>
                <ThemedText type="small" style={{ color: theme.primary, fontWeight: "600" }}>
                  N. {item.progressiveNumber}
                </ThemedText>
              </View>
            )}
            {item.isEmergencyService ? (
              <View style={[styles.returnBadge, { backgroundColor: "#DC354520" }]}>
                <Feather name="alert-circle" size={10} color="#DC3545" />
                <ThemedText type="small" style={{ color: "#DC3545", marginLeft: 4, fontSize: 10, fontWeight: "700" }}>
                  EMERGENZA
                </ThemedText>
              </View>
            ) : null}
            {item.isReturnTrip && item.progressiveNumber ? (
              <View style={[styles.returnBadge, { backgroundColor: theme.warning + "20" }]}>
                <Feather name="rotate-ccw" size={10} color={theme.warning} />
                <ThemedText type="small" style={{ color: theme.warning, marginLeft: 4, fontSize: 10 }}>
                  RITORNO
                </ThemedText>
              </View>
            ) : null}
            {isPersonAccount && item.vehicleCode ? (
              <View style={[styles.returnBadge, { backgroundColor: theme.backgroundTertiary }]}>
                <Feather name="truck" size={10} color={theme.textSecondary} />
                <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4, fontSize: 10, fontWeight: "600" }}>
                  {item.vehicleCode}
                </ThemedText>
              </View>
            ) : null}
          </View>
          <View style={styles.dateTime}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {item.departureTime || ""} {item.departureTime ? "- " : ""}{formatDate(item.serviceDate)}
            </ThemedText>
          </View>
        </View>

        <View style={styles.tripRoute}>
          {/* Origin */}
          <View style={styles.routeContainer}>
            <View style={[styles.routeIcon, { backgroundColor: theme.success + "20" }]}>
              <Feather name="circle" size={8} color={theme.success} />
            </View>
            <View style={styles.routeContent}>
              <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 10 }}>Partenza</ThemedText>
              <ThemedText type="body" style={{ fontWeight: "500" }} numberOfLines={1}>
                {origin.main}
              </ThemedText>
              {origin.sub ? (
                <ThemedText type="small" style={{ color: theme.textSecondary }} numberOfLines={1}>
                  {origin.sub}
                </ThemedText>
              ) : null}
            </View>
          </View>

          {/* Waypoints for emergency services */}
          {item.waypoints && item.waypoints.length > 0 ? (
            item.waypoints.map((waypoint, index) => {
              const wpDisplay = getLocationDisplay(
                waypoint.locationType,
                waypoint.structureName,
                waypoint.structureAddress,
                waypoint.departmentName,
                waypoint.address,
                item.locationName
              );
              const waypointLabel = waypoint.waypointType === "luogo_intervento" ? "Luogo Intervento" : `Tappa ${index + 1}`;
              return (
                <View key={waypoint.id}>
                  <View style={styles.routeDivider}>
                    <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                    <Feather name="arrow-down" size={14} color={theme.warning} />
                    <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                  </View>
                  <View style={styles.routeContainer}>
                    <View style={[styles.routeIcon, { backgroundColor: theme.warning + "20" }]}>
                      <Feather name="navigation" size={10} color={theme.warning} />
                    </View>
                    <View style={styles.routeContent}>
                      <ThemedText type="small" style={{ color: theme.warning, fontSize: 10 }}>{waypointLabel}</ThemedText>
                      <ThemedText type="body" style={{ fontWeight: "500" }} numberOfLines={1}>
                        {wpDisplay.main}
                      </ThemedText>
                      {wpDisplay.sub ? (
                        <ThemedText type="small" style={{ color: theme.textSecondary }} numberOfLines={1}>
                          {wpDisplay.sub}
                        </ThemedText>
                      ) : null}
                    </View>
                  </View>
                </View>
              );
            })
          ) : null}

          <View style={styles.routeDivider}>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            <Feather name="arrow-down" size={14} color={theme.textSecondary} />
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
          </View>

          {/* Destination */}
          <View style={styles.routeContainer}>
            <View style={[styles.routeIcon, { backgroundColor: theme.error + "20" }]}>
              <Feather name="map-pin" size={10} color={theme.error} />
            </View>
            <View style={styles.routeContent}>
              <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 10 }}>Destinazione</ThemedText>
              <ThemedText type="body" style={{ fontWeight: "500" }} numberOfLines={1}>
                {destination.main}
              </ThemedText>
              {destination.sub ? (
                <ThemedText type="small" style={{ color: theme.textSecondary }} numberOfLines={1}>
                  {destination.sub}
                </ThemedText>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.tripFooter}>
          <View style={styles.tripFooterStats}>
            <View style={[styles.statBadge, { backgroundColor: theme.backgroundDefault }]}>
              <Feather name="navigation" size={14} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                {item.kmTraveled} km
              </ThemedText>
            </View>
            {item.durationMinutes ? (
              <View style={[styles.statBadge, { backgroundColor: theme.backgroundDefault }]}>
                <Feather name="clock" size={14} color={theme.textSecondary} />
                <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                  {item.durationMinutes} min
                </ThemedText>
              </View>
            ) : null}
            {item.weatherIcon && item.weatherTemp !== null ? (
              <View style={[styles.statBadge, { backgroundColor: theme.backgroundDefault }]}>
                <Feather name={item.weatherIcon as any} size={13} color={theme.textSecondary} />
                <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 3 }}>
                  {Math.round(item.weatherTemp)}°
                </ThemedText>
              </View>
            ) : null}
          </View>
          <View style={styles.tripActions}>
            <Pressable
              style={[styles.editButton, { backgroundColor: theme.primary }]}
              onPress={() => handleTripPress(item.id)}
            >
              <Feather name="edit-2" size={12} color="#FFFFFF" />
              <ThemedText type="small" style={styles.editButtonText}>
                Modifica
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </Card>
      </Pressable>
    );
  };

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Feather name="inbox" size={48} color={theme.textSecondary} />
      <ThemedText type="body" style={[styles.emptyText, { color: theme.textSecondary }]}>
        Nessun viaggio registrato
      </ThemedText>
      <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center" }}>
        I viaggi inseriti per questo veicolo appariranno qui
      </ThemedText>
    </View>
  );

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const renderPagination = () => {
    if (totalPages <= 1) return null;
    
    const pages: number[] = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return (
      <View style={styles.paginationContainer}>
        <Pressable
          style={[styles.pageButton, { backgroundColor: theme.cardBackground, opacity: currentPage === 1 ? 0.5 : 1 }]}
          onPress={() => currentPage > 1 && handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <Feather name="chevron-left" size={18} color={theme.text} />
        </Pressable>
        
        {startPage > 1 ? (
          <>
            <Pressable
              style={[styles.pageButton, { backgroundColor: theme.cardBackground }]}
              onPress={() => handlePageChange(1)}
            >
              <ThemedText type="small">1</ThemedText>
            </Pressable>
            {startPage > 2 ? <ThemedText type="small" style={{ color: theme.textSecondary }}>...</ThemedText> : null}
          </>
        ) : null}
        
        {pages.map((page) => (
          <Pressable
            key={page}
            style={[
              styles.pageButton,
              { backgroundColor: page === currentPage ? theme.primary : theme.cardBackground },
            ]}
            onPress={() => handlePageChange(page)}
          >
            <ThemedText type="small" style={{ color: page === currentPage ? "#FFFFFF" : theme.text, fontWeight: page === currentPage ? "700" : "400" }}>
              {page}
            </ThemedText>
          </Pressable>
        ))}
        
        {endPage < totalPages ? (
          <>
            {endPage < totalPages - 1 ? <ThemedText type="small" style={{ color: theme.textSecondary }}>...</ThemedText> : null}
            <Pressable
              style={[styles.pageButton, { backgroundColor: theme.cardBackground }]}
              onPress={() => handlePageChange(totalPages)}
            >
              <ThemedText type="small">{totalPages}</ThemedText>
            </Pressable>
          </>
        ) : null}
        
        <Pressable
          style={[styles.pageButton, { backgroundColor: theme.cardBackground, opacity: currentPage === totalPages ? 0.5 : 1 }]}
          onPress={() => currentPage < totalPages && handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          <Feather name="chevron-right" size={18} color={theme.text} />
        </Pressable>
      </View>
    );
  };

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
        flexGrow: 1,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      data={paginatedTrips}
      keyExtractor={(item) => item.id}
      renderItem={renderTripItem}
      ListEmptyComponent={renderEmptyList}
      ListHeaderComponent={ListHeader}
      ListFooterComponent={renderPagination}
      ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
    />
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerSection: {
    marginBottom: Spacing.lg,
  },
  tripCard: {
    padding: Spacing.lg,
  },
  tripHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  returnBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  dateTime: {
    flexDirection: "row",
    alignItems: "center",
  },
  tripRoute: {
    marginBottom: Spacing.md,
  },
  routeContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  routeIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  routeContent: {
    flex: 1,
  },
  routeDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 12,
    marginVertical: Spacing.xs,
  },
  dividerLine: {
    width: 1,
    height: 8,
    marginHorizontal: 4,
  },
  tripFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tripFooterStats: {
    flexDirection: "row",
    gap: Spacing.sm,
    flex: 1,
  },
  statBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  tripActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  reportButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  reportButtonText: {
    fontWeight: "600",
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  editButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
  },
  emptyText: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  resultsInfo: {
    marginBottom: Spacing.sm,
  },
  paginationContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.lg,
    marginTop: Spacing.md,
  },
  pageButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
});
