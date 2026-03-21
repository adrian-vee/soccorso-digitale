import React, { useEffect } from "react";
import { View, StyleSheet, Alert, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { getApiUrl } from "@/lib/query-client";
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withSequence,
  withTiming,
  cancelAnimation,
  Easing
} from "react-native-reanimated";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { AmbulanceIcon } from "@/components/AmbulanceIcon";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useGpsTrackingContext } from "@/contexts/GpsTrackingContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";

type ProfileNavigationProp = NativeStackNavigationProp<ProfileStackParamList>;

interface LocationData {
  id: string;
  name: string;
  code: string;
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const { user, logout, refreshUserData } = useAuth();
  const selectedVehicle = user?.vehicle || null;
  const { isTracking, pointsCount, error: gpsError, permission: gpsPermission, startTracking } = useGpsTrackingContext();
  const navigation = useNavigation<ProfileNavigationProp>();

  // Refresh user data on mount to get latest location info
  useEffect(() => {
    refreshUserData();
  }, []);

  // Fetch location directly if not in user data
  const { data: vehicleLocation } = useQuery<LocationData>({
    queryKey: [`/api/locations/${selectedVehicle?.locationId}`],
    enabled: !!selectedVehicle?.locationId && !user?.location,
  });

  // Use user location or fetched location
  const selectedLocation = user?.location || vehicleLocation || null;

  const currentDate = new Date();
  const currentDay = currentDate.getDate();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
  const isScadenzePeriod = currentDay >= 24;

  const { data: scadenzeStatus } = useQuery<{ completed: boolean; pendingDays: number }>({
    queryKey: [`/api/scadenze/status?vehicleId=${selectedVehicle?.id}&month=${currentMonth}&year=${currentYear}`],
    enabled: !!selectedVehicle?.id,
  });

  interface CrewMember {
    id: string;
    name: string;
    role: string;
    status: string;
  }

  interface TodayCrewData {
    crew: CrewMember[];
    shiftInfo: { startTime: string; endTime: string; status: string } | null;
  }

  const { data: todayCrew } = useQuery<TodayCrewData>({
    queryKey: [`/api/vehicles/${selectedVehicle?.id}/today-crew`],
    enabled: !!selectedVehicle?.id,
    refetchInterval: 60000,
  });

  const scadenzePending = isScadenzePeriod && !scadenzeStatus?.completed;

  const pulseAnim = useSharedValue(1);
  const glowAnim = useSharedValue(0);

  useEffect(() => {
    if (scadenzePending) {
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
      glowAnim.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    } else {
      cancelAnimation(pulseAnim);
      cancelAnimation(glowAnim);
      pulseAnim.value = 1;
      glowAnim.value = 0;
    }
    return () => {
      cancelAnimation(pulseAnim);
      cancelAnimation(glowAnim);
    };
  }, [scadenzePending, pulseAnim, glowAnim]);

  const scadenzeButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  const scadenzeGlowStyle = useAnimatedStyle(() => ({
    opacity: glowAnim.value,
  }));

