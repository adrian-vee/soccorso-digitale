import React, { useState, useEffect } from "react";
import { View, StyleSheet, Switch, Pressable, ActivityIndicator, Alert, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import DateTimePicker from "@react-native-community/datetimepicker";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { scheduleExpiryNotifications } from "@/services/expiryNotifications";

interface NotificationSettings {
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  checklistReminderEnabled: boolean;
  checklistReminderTime: string;
  expiryAlertsEnabled: boolean;
  scadenzeReminderEnabled: boolean;
}

export default function NotificationsSettingsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings>({
    notificationsEnabled: true,
    soundEnabled: true,
    vibrationEnabled: true,
    checklistReminderEnabled: true,
    checklistReminderTime: "07:00",
    expiryAlertsEnabled: true,
    scadenzeReminderEnabled: true,
  });

  const { data: serverSettings, isLoading } = useQuery<NotificationSettings>({
    queryKey: ["/api/user-settings"],
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (serverSettings) {
      setSettings(serverSettings);
    }
  }, [serverSettings]);

  const updateMutation = useMutation({
    mutationFn: async (newSettings: Partial<NotificationSettings>) => {
      return apiRequest("PUT", "/api/user-settings", newSettings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-settings"] });
      setTimeout(() => {
        scheduleExpiryNotifications().catch(err => {
          console.log("Failed to reschedule notifications:", err);
        });
      }, 500);
    },
    onError: () => {
      Alert.alert("Errore", "Impossibile salvare le impostazioni");
    },
  });

  const handleToggle = (key: keyof NotificationSettings) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const newValue = !settings[key];
    setSettings((prev) => ({ ...prev, [key]: newValue }));
    updateMutation.mutate({ [key]: newValue });
  };

  const handleTimeChange = (_event: any, selectedDate?: Date) => {
    setShowTimePicker(false);
    if (selectedDate) {
      const hours = selectedDate.getHours().toString().padStart(2, "0");
      const minutes = selectedDate.getMinutes().toString().padStart(2, "0");
      const timeString = `${hours}:${minutes}`;
      setSettings((prev) => ({ ...prev, checklistReminderTime: timeString }));
      updateMutation.mutate({ checklistReminderTime: timeString });
    }
  };

  const parseTime = (timeStr: string): Date => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText type="body" style={{ marginTop: Spacing.md, color: theme.textSecondary }}>
            Caricamento impostazioni...
          </ThemedText>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
    >
      <Card style={styles.settingsCard}>
        <View style={styles.sectionHeader}>
          <View style={[styles.iconCircle, { backgroundColor: theme.primaryLight }]}>
            <Feather name="bell" size={18} color={theme.primary} />
          </View>
          <ThemedText type="h3" style={styles.sectionTitle}>Notifiche Generali</ThemedText>
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <ThemedText type="body" style={styles.settingLabel}>Notifiche attive</ThemedText>
            <ThemedText type="small" style={[styles.settingDesc, { color: theme.textSecondary }]}>
              Attiva o disattiva tutte le notifiche
            </ThemedText>
          </View>
          <Switch
            value={settings.notificationsEnabled}
            onValueChange={() => handleToggle("notificationsEnabled")}
            trackColor={{ false: theme.border, true: theme.successLight }}
            thumbColor={settings.notificationsEnabled ? theme.success : theme.textSecondary}
          />
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <ThemedText type="body" style={styles.settingLabel}>Suono</ThemedText>
            <ThemedText type="small" style={[styles.settingDesc, { color: theme.textSecondary }]}>
              Riproduci un suono per le notifiche
            </ThemedText>
          </View>
          <Switch
            value={settings.soundEnabled}
            onValueChange={() => handleToggle("soundEnabled")}
            trackColor={{ false: theme.border, true: theme.successLight }}
            thumbColor={settings.soundEnabled ? theme.success : theme.textSecondary}
            disabled={!settings.notificationsEnabled}
          />
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <ThemedText type="body" style={styles.settingLabel}>Vibrazione</ThemedText>
            <ThemedText type="small" style={[styles.settingDesc, { color: theme.textSecondary }]}>
              Vibra quando arriva una notifica
            </ThemedText>
          </View>
          <Switch
            value={settings.vibrationEnabled}
            onValueChange={() => handleToggle("vibrationEnabled")}
            trackColor={{ false: theme.border, true: theme.successLight }}
            thumbColor={settings.vibrationEnabled ? theme.success : theme.textSecondary}
            disabled={!settings.notificationsEnabled}
          />
        </View>
      </Card>

      <Card style={styles.settingsCard}>
        <View style={styles.sectionHeader}>
          <View style={[styles.iconCircle, { backgroundColor: theme.warningLight }]}>
            <Feather name="clipboard" size={18} color={theme.warning} />
          </View>
          <ThemedText type="h3" style={styles.sectionTitle}>Promemoria Checklist</ThemedText>
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <ThemedText type="body" style={styles.settingLabel}>Promemoria mattutino</ThemedText>
            <ThemedText type="small" style={[styles.settingDesc, { color: theme.textSecondary }]}>
              Ricevi un promemoria per compilare la checklist
            </ThemedText>
          </View>
          <Switch
            value={settings.checklistReminderEnabled}
            onValueChange={() => handleToggle("checklistReminderEnabled")}
            trackColor={{ false: theme.border, true: theme.successLight }}
            thumbColor={settings.checklistReminderEnabled ? theme.success : theme.textSecondary}
            disabled={!settings.notificationsEnabled}
          />
        </View>

        {settings.checklistReminderEnabled ? (
          <>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <Pressable 
              style={styles.settingRow} 
              onPress={() => setShowTimePicker(true)}
            >
              <View style={styles.settingInfo}>
                <ThemedText type="body" style={styles.settingLabel}>Orario promemoria</ThemedText>
                <ThemedText type="small" style={[styles.settingDesc, { color: theme.textSecondary }]}>
                  Scegli quando ricevere il promemoria
                </ThemedText>
              </View>
              <View style={[styles.timeButton, { backgroundColor: theme.primaryLight }]}>
                <Feather name="clock" size={14} color={theme.primary} />
                <ThemedText type="body" style={{ color: theme.primary, marginLeft: Spacing.xs, fontWeight: "600" }}>
                  {settings.checklistReminderTime}
                </ThemedText>
              </View>
            </Pressable>
          </>
        ) : null}

        {showTimePicker ? (
          <DateTimePicker
            value={parseTime(settings.checklistReminderTime)}
            mode="time"
            is24Hour={true}
            display="default"
            onChange={handleTimeChange}
          />
        ) : null}
      </Card>

      <Card style={styles.settingsCard}>
        <View style={styles.sectionHeader}>
          <View style={[styles.iconCircle, { backgroundColor: theme.errorLight }]}>
            <Feather name="alert-circle" size={18} color={theme.error} />
          </View>
          <ThemedText type="h3" style={styles.sectionTitle}>Avvisi Scadenze</ThemedText>
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <ThemedText type="body" style={styles.settingLabel}>Avvisi materiale in scadenza</ThemedText>
            <ThemedText type="small" style={[styles.settingDesc, { color: theme.textSecondary }]}>
              Notifiche per materiale in scadenza
            </ThemedText>
          </View>
          <Switch
            value={settings.expiryAlertsEnabled}
            onValueChange={() => handleToggle("expiryAlertsEnabled")}
            trackColor={{ false: theme.border, true: theme.successLight }}
            thumbColor={settings.expiryAlertsEnabled ? theme.success : theme.textSecondary}
            disabled={!settings.notificationsEnabled}
          />
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <ThemedText type="body" style={styles.settingLabel}>Promemoria scadenze mensili</ThemedText>
            <ThemedText type="small" style={[styles.settingDesc, { color: theme.textSecondary }]}>
              Ricevi un promemoria il 24 e 25 del mese
            </ThemedText>
          </View>
          <Switch
            value={settings.scadenzeReminderEnabled}
            onValueChange={() => handleToggle("scadenzeReminderEnabled")}
            trackColor={{ false: theme.border, true: theme.successLight }}
            thumbColor={settings.scadenzeReminderEnabled ? theme.success : theme.textSecondary}
            disabled={!settings.notificationsEnabled}
          />
        </View>
      </Card>

      <View style={styles.infoBox}>
        <Feather name="info" size={16} color={theme.textSecondary} />
        <ThemedText type="small" style={[styles.infoText, { color: theme.textSecondary }]}>
          Le notifiche push richiedono che l'app abbia i permessi necessari. 
          Vai nelle impostazioni del dispositivo per gestire i permessi.
        </ThemedText>
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  settingsCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionTitle: {
    marginLeft: Spacing.md,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
  },
  settingInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  settingLabel: {
    fontWeight: "600",
  },
  settingDesc: {
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.sm,
  },
  timeButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.md,
  },
  infoText: {
    flex: 1,
    marginLeft: Spacing.sm,
    lineHeight: 18,
  },
});
