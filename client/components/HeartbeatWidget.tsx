import React, { useEffect } from "react";
import { View, StyleSheet, Pressable, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery } from "@tanstack/react-query";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
  interpolate,
  interpolateColor,
  runOnJS,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";

interface HeartbeatStats {
  todayTrips: number;
  weekTrips: number;
  monthTrips: number;
  activeVehicles: number;
  totalVehicles: number;
  lastTrip: {
    time: string;
    vehicleCode: string;
    progressiveNumber: string;
  } | null;
  todayKm: number;
  weekKm: number;
  monthKm: number;
  timestamp: string;
}

export function HeartbeatWidget() {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const organizationName = user?.organization?.name?.toUpperCase() || "SOCCORSO DIGITALE";
  
  const { data: stats, isLoading, refetch } = useQuery<HeartbeatStats>({
    queryKey: ["/api/heartbeat/stats"],
    refetchInterval: 30000,
  });

  const heartScale = useSharedValue(1);
  const heartOpacity = useSharedValue(1);
  const pulseRing1 = useSharedValue(0);
  const pulseRing2 = useSharedValue(0);
  const glowIntensity = useSharedValue(0);
  const statPulse = useSharedValue(1);
  const statGlow = useSharedValue(0);

  useEffect(() => {
    heartScale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 150, easing: Easing.out(Easing.ease) }),
        withTiming(0.95, { duration: 150, easing: Easing.in(Easing.ease) }),
        withTiming(1.1, { duration: 150, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 700 })
      ),
      -1,
      false
    );

    pulseRing1.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.out(Easing.ease) }),
        withTiming(0, { duration: 0 })
      ),
      -1,
      false
    );

    setTimeout(() => {
      pulseRing2.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1500, easing: Easing.out(Easing.ease) }),
          withTiming(0, { duration: 0 })
        ),
        -1,
        false
      );
    }, 750);

    glowIntensity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  useEffect(() => {
    if (stats?.todayTrips && stats.todayTrips > 0) {
      statPulse.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 600, easing: Easing.out(Easing.ease) }),
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
      statGlow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      statPulse.value = withTiming(1, { duration: 300 });
      statGlow.value = withTiming(0, { duration: 300 });
    }
  }, [stats?.todayTrips]);

  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  const pulseRing1Style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulseRing1.value, [0, 1], [1, 2.5]) }],
    opacity: interpolate(pulseRing1.value, [0, 0.5, 1], [0.6, 0.3, 0]),
  }));

  const pulseRing2Style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulseRing2.value, [0, 1], [1, 2.5]) }],
    opacity: interpolate(pulseRing2.value, [0, 0.5, 1], [0.6, 0.3, 0]),
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glowIntensity.value, [0, 1], [0.2, 0.6]),
  }));

  const statPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: statPulse.value }],
  }));

  const statGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(statGlow.value, [0, 1], [0, 0.4]),
  }));

  const handleRefresh = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    refetch();
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString("it-IT");
  };

  return (
    <Pressable onPress={handleRefresh}>
      <LinearGradient
        colors={isDark 
          ? ["#003d7a", "#004d99", "#0066CC"] 
          : ["#0066CC", "#004d99", "#003d7a"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.container}
      >
        <Animated.View style={[styles.glowOverlay, glowStyle]}>
          <LinearGradient
            colors={["rgba(255,255,255,0.2)", "rgba(255,255,255,0)"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <View style={styles.content}>
          <View style={styles.leftSection}>
            <View style={styles.heartContainer}>
              <Animated.View style={[styles.pulseRing, pulseRing1Style]}>
                <View style={[styles.pulseRingInner, { borderColor: "#DC3545" }]} />
              </Animated.View>
              <Animated.View style={[styles.pulseRing, pulseRing2Style]}>
                <View style={[styles.pulseRingInner, { borderColor: "#DC3545" }]} />
              </Animated.View>
              <Animated.View style={[styles.heartIcon, heartStyle]}>
                <LinearGradient
                  colors={["#FF6B6B", "#DC3545", "#C82333"]}
                  style={styles.heartGradient}
                >
                  <Feather name="heart" size={24} color="#FFFFFF" />
                </LinearGradient>
              </Animated.View>
            </View>

            <View style={styles.titleSection}>
              <ThemedText type="h3" style={styles.title}>
                {organizationName}
              </ThemedText>
              <ThemedText type="small" style={styles.subtitle}>
                {isLoading ? "Caricamento..." : "Statistiche LIVE"}
              </ThemedText>
            </View>
          </View>

          <View style={styles.statsSection}>
            <View style={styles.mainStat}>
              <View style={{ position: "relative" }}>
                <ThemedText type="h1" style={styles.statNumber}>
                  {stats?.todayTrips ?? "-"}
                </ThemedText>
              </View>
              <ThemedText type="small" style={styles.statLabel}>
                servizi oggi
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.bottomStats}>
          <View style={styles.bottomStatItem}>
            <View style={styles.statIconContainer}>
              <Feather name="truck" size={12} color="#FFFFFF" />
            </View>
            <View>
              <ThemedText type="body" style={styles.bottomStatValue}>
                {stats?.activeVehicles ?? 0}/{stats?.totalVehicles ?? 0}
              </ThemedText>
              <ThemedText type="small" style={styles.bottomStatLabel}>
                mezzi attivi
              </ThemedText>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.bottomStatItem}>
            <View style={styles.statIconContainer}>
              <Feather name="navigation" size={12} color="#FFFFFF" />
            </View>
            <View>
              <ThemedText type="body" style={styles.bottomStatValue}>
                {formatNumber(stats?.todayKm ?? 0)}
              </ThemedText>
              <ThemedText type="small" style={styles.bottomStatLabel}>
                km oggi
              </ThemedText>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.bottomStatItem}>
            <View style={styles.statIconContainer}>
              <Feather name="clock" size={12} color="#FFFFFF" />
            </View>
            <View>
              <ThemedText type="body" style={styles.bottomStatValue}>
                {stats?.lastTrip?.time ?? "--:--"}
              </ThemedText>
              <ThemedText type="small" style={styles.bottomStatLabel}>
                ultimo servizio
              </ThemedText>
            </View>
          </View>
        </View>

      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
    marginBottom: Spacing.lg,
    shadowColor: "#667eea",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  glowOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BorderRadius.xl,
  },
  content: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  heartContainer: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseRing: {
    position: "absolute",
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseRingInner: {
    width: "100%",
    height: "100%",
    borderRadius: 28,
    borderWidth: 2,
  },
  heartIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: "hidden",
  },
  heartGradient: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  titleSection: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  title: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 18,
  },
  subtitle: {
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
  statsSection: {
    alignItems: "flex-end",
  },
  mainStat: {
    alignItems: "flex-end",
  },
  statNumber: {
    color: "#FFFFFF",
    fontSize: 36,
    fontWeight: "800",
    lineHeight: 40,
  },
  statLabel: {
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
  bottomStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  bottomStatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  statIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  bottomStatValue: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  bottomStatLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 10,
  },
  divider: {
    width: 1,
    height: 30,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
});