  const handleScadenzePress = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    navigation.navigate("Scadenze");
  };

  const handleOpenScanner = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    navigation.navigate("DocumentScanner", {
      documentType: "altro",
    });
  };

  const handleLogout = () => {
    Alert.alert(
      "Conferma Logout",
      "Sei sicuro di voler uscire?",
      [
        { text: "Annulla", style: "cancel" },
        { 
          text: "Esci", 
          style: "destructive",
          onPress: async () => {
            await logout();
          }
        }
      ]
    );
  };

  const getRoleLabel = (role: string) => {
    const roles: Record<string, string> = {
      crew: "Equipaggio",
      admin: "Amministratore",
      director: "Direzione",
    };
    return roles[role] || role;
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "director":
        return { bg: theme.primaryLight, text: theme.primary };
      case "admin":
        return { bg: theme.warningLight, text: theme.warning };
      default:
        return { bg: theme.successLight, text: theme.success };
    }
  };

  const roleColors = getRoleColor(user?.role || "crew");

  const isAdmin = user?.role === "admin" || user?.role === "director" || user?.role === "super_admin" || user?.role === "org_admin";

  const settingsItems = [
    ...(isAdmin ? [{
      icon: "maximize" as const,
      label: "Scanner Magazzino",
      adminOnly: true,
      onPress: () => {
        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        navigation.navigate("InventoryScanner");
      },
    }] : []),
    {
      icon: "bell" as const,
      label: "Notifiche",
      onPress: () => {
        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        navigation.navigate("NotificationsSettings");
      },
    },
    {
      icon: "shield" as const,
      label: "Privacy e Dati",
      onPress: () => {
        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        navigation.navigate("Privacy");
      },
    },
    {
      icon: "help-circle" as const,
      label: "Assistenza",
      onPress: () => {
        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        navigation.navigate("Assistenza");
      },
    },
    {
      icon: "info" as const,
      label: "Info App",
      onPress: () => {
        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        navigation.navigate("InfoApp");
      },
    },
  ];

  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: Spacing.lg,
        paddingBottom: tabBarHeight + Spacing["2xl"],
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      <View style={styles.profileHeader}>
        {user?.organization?.logoUrl ? (
          <Image
            source={{ uri: `${getApiUrl()}${user.organization.logoUrl}` }}
            style={styles.orgLogoImage}
            contentFit="contain"
            transition={200}
            cachePolicy="memory-disk"
            priority="high"
          />
        ) : (
          <View style={[styles.avatarLarge, { backgroundColor: theme.primary }]}>
            <ThemedText type="h2" style={styles.avatarInitials}>
              {selectedVehicle?.code || user?.name?.charAt(0)?.toUpperCase() || "U"}
            </ThemedText>
          </View>
        )}
        <ThemedText type="body" style={[styles.userEmail, { color: theme.textSecondary }]}>
          {user?.organization?.name || selectedLocation?.name || "Sede non assegnata"}
        </ThemedText>
        {todayCrew && todayCrew.crew.length > 0 ? (
          <View style={[styles.crewContainer, { backgroundColor: theme.successLight }]}>
            <Feather name="users" size={14} color={theme.success} />
            <ThemedText type="small" style={[styles.crewText, { color: theme.success }]}>
              {todayCrew.crew.map(c => c.name).join(", ")}
            </ThemedText>
          </View>
        ) : null}
        <View style={[styles.rolePill, { backgroundColor: user?.customRoleName ? theme.primaryLight : roleColors.bg }]}>
          {user?.customRoleName ? (
            <Feather name="briefcase" size={12} color={user?.customRoleName ? theme.primary : roleColors.text} />
          ) : user?.role === "crew" ? (
            <AmbulanceIcon size={12} color={roleColors.text} />
          ) : (
            <Feather 
              name={user?.role === "director" ? "award" : "shield"} 
              size={12} 
              color={roleColors.text} 
            />
          )}
          <ThemedText type="small" style={[styles.roleText, { color: user?.customRoleName ? theme.primary : roleColors.text }]}>
            {user?.customRoleName || (user?.role === "crew" ? "Equipaggio" : getRoleLabel(user?.role || ""))}
          </ThemedText>
        </View>
      </View>

      <Card style={styles.vehicleCard}>
        <Pressable 
          style={({ pressed }) => [styles.vehicleMainBtn, { backgroundColor: theme.primary, opacity: pressed ? 0.85 : 1 }]}
          onPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate("VehicleDetail");
          }}
        >
          <View style={styles.vehicleMainBtnIcon}>
            <Feather name="bar-chart-2" size={18} color="#FFFFFF" />
          </View>
          <ThemedText type="body" style={styles.vehicleMainBtnText}>
            Dettagli Veicolo
          </ThemedText>
          <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.7)" />
        </Pressable>

        <View style={styles.vehicleQuickActions}>
          <Pressable
            style={({ pressed }) => [
              styles.vehicleQuickBtn,
              { 
                backgroundColor: isDark ? "rgba(59,130,246,0.08)" : "rgba(59,130,246,0.04)",
                borderColor: isDark ? "rgba(59,130,246,0.2)" : "rgba(59,130,246,0.12)",
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            onPress={() => {
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate("VehicleDocuments");
            }}
          >
            <View style={[styles.vehicleQuickIcon, { backgroundColor: "rgba(59,130,246,0.12)" }]}>
              <Feather name="folder" size={20} color="#3B82F6" />
            </View>
            <ThemedText type="body" style={[styles.vehicleQuickLabel, { color: theme.text }]}>
              Documenti
            </ThemedText>
            <Feather name="chevron-right" size={14} color={theme.textSecondary} style={{ marginLeft: "auto" }} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.vehicleQuickBtn,
              { 
                backgroundColor: isDark ? "rgba(0,166,81,0.08)" : "rgba(0,166,81,0.04)",
                borderColor: isDark ? "rgba(0,166,81,0.2)" : "rgba(0,166,81,0.12)",
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            onPress={() => {
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate("SanitizationLog");
            }}
          >
            <View style={[styles.vehicleQuickIcon, { backgroundColor: "rgba(0,166,81,0.12)" }]}>
              <Feather name="droplet" size={20} color="#00A651" />
            </View>
            <ThemedText type="body" style={[styles.vehicleQuickLabel, { color: theme.text }]}>
              Sanificazione
            </ThemedText>
            <Feather name="chevron-right" size={14} color={theme.textSecondary} style={{ marginLeft: "auto" }} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.vehicleQuickBtn,
              { 
                backgroundColor: isDark ? "rgba(234,88,12,0.08)" : "rgba(234,88,12,0.04)",
                borderColor: isDark ? "rgba(234,88,12,0.2)" : "rgba(234,88,12,0.12)",
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            onPress={() => {
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate("FuelCard");
            }}
          >
            <View style={[styles.vehicleQuickIcon, { backgroundColor: "rgba(234,88,12,0.12)" }]}>
              <Feather name="credit-card" size={20} color="#EA580C" />
            </View>
            <ThemedText type="body" style={[styles.vehicleQuickLabel, { color: theme.text }]}>
              Tessera Carburante
            </ThemedText>
            <Feather name="chevron-right" size={14} color={theme.textSecondary} style={{ marginLeft: "auto" }} />
          </Pressable>
        </View>
      </Card>

      <View style={styles.operationsSection}>
        <Pressable 
          style={styles.premiumCard}
          onPress={() => {
            if (Platform.OS !== "web") {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            navigation.navigate("Checklist");
          }}
        >
          <LinearGradient
            colors={['#0066CC', '#004D99', '#003366']}
            style={styles.premiumCardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.premiumCardContent}>
              <View style={styles.premiumIconContainer}>
                <View style={styles.premiumIconRing}>
                  <Feather name="clipboard" size={28} color="#FFFFFF" />
                </View>
              </View>
              <View style={styles.premiumTextContainer}>
                <ThemedText type="h3" style={styles.premiumTitle}>
                  Checklist Pre-Partenza
                </ThemedText>
                <ThemedText type="small" style={styles.premiumSubtitle}>
                  Controllo giornaliero obbligatorio
                </ThemedText>
              </View>
            </View>
            <View style={styles.premiumAccent} />
          </LinearGradient>
        </Pressable>

        <Animated.View style={scadenzeButtonStyle}>
          <Pressable 
            style={styles.premiumCard}
            onPress={handleScadenzePress}
          >
            <LinearGradient
              colors={scadenzePending ? ['#DC2626', '#B91C1C', '#991B1B'] : ['#00A651', '#008744', '#006B37']}
              style={styles.premiumCardGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.premiumCardContent}>
                <View style={styles.premiumIconContainer}>
                  <View style={styles.premiumIconRing}>
                    <Feather name="calendar" size={28} color="#FFFFFF" />
                  </View>
                </View>
                <View style={styles.premiumTextContainer}>
                  <ThemedText type="h3" style={styles.premiumTitle}>
                    Scadenze Materiali
                  </ThemedText>
                  <ThemedText type="small" style={styles.premiumSubtitle}>
                    {scadenzePending ? "Da completare entro fine mese" : "Verifica mensile dal 25 al 31"}
                  </ThemedText>
                </View>
              </View>
              {scadenzePending && (
                <View style={styles.premiumAlertBadge}>
                  <ThemedText type="small" style={styles.premiumAlertText}>
                    URGENTE
                  </ThemedText>
                </View>
              )}
              <View style={styles.premiumAccent} />
            </LinearGradient>
          </Pressable>
        </Animated.View>


      </View>

      {Platform.OS !== "web" && (
        <Card style={styles.gpsCard}>
          <View style={styles.gpsHeader}>
            <View style={[
              styles.gpsIconCircle, 
              { backgroundColor: isTracking ? theme.successLight : (gpsError ? theme.errorLight : theme.primaryLight) }
            ]}>
              <Feather 
                name="navigation" 
                size={20} 
                color={isTracking ? theme.success : (gpsError ? theme.error : theme.primary)} 
              />
            </View>
            <View style={styles.gpsHeaderText}>
              <ThemedText type="h3" style={styles.gpsTitle}>
                Tracciamento GPS
              </ThemedText>
              <View style={styles.gpsStatusRow}>
                <View style={[
                  styles.gpsStatusDot, 
                  { backgroundColor: isTracking ? theme.success : (gpsError ? theme.error : theme.textSecondary) }
                ]} />
                <ThemedText type="small" style={{ 
                  color: isTracking ? theme.success : (gpsError ? theme.error : theme.textSecondary)
                }}>
                  {isTracking ? "Attivo" : (gpsError ? "Errore" : (!gpsPermission?.granted ? "Non abilitato" : "Non attivo"))}
                </ThemedText>
              </View>
            </View>
            {isTracking && (
              <View style={[styles.gpsLiveBadge, { backgroundColor: theme.success }]}>
                <View style={styles.gpsPulse} />
                <ThemedText type="small" style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 11 }}>
                  LIVE
                </ThemedText>
              </View>
            )}
          </View>
          
          {isTracking ? (
            <View style={[styles.gpsActiveInfo, { backgroundColor: theme.successLight }]}>
              <Feather name="check-circle" size={14} color={theme.success} />
              <ThemedText type="small" style={{ color: theme.success, marginLeft: 8, flex: 1 }}>
                Registrazione automatica attiva
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.success, fontWeight: "600" }}>
                {pointsCount} punti
              </ThemedText>
            </View>
          ) : (
            <Pressable
              style={[styles.gpsEnableBtn, { backgroundColor: theme.primary }]}
              onPress={startTracking}
            >
              <Feather name={gpsPermission?.granted ? "play" : "map-pin"} size={16} color="#FFFFFF" />
              <ThemedText type="body" style={{ color: "#FFFFFF", marginLeft: 8, fontWeight: "600" }}>
                {gpsPermission?.granted ? "Avvia Tracciamento" : "Abilita GPS"}
              </ThemedText>
            </Pressable>
          )}
          
          {gpsError && (
            <View style={[styles.gpsErrorInfo, { backgroundColor: theme.errorLight }]}>
              <Feather name="alert-circle" size={14} color={theme.error} />
              <ThemedText type="small" style={{ color: theme.error, marginLeft: 8, flex: 1 }}>
                {gpsError}
              </ThemedText>
            </View>
          )}
        </Card>
      )}

      <ThemedText type="small" style={[styles.sectionLabel, { color: theme.textSecondary }]}>
        IMPOSTAZIONI
      </ThemedText>

      <Card style={styles.settingsCard}>
        {settingsItems.map((item, index) => (
          <React.Fragment key={item.label}>
            {index > 0 && (
              <View style={[styles.settingsDivider, { backgroundColor: theme.border }]} />
            )}
            {'featured' in item && item.featured ? (
              <Pressable 
                style={[styles.settingsRow, styles.featuredRow]}
                onPress={item.onPress}
              >
                <View style={[styles.settingsIconCircle, styles.featuredIconCircle, { backgroundColor: theme.primary }]}>
                  <Feather name={item.icon} size={20} color="#FFFFFF" />
                </View>
                <View style={styles.featuredTextContainer}>
                  <ThemedText type="body" style={[styles.settingsLabel, styles.featuredLabel]}>
                    {item.label}
                  </ThemedText>
                  <ThemedText type="small" style={[styles.featuredSubtitle, { color: theme.textSecondary }]}>
                    Gestione materiali
                  </ThemedText>
                </View>
                <View style={[styles.featuredBadge, { backgroundColor: theme.primaryLight }]}>
                  <Feather name="chevron-right" size={18} color={theme.primary} />
                </View>
              </Pressable>
            ) : (
              <Pressable 
                style={styles.settingsRow}
                onPress={item.onPress}
              >
                <View style={[styles.settingsIconCircle, { backgroundColor: theme.backgroundRoot }]}>
                  <Feather name={item.icon} size={18} color={theme.text} />
                </View>
                <ThemedText type="body" style={styles.settingsLabel}>
                  {item.label}
                </ThemedText>
                <Feather name="chevron-right" size={18} color={theme.textSecondary} />
              </Pressable>
            )}
          </React.Fragment>
        ))}
      </Card>

      <Pressable 
        style={[styles.logoutButton, { backgroundColor: theme.errorLight }]}
        onPress={handleLogout}
      >
        <Feather name="log-out" size={18} color={theme.error} />
        <ThemedText type="body" style={[styles.logoutText, { color: theme.error }]}>
          Esci dall'account
        </ThemedText>
      </Pressable>

      <ThemedText type="small" style={[styles.versionText, { color: theme.textSecondary }]}>
        SOCCORSO DIGITALE v2.0.0 BETA
      </ThemedText>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  profileHeader: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  avatarLarge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  avatarInitials: {
    color: "#FFFFFF",
    fontSize: 36,
    fontWeight: "700",
  },
  orgLogoImage: {
    width: 200,
    height: 100,
    marginBottom: Spacing.md,
    borderRadius: 12,
  },
  userName: {
    marginBottom: Spacing.xs,
    textAlign: "center",
  },
  userEmail: {
    marginBottom: Spacing.sm,
  },
  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  roleText: {
    fontWeight: "600",
  },
  crewContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    flexWrap: "wrap",
    maxWidth: "90%",
  },
  crewText: {
    fontWeight: "500",
    flex: 1,
    textAlign: "center",
  },
  vehicleCard: {
    marginBottom: Spacing.xl,
    padding: 0,
    overflow: "hidden",
  },
  vehicleMainBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    margin: Spacing.md,
    gap: Spacing.sm,
  },
  vehicleMainBtnIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  vehicleMainBtnText: {
    flex: 1,
    fontWeight: "700",
    fontSize: 15,
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  vehicleQuickActions: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.xs,
  },
  vehicleQuickBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: 12,
  },
  vehicleQuickIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  vehicleQuickLabel: {
    fontWeight: "600",
    fontSize: 14,
    flex: 1,
  },
  gpsCard: {
    marginBottom: Spacing.xl,
  },
  gpsHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  gpsIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  gpsHeaderText: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  gpsTitle: {
    fontWeight: "600",
  },
  gpsStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 6,
  },
  gpsStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  gpsLiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  gpsPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
  },
  gpsStats: {
    gap: Spacing.sm,
  },
  gpsStat: {
    flexDirection: "row",
    alignItems: "center",
  },
  gpsEnableBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  gpsActiveInfo: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.md,
  },
  gpsErrorInfo: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
  },
  operationsSection: {
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  premiumCard: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  premiumCardGradient: {
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    position: "relative",
  },
  premiumCardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  premiumIconContainer: {
    marginRight: Spacing.lg,
  },
  premiumIconRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.3)",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  premiumTextContainer: {
    flex: 1,
  },
  premiumTitle: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 17,
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  premiumSubtitle: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 13,
    letterSpacing: 0.2,
  },
  premiumAccent: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    transform: [{ translateX: 30 }, { translateY: -30 }],
  },
  premiumAlertBadge: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.md,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  premiumAlertText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 10,
    letterSpacing: 1,
  },
  sectionLabel: {
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  settingsCard: {
    padding: 0,
    marginBottom: Spacing.xl,
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  settingsIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsLabel: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  settingsDivider: {
    height: 1,
    marginLeft: 60,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
  },
  logoutText: {
    fontWeight: "600",
  },
  versionText: {
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  featuredRow: {
    paddingVertical: Spacing.lg,
  },
  featuredIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  featuredTextContainer: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  featuredLabel: {
    fontWeight: "700",
    fontSize: 16,
  },
  featuredSubtitle: {
    marginTop: 2,
  },
  featuredBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  actionCardsContainer: {
    padding: 0,
    marginBottom: Spacing.xl,
    overflow: "hidden",
  },
  actionCardRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  actionIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  actionCardContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  actionDivider: {
    height: 1,
    marginLeft: 64,
  },
  urgentBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  contractAssignment: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    marginBottom: 4,
    gap: Spacing.xs,
  },
  contractLogo: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  contractName: {
    fontWeight: "500",
    fontSize: 13,
  },
  scheduleChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
});
