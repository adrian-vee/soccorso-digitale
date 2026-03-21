import React from "react";
import { View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { OxygenGauge } from "@/components/OxygenGauge";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface OxygenLevels {
  bombola1: number;
  bombola2: number;
  portatile: number;
}

interface OxygenSectionProps {
  levels: OxygenLevels;
  onChange: (levels: OxygenLevels) => void;
  maxBar?: number;
}

export function OxygenSection({ levels, onChange, maxBar = 200 }: OxygenSectionProps) {
  const { theme } = useTheme();
  
  const allOk = levels.bombola1 >= 100 && levels.bombola2 >= 100 && levels.portatile >= 50;
  const hasWarning = levels.bombola1 < 100 || levels.bombola2 < 100 || levels.portatile < 50;
  const hasCritical = levels.bombola1 < 50 || levels.bombola2 < 50 || levels.portatile < 25;

  return (
    <Card style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.iconWrapper, { backgroundColor: "#06B6D4" + "20" }]}>
          <Feather name="wind" size={20} color="#06B6D4" />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText type="body" style={{ fontWeight: "600" }} numberOfLines={1}>Ossigeno</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }} numberOfLines={1}>
            Livelli bombole O2
          </ThemedText>
        </View>
        {allOk && (
          <View style={[styles.statusBadge, { backgroundColor: "#10B981" }]}>
            <Feather name="check" size={14} color="#FFFFFF" />
            <ThemedText type="small" style={{ color: "#FFFFFF", fontWeight: "600", marginLeft: 4 }} numberOfLines={1}>
              OK
            </ThemedText>
          </View>
        )}
        {hasCritical && (
          <View style={[styles.statusBadge, { backgroundColor: "#EF4444" }]}>
            <Feather name="alert-triangle" size={14} color="#FFFFFF" />
            <ThemedText type="small" style={{ color: "#FFFFFF", fontWeight: "600", marginLeft: 4 }} numberOfLines={1}>
              CRITICO
            </ThemedText>
          </View>
        )}
        {!allOk && hasWarning && !hasCritical && (
          <View style={[styles.statusBadge, { backgroundColor: "#F59E0B" }]}>
            <Feather name="alert-circle" size={14} color="#FFFFFF" />
            <ThemedText type="small" style={{ color: "#FFFFFF", fontWeight: "600", marginLeft: 4 }} numberOfLines={1}>
              ATTENZIONE
            </ThemedText>
          </View>
        )}
      </View>
      
      <View style={styles.topRow}>
        <OxygenGauge
          label="Bombola Grande 1"
          value={levels.bombola1}
          onChange={(value) => onChange({ ...levels, bombola1: value })}
          maxBar={maxBar}
          size="large"
        />
        <OxygenGauge
          label="Bombola Grande 2"
          value={levels.bombola2}
          onChange={(value) => onChange({ ...levels, bombola2: value })}
          maxBar={maxBar}
          size="large"
        />
      </View>
      
      <View style={styles.bottomRow}>
        <OxygenGauge
          label="Portatile"
          value={levels.portatile}
          onChange={(value) => onChange({ ...levels, portatile: value })}
          maxBar={maxBar}
          size="large"
        />
      </View>
      
      <View style={[styles.infoBox, { backgroundColor: theme.primary + "10" }]}>
        <Feather name="info" size={14} color={theme.primary} />
        <ThemedText type="small" style={{ color: theme.primary, marginLeft: Spacing.sm, flex: 1 }}>
          Tap sui pulsanti per impostare il livello
        </ThemedText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  bottomRow: {
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
});
