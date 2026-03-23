import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

const W3W_PATTERN = /^[a-z]+\.[a-z]+\.[a-z]+$/i;

interface What3WordsInputProps {
  onResolve: (
    coords: { lat: number; lng: number },
    address: string,
    w3wAddress: string
  ) => void;
}

export function What3WordsInput({ onResolve }: What3WordsInputProps) {
  const { theme, isDark } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [words, setWords] = useState("");
  const [isResolving, setIsResolving] = useState(false);

  const isValid = W3W_PATTERN.test(words.trim());

  const handleOpen = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setModalVisible(true);
  };

  const handleClose = () => {
    setModalVisible(false);
    setWords("");
  };

  const handleResolve = async () => {
    if (!isValid) return;
    setIsResolving(true);
    try {
      const res = await apiRequest("POST", "/api/providers/geo/w3w", {
        words: words.trim().toLowerCase(),
      });
      const json = await res.json();

      if (json.data?.lat && json.data?.lng) {
        const label = json.data.nearestPlace
          ? `///${words.trim()} (${json.data.nearestPlace})`
          : `///${words.trim()}`;
        onResolve({ lat: json.data.lat, lng: json.data.lng }, label, `///${words.trim()}`);
        handleClose();
      } else {
        Alert.alert("Non trovato", "Verifica le tre parole e riprova.");
      }
    } catch {
      Alert.alert("Errore", "Servizio W3W non disponibile. Riprova.");
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <>
      <Pressable
        onPress={handleOpen}
        style={[
          styles.chip,
          {
            backgroundColor: isDark
              ? "rgba(77,163,255,0.12)"
              : "rgba(0,102,204,0.08)",
            borderColor: theme.primary + "50",
          },
        ]}
      >
        <ThemedText
          style={{
            color: theme.primary,
            fontWeight: "700",
            fontSize: 13,
            letterSpacing: -0.3,
          }}
        >
          ///W3W
        </ThemedText>
      </Pressable>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <Pressable style={styles.overlay} onPress={handleClose}>
          <View
            style={[styles.modal, { backgroundColor: theme.backgroundDefault }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <ThemedText type="h3">What3Words</ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, marginTop: 2 }}
                >
                  Es: ///fumo.casa.sole
                </ThemedText>
              </View>
              <Pressable onPress={handleClose} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <Feather name="x" size={22} color={theme.textSecondary} />
              </Pressable>
            </View>

            <View
              style={[
                styles.inputWrap,
                {
                  backgroundColor: theme.inputBackground,
                  borderColor: isValid ? theme.primary : theme.border,
                },
              ]}
            >
              <ThemedText
                style={{
                  color: theme.primary,
                  fontWeight: "700",
                  fontSize: 18,
                  marginRight: 2,
                }}
              >
                ///
              </ThemedText>
              <TextInput
                style={[styles.input, { color: theme.text }]}
                value={words}
                onChangeText={(t) =>
                  setWords(t.replace(/^\/+/, "").toLowerCase())
                }
                placeholder="parola.parola.parola"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleResolve}
              />
            </View>

            <Pressable
              onPress={handleResolve}
              disabled={!isValid || isResolving}
              style={[
                styles.resolveBtn,
                {
                  backgroundColor: isValid ? theme.primary : theme.border,
                  opacity: isValid ? 1 : 0.6,
                },
              ]}
            >
              {isResolving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="map-pin" size={16} color="#FFFFFF" />
                  <ThemedText
                    style={{ color: "#FFFFFF", fontWeight: "600", marginLeft: 6 }}
                  >
                    Usa questo indirizzo
                  </ThemedText>
                </>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modal: {
    width: "100%",
    maxWidth: 420,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 52,
  },
  input: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  resolveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    minHeight: 48,
  },
});
