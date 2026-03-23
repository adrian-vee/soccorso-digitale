import React, { useState, useEffect } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";

const DISMISSED_KEY = "@sd_dismissed_alerts_v1";

interface Alert {
  id: string;
  title: string;
  severity: string;
  region: string;
  description?: string;
}

interface AlertsResponse {
  data: Alert[] | null;
  count: number;
}

interface EmergencyAlertBannerProps {
  region?: string;
}

export function EmergencyAlertBanner({ region = "Veneto" }: EmergencyAlertBannerProps) {
  const { theme, isDark } = useTheme();
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(DISMISSED_KEY)
      .then((val) => {
        if (val) setDismissedIds(JSON.parse(val));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const { data } = useQuery<AlertsResponse>({
    queryKey: [`/api/providers/alerts?region=${encodeURIComponent(region)}`],
    staleTime: 15 * 60 * 1000,
    retry: false,
    enabled: loaded,
  });

  const activeAlerts = (data?.data ?? []).filter((a) => !dismissedIds.includes(a.id));
  if (activeAlerts.length === 0) return null;

  const handleDismiss = async (id: string) => {
    const updated = [...dismissedIds, id];
    setDismissedIds(updated);
    await AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(updated)).catch(() => {});
  };

  return (
    <View style={styles.container}>
      {activeAlerts.map((alert) => {
        const isCritical = alert.severity === "critical" || alert.severity === "high";
        const color = isCritical ? "#DC3545" : "#FF9800";

        return (
          <View
            key={alert.id}
            style={[
              styles.banner,
              {
                backgroundColor: isDark ? color + "1A" : color + "12",
                borderColor: color + "30",
                borderLeftColor: color,
              },
            ]}
          >
            <View style={[styles.iconWrap, { backgroundColor: color + "20" }]}>
              <Feather name="alert-triangle" size={15} color={color} />
            </View>
            <View style={styles.content}>
              <ThemedText
                style={{ color, fontWeight: "700", fontSize: 12 }}
                numberOfLines={1}
              >
                {alert.title}
              </ThemedText>
              {alert.description ? (
                <ThemedText
                  style={{ color: theme.textSecondary, fontSize: 11, marginTop: 1 }}
                  numberOfLines={2}
                >
                  {alert.description}
                </ThemedText>
              ) : null}
              <ThemedText
                style={{ color: theme.textSecondary, fontSize: 10, marginTop: 2 }}
              >
                Protezione Civile · {region}
              </ThemedText>
            </View>
            <Pressable
              onPress={() => handleDismiss(alert.id)}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Feather name="x" size={14} color={theme.textSecondary} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderLeftWidth: 3,
    padding: Spacing.sm,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  content: {
    flex: 1,
  },
});
