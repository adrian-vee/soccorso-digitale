import React, { useState } from "react";
import { View, StyleSheet, Pressable, TextInput, Modal } from "react-native";
import { Feather } from "@expo/vector-icons";
import Svg, { Circle, Path } from "react-native-svg";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface OxygenGaugeProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  maxBar?: number;
  size?: "small" | "large";
}

const COLORS = {
  red: "#EF4444",
  yellow: "#F59E0B", 
  green: "#10B981",
};

export function OxygenGauge({ 
  label, 
  value, 
  onChange, 
  maxBar = 200,
  size = "large" 
}: OxygenGaugeProps) {
  const { theme } = useTheme();
  const [showNumericInput, setShowNumericInput] = useState(false);
  const [inputValue, setInputValue] = useState(value.toString());
  
  const gaugeSize = size === "large" ? 110 : 80;
  const strokeWidth = size === "large" ? 12 : 8;
  const radius = (gaugeSize - strokeWidth) / 2;
  const center = gaugeSize / 2;
  
  const percentage = Math.min(100, Math.max(0, (value / maxBar) * 100));
  
  const getColor = (pct: number) => {
    if (pct <= 25) return COLORS.red;
    if (pct <= 50) return COLORS.yellow;
    return COLORS.green;
  };
  
  const currentColor = getColor(percentage);
  
  const startAngle = -225;
  const endAngle = 45;
  const totalAngle = endAngle - startAngle;
  const currentAngle = startAngle + (percentage / 100) * totalAngle;
  
  const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
    const angleRad = (angleDeg * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(angleRad),
      y: cy + r * Math.sin(angleRad),
    };
  };
  
  const describeArc = (cx: number, cy: number, r: number, startDeg: number, endDeg: number) => {
    const start = polarToCartesian(cx, cy, r, endDeg);
    const end = polarToCartesian(cx, cy, r, startDeg);
    const largeArcFlag = endDeg - startDeg <= 180 ? 0 : 1;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
  };
  
  const handleQuickSet = (newValue: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onChange(newValue);
  };
  
  const handleNumericSubmit = () => {
    const numValue = parseInt(inputValue, 10);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= maxBar) {
      onChange(numValue);
    }
    setShowNumericInput(false);
  };

  return (
    <View style={styles.container}>
      <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {label}
      </ThemedText>
      
      <View style={styles.gaugeContainer}>
        <Pressable onPress={() => setShowNumericInput(true)}>
          <Svg width={gaugeSize} height={gaugeSize}>
            <Path
              d={describeArc(center, center, radius, startAngle, endAngle)}
              stroke={theme.border}
              strokeWidth={strokeWidth}
              fill="none"
              strokeLinecap="round"
            />
            
            {percentage > 0 && (
              <Path
                d={describeArc(center, center, radius, startAngle, currentAngle)}
                stroke={currentColor}
                strokeWidth={strokeWidth}
                fill="none"
                strokeLinecap="round"
              />
            )}
            
            <Circle
              cx={center}
              cy={center}
              r={radius - strokeWidth - 2}
              fill={theme.cardBackground}
            />
          </Svg>
          
          <View style={[styles.valueContainer, { width: gaugeSize, height: gaugeSize }]}>
            <ThemedText 
              type="h2" 
              style={[styles.valueText, { color: currentColor, fontSize: size === "large" ? 26 : 18 }]}
            >
              {value}
            </ThemedText>
            <ThemedText type="small" style={[styles.unitText, { color: theme.textSecondary }]}>
              BAR
            </ThemedText>
          </View>
        </Pressable>
      </View>
      
      <View style={styles.quickButtons}>
        <Pressable
          style={[styles.quickButton, { backgroundColor: COLORS.red }]}
          onPress={() => handleQuickSet(30)}
        >
          <ThemedText style={styles.buttonText}>30</ThemedText>
        </Pressable>
        <Pressable
          style={[styles.quickButton, { backgroundColor: COLORS.yellow }]}
          onPress={() => handleQuickSet(100)}
        >
          <ThemedText style={styles.buttonText}>100</ThemedText>
        </Pressable>
        <Pressable
          style={[styles.quickButton, { backgroundColor: COLORS.green }]}
          onPress={() => handleQuickSet(200)}
        >
          <ThemedText style={styles.buttonText}>200</ThemedText>
        </Pressable>
      </View>
      
      <Modal
        visible={showNumericInput}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNumericInput(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.numericInputCard, { backgroundColor: theme.cardBackground }]}>
            <ThemedText type="body" style={{ fontWeight: "600", marginBottom: Spacing.md }}>
              {label} - Inserisci BAR
            </ThemedText>
            <TextInput
              style={[styles.numericInput, { borderColor: theme.primary, color: theme.text }]}
              value={inputValue}
              onChangeText={setInputValue}
              keyboardType="numeric"
              maxLength={3}
              autoFocus
              selectTextOnFocus
            />
            <View style={styles.numericButtons}>
              <Pressable
                style={[styles.numericButton, { backgroundColor: theme.border }]}
                onPress={() => {
                  setInputValue(value.toString());
                  setShowNumericInput(false);
                }}
              >
                <ThemedText type="body" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Annulla</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.numericButton, { backgroundColor: theme.primary }]}
                onPress={handleNumericSubmit}
              >
                <ThemedText type="body" style={{ color: "#FFFFFF" }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Conferma</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },
  label: {
    marginBottom: Spacing.sm,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "500",
  },
  gaugeContainer: {
    position: "relative",
  },
  valueContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  valueText: {
    fontWeight: "700",
    textAlign: "center",
  },
  unitText: {
    marginTop: -2,
  },
  quickButtons: {
    flexDirection: "row",
    marginTop: Spacing.sm,
    gap: 6,
  },
  quickButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    minWidth: 36,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  numericInputCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    width: "100%",
    maxWidth: 300,
  },
  numericInput: {
    borderWidth: 2,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 24,
    textAlign: "center",
    fontWeight: "700",
    marginBottom: Spacing.md,
  },
  numericButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  numericButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
});
