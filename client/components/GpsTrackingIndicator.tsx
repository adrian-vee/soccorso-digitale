import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "./ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";

interface GpsTrackingIndicatorProps {
  isTracking: boolean;
  pointsCount?: number;
  duration?: string;
  onPress?: () => void;
}

export function GpsTrackingIndicator({
  isTracking,
  pointsCount = 0,
  duration,
  onPress
}: GpsTrackingIndicatorProps) {
  const { theme } = useTheme();

  if (!isTracking) return null;

  return (
    <Pressable 
      style={[
        styles.container, 
        { backgroundColor: theme.success + "20", borderColor: theme.success }
      ]}
      onPress={onPress}
    >
      <View style={[styles.dot, { backgroundColor: theme.success }]} />
      <Feather name="navigation" size={16} color={theme.success} />
      <ThemedText style={[styles.text, { color: theme.success }]}>
        GPS Tracking Attivo
      </ThemedText>
      {pointsCount > 0 && (
        <ThemedText style={[styles.count, { color: theme.textSecondary }]}>
          {pointsCount} punti
        </ThemedText>
      )}
      {duration && (
        <ThemedText style={[styles.duration, { color: theme.textSecondary }]}>
          {duration}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: "600",
  },
  count: {
    fontSize: 11,
    marginLeft: Spacing.xs,
  },
  duration: {
    fontSize: 11,
    marginLeft: Spacing.xs,
  },
});
