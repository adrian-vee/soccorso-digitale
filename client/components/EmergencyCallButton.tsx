import React, { useState } from "react";
import { View, Pressable, StyleSheet, Linking, Platform, Alert, Modal } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

const EMERGENCY_NUMBER = "118";

export default function EmergencyCallButton() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [showConfirm, setShowConfirm] = useState(false);

  const handlePress = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    setShowConfirm(true);
  };

  const handleCall = async () => {
    setShowConfirm(false);
    
    const phoneUrl = Platform.select({
      ios: `tel:${EMERGENCY_NUMBER}`,
      android: `tel:${EMERGENCY_NUMBER}`,
      default: `tel:${EMERGENCY_NUMBER}`,
    });

    try {
      const canOpen = await Linking.canOpenURL(phoneUrl);
      if (canOpen) {
        await Linking.openURL(phoneUrl);
      } else {
        Alert.alert("Errore", "Impossibile effettuare la chiamata su questo dispositivo");
      }
    } catch (error) {
      Alert.alert("Errore", "Impossibile effettuare la chiamata");
    }
  };

  const handleCancel = () => {
    setShowConfirm(false);
  };

  return (
    <>
      <Pressable
        style={[
          styles.button,
          {
            top: insets.top + 8,
            right: 16,
          },
        ]}
        onPress={handlePress}
      >
        <View style={styles.buttonInner}>
          <Feather name="phone" size={14} color="#FFFFFF" />
          <ThemedText style={styles.buttonText}>Chiama 118</ThemedText>
        </View>
      </Pressable>

      <Modal
        visible={showConfirm}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.iconContainer}>
              <View style={styles.emergencyIcon}>
                <Feather name="phone-call" size={32} color="#FFFFFF" />
              </View>
            </View>
            
            <ThemedText type="h2" style={styles.title}>
              Chiamata Emergenza
            </ThemedText>
            
            <ThemedText type="body" style={[styles.message, { color: theme.textSecondary }]}>
              Stai per chiamare il 118.{"\n"}Confermi la chiamata?
            </ThemedText>

            <View style={styles.buttonRow}>
              <Pressable
                style={[styles.modalButton, styles.cancelButton, { borderColor: theme.border }]}
                onPress={handleCancel}
              >
                <ThemedText type="body" style={{ fontWeight: "600" }}>
                  Annulla
                </ThemedText>
              </Pressable>

              <Pressable
                style={[styles.modalButton, styles.callButton]}
                onPress={handleCall}
              >
                <Feather name="phone" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                  Chiama 118
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    backgroundColor: "#DC2626",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalContent: {
    width: "100%",
    maxWidth: 340,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: "center",
  },
  iconContainer: {
    marginBottom: Spacing.lg,
  },
  emergencyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  message: {
    textAlign: "center",
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  buttonRow: {
    flexDirection: "row",
    gap: Spacing.md,
    width: "100%",
  },
  modalButton: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  cancelButton: {
    borderWidth: 1,
  },
  callButton: {
    backgroundColor: "#DC2626",
  },
});
