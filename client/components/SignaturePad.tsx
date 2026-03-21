import React, { useRef, useState, useCallback } from "react";
import { View, StyleSheet, Pressable, Platform, Dimensions } from "react-native";
import Svg, { Path } from "react-native-svg";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { Feather } from "@expo/vector-icons";
import ViewShot from "react-native-view-shot";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface Point {
  x: number;
  y: number;
}

interface SignaturePadProps {
  onSignatureCapture: (base64: string) => void;
  onClear: () => void;
  height?: number;
}

export function SignaturePad({ onSignatureCapture, onClear, height = 200 }: SignaturePadProps) {
  const { theme } = useTheme();
  const [paths, setPaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>("");
  const viewShotRef = useRef<ViewShot>(null);
  const containerRef = useRef<View>(null);
  const [containerLayout, setContainerLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });

  const pathToSvg = (points: Point[]): string => {
    if (points.length === 0) return "";
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }
    return d;
  };

  const pointsRef = useRef<Point[]>([]);

  const panGesture = Gesture.Pan()
    .onStart((event) => {
      pointsRef.current = [{ x: event.x, y: event.y }];
      setCurrentPath(`M ${event.x} ${event.y}`);
    })
    .onUpdate((event) => {
      pointsRef.current.push({ x: event.x, y: event.y });
      setCurrentPath(pathToSvg(pointsRef.current));
    })
    .onEnd(() => {
      if (currentPath) {
        setPaths((prev) => [...prev, currentPath]);
      }
      setCurrentPath("");
      pointsRef.current = [];
    })
    .minDistance(1)
    .runOnJS(true);

  const handleClear = useCallback(() => {
    setPaths([]);
    setCurrentPath("");
    onClear();
  }, [onClear]);

  const handleConfirm = useCallback(async () => {
    if (paths.length === 0) return;
    
    try {
      if (viewShotRef.current?.capture) {
        const uri = await viewShotRef.current.capture();
        const response = await fetch(uri);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          onSignatureCapture(base64);
        };
        reader.readAsDataURL(blob);
      }
    } catch (error) {
      console.error("Error capturing signature:", error);
    }
  }, [paths, onSignatureCapture]);

  const hasSignature = paths.length > 0 || currentPath.length > 0;

  return (
    <View style={styles.container}>
      <View 
        style={[styles.signatureBox, { backgroundColor: "#FFFFFF", borderColor: theme.border, height }]}
        ref={containerRef}
        onLayout={(e) => setContainerLayout(e.nativeEvent.layout)}
      >
        <ViewShot 
          ref={viewShotRef} 
          options={{ format: "png", quality: 0.9 }}
          style={StyleSheet.absoluteFill}
        >
          <GestureDetector gesture={panGesture}>
            <View style={StyleSheet.absoluteFill}>
              <Svg style={StyleSheet.absoluteFill}>
                {paths.map((d, index) => (
                  <Path
                    key={index}
                    d={d}
                    stroke="#1a1a2e"
                    strokeWidth={2.5}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
                {currentPath ? (
                  <Path
                    d={currentPath}
                    stroke="#1a1a2e"
                    strokeWidth={2.5}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : null}
              </Svg>
            </View>
          </GestureDetector>
        </ViewShot>
        
        {!hasSignature ? (
          <View style={styles.placeholder} pointerEvents="none">
            <Feather name="edit-2" size={24} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
              Firma qui
            </ThemedText>
          </View>
        ) : null}
      </View>

      <View style={styles.buttonRow}>
        <Pressable
          style={[styles.button, styles.clearButton, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
          onPress={handleClear}
        >
          <Feather name="trash-2" size={16} color={theme.error} />
          <ThemedText type="small" style={{ color: theme.error, marginLeft: Spacing.xs }}>
            Cancella
          </ThemedText>
        </Pressable>
        
        <Pressable
          style={[
            styles.button, 
            styles.confirmButton, 
            { backgroundColor: hasSignature ? theme.primary : theme.border }
          ]}
          onPress={handleConfirm}
          disabled={!hasSignature}
        >
          <Feather name="check" size={16} color="#FFFFFF" />
          <ThemedText type="small" style={{ color: "#FFFFFF", marginLeft: Spacing.xs, fontWeight: "600" }}>
            Conferma Firma
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  signatureBox: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    position: "relative",
  },
  placeholder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  clearButton: {
    borderWidth: 1,
  },
  confirmButton: {},
});
