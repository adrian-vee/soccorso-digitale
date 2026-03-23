import React from "react";
import { View, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";

// WMO weather code → icon + label + color
function getWeatherInfo(code: number): { icon: string; label: string; color: string } {
  if (code === 0) return { icon: "sun", label: "Sole", color: "#FFD740" };
  if (code <= 2) return { icon: "sun", label: "Parzialmente nuvoloso", color: "#FFD740" };
  if (code === 3) return { icon: "cloud", label: "Coperto", color: "#9BA1A6" };
  if (code <= 49) return { icon: "cloud", label: "Nebbia", color: "#9BA1A6" };
  if (code <= 59) return { icon: "cloud-drizzle", label: "Pioviggine", color: "#4DA3FF" };
  if (code <= 69) return { icon: "cloud-rain", label: "Pioggia", color: "#4DA3FF" };
  if (code <= 79) return { icon: "cloud-snow", label: "Neve", color: "#B0C4DE" };
  if (code <= 84) return { icon: "cloud-rain", label: "Rovesci", color: "#4DA3FF" };
  if (code <= 99) return { icon: "zap", label: "Temporale", color: "#FFD740" };
  return { icon: "cloud", label: "Variabile", color: "#9BA1A6" };
}

interface WeatherBadgeProps {
  lat: number;
  lon: number;
  /** compact=true → solo icona + gradi, no label testo */
  compact?: boolean;
  style?: object;
}

export function WeatherBadge({ lat, lon, compact = false, style }: WeatherBadgeProps) {
  const { theme } = useTheme();

  const { data } = useQuery<{
    data: { temperature: number; weatherCode: number; condition: string } | null;
  }>({
    queryKey: [`/api/providers/weather?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`],
    staleTime: 30 * 60 * 1000,
    retry: false,
  });

  if (!data?.data) return null;

  const { temperature, weatherCode } = data.data;
  const { icon, label, color } = getWeatherInfo(weatherCode ?? 0);

  return (
    <View style={[styles.badge, { backgroundColor: color + "22" }, style]}>
      <Feather name={icon as any} size={compact ? 12 : 14} color={color} />
      <ThemedText
        style={{
          color: theme.text,
          fontWeight: "600",
          fontSize: compact ? 11 : 13,
          marginLeft: 3,
        }}
      >
        {Math.round(temperature)}°
      </ThemedText>
      {!compact && (
        <ThemedText
          style={{ color: theme.textSecondary, fontSize: 11, marginLeft: 2 }}
          numberOfLines={1}
        >
          {label}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
});
