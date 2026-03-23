import React, { useState } from "react";
import { View, StyleSheet, Switch, Pressable, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";

interface Channel {
  key: "push" | "sms" | "telegram";
  icon: string;
  label: string;
  sublabel: string;
}

const CHANNELS: Channel[] = [
  { key: "push", icon: "bell", label: "Push Notification", sublabel: "Notifiche in-app su questo dispositivo" },
  { key: "sms", icon: "message-square", label: "SMS", sublabel: "Richiede numero di telefono verificato" },
  { key: "telegram", icon: "send", label: "Telegram Bot", sublabel: "Collega il tuo account Telegram" },
];

interface NotificationPreferencesProps {
  onOpenTelegramSetup?: () => void;
}

export function NotificationPreferences({ onOpenTelegramSetup }: NotificationPreferencesProps) {
  const { theme, isDark } = useTheme();
  const [enabled, setEnabled] = useState<Record<string, boolean>>({
    push: true,
    sms: false,
    telegram: false,
  });
  const [silentFrom, setSilentFrom] = useState("22:00");
  const [silentTo, setSilentTo] = useState("07:00");
  const [silentEnabled, setSilentEnabled] = useState(false);

  const handleToggle = (key: string, value: boolean) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (key === "telegram" && value && onOpenTelegramSetup) {
      onOpenTelegramSetup();
      return;
    }
    setEnabled((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <View style={styles.container}>
      <ThemedText
        type="small"
        style={{ color: theme.textSecondary, marginBottom: Spacing.sm, textTransform: "uppercase", letterSpacing: 0.5 }}
      >
        Canali di notifica
      </ThemedText>

      {CHANNELS.map((ch) => (
        <View
          key={ch.key}
          style={[
            styles.row,
            { backgroundColor: theme.cardBackground, borderColor: theme.border },
          ]}
        >
          <View style={[styles.iconWrap, { backgroundColor: theme.primaryLight }]}>
            <Feather name={ch.icon as any} size={18} color={theme.primary} />
          </View>
          <View style={styles.rowContent}>
            <ThemedText type="body" style={{ fontWeight: "600" }}>
              {ch.label}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {ch.sublabel}
            </ThemedText>
          </View>
          <Switch
            value={enabled[ch.key] ?? false}
            onValueChange={(val) => handleToggle(ch.key, val)}
            trackColor={{ false: theme.border, true: theme.primary + "80" }}
            thumbColor={enabled[ch.key] ? theme.primary : theme.textSecondary}
          />
        </View>
      ))}

      {/* Silent hours */}
      <View style={styles.silentSection}>
        <View style={styles.silentHeader}>
          <View style={{ flex: 1 }}>
            <ThemedText type="body" style={{ fontWeight: "600" }}>Ore silenziose</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Nessuna notifica in questo intervallo
            </ThemedText>
          </View>
          <Switch
            value={silentEnabled}
            onValueChange={(val) => {
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSilentEnabled(val);
            }}
            trackColor={{ false: theme.border, true: theme.primary + "80" }}
            thumbColor={silentEnabled ? theme.primary : theme.textSecondary}
          />
        </View>

        {silentEnabled && (
          <View style={styles.silentTimes}>
            <View
              style={[styles.timeChip, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
            >
              <Feather name="moon" size={13} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.text, marginLeft: 4 }}>
                Dalle {silentFrom}
              </ThemedText>
            </View>
            <Feather name="arrow-right" size={14} color={theme.textSecondary} />
            <View
              style={[styles.timeChip, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
            >
              <Feather name="sun" size={13} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.text, marginLeft: 4 }}>
                Alle {silentTo}
              </ThemedText>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rowContent: {
    flex: 1,
  },
  silentSection: {
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  silentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  silentTimes: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  timeChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
});
