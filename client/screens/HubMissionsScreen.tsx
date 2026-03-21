import React from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

export default function HubMissionsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ThemedView style={[styles.container, { paddingBottom: insets.bottom + Spacing.xl }]}>
      <Animated.View entering={FadeIn.duration(600)} style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: theme.primary + "15" }]}>
          <Feather name="tool" size={48} color={theme.primary} />
        </View>
        <ThemedText style={[styles.title, { color: theme.text }]}>
          Sezione in fase di sviluppo
        </ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          Stiamo lavorando per offrirti la migliore esperienza possibile. Questa funzionalità sarà disponibile a breve.
        </ThemedText>
      </Animated.View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
    paddingHorizontal: Spacing.xl * 2,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
});
