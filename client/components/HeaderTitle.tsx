import React from "react";
import { View, StyleSheet } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { AmbulanceIcon } from "@/components/AmbulanceIcon";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";

interface HeaderTitleProps {
  title: string;
}

export function HeaderTitle({ title }: HeaderTitleProps) {
  const { theme } = useTheme();
  
  return (
    <View style={styles.container}>
      <View style={[styles.iconContainer, { backgroundColor: theme.primary }]}>
        <AmbulanceIcon size={14} color="#FFFFFF" />
      </View>
      <ThemedText style={styles.title}>{title}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  iconContainer: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
  },
});
