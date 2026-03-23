import React from "react";
import { View, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { ThemedText } from "@/components/ThemedText";
import { BorderRadius, Spacing } from "@/constants/theme";

function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

interface HolidayData {
  date: string;
  localName: string;
  name: string;
}

interface HolidayChipProps {
  date: Date;
  style?: object;
}

export function HolidayChip({ date, style }: HolidayChipProps) {
  const dateStr = toDateStr(date);

  const { data } = useQuery<{ data: HolidayData | null; isHoliday: boolean }>({
    queryKey: [`/api/providers/holidays/check/${dateStr}`],
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  });

  if (!data?.isHoliday || !data.data) return null;

  return (
    <View style={[styles.chip, style]}>
      <View style={styles.dot} />
      <ThemedText style={styles.label} numberOfLines={1}>
        Festivo – {data.data.localName}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(220, 53, 69, 0.12)",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    alignSelf: "flex-start",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#DC3545",
  },
  label: {
    color: "#DC3545",
    fontWeight: "700",
    fontSize: 11,
  },
});
