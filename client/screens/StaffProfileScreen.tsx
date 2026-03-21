import React, { useState, useEffect } from "react";
import { View, StyleSheet, Alert, Pressable, Platform, ActivityIndicator, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface StaffMember {
  id: string;
  userId: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  locationId: string;
  primaryRole: string;
  contractType: string | null;
}

type PrimaryRole = "autista" | "soccorritore" | "infermiere" | "medico" | "coordinatore" | "tirocinante";

const ROLES: { value: PrimaryRole; label: string }[] = [
  { value: "soccorritore", label: "Soccorritore" },
  { value: "autista", label: "Autista" },
  { value: "infermiere", label: "Infermiere" },
  { value: "medico", label: "Medico" },
  { value: "coordinatore", label: "Coordinatore" },
  { value: "tirocinante", label: "Tirocinante" },
];

export default function StaffProfileScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [primaryRole, setPrimaryRole] = useState<PrimaryRole>("soccorritore");

  const { data: existingProfile, isLoading } = useQuery<StaffMember | null>({
    queryKey: user?.id ? [`/api/staff-members/by-user/${user.id}`] : [null],
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (existingProfile) {
      setFirstName(existingProfile.firstName);
      setLastName(existingProfile.lastName);
      setEmail(existingProfile.email || "");
      setPhone(existingProfile.phone || "");
      setPrimaryRole(existingProfile.primaryRole as PrimaryRole);
    }
  }, [existingProfile]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user?.location?.id) throw new Error("Sede non trovata");
      return apiRequest("POST", "/api/staff-members/self-register", {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        primaryRole,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.includes("/api/staff-members");
        }
      });
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert(
        "Profilo salvato",
        "Il tuo profilo personale e stato creato. Ora puoi iscriverti ai turni scoperti.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    },
    onError: (error: Error) => {
      Alert.alert("Errore", error.message || "Impossibile salvare il profilo");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!existingProfile?.id) throw new Error("Profilo non trovato");
      return apiRequest("PATCH", `/api/staff-members/${existingProfile.id}`, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        primaryRole,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.includes("/api/staff-members");
        }
      });
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert("Profilo aggiornato", "Le modifiche sono state salvate.");
    },
    onError: (error: Error) => {
      Alert.alert("Errore", error.message || "Impossibile aggiornare il profilo");
    },
  });

  const handleSave = () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert("Dati mancanti", "Inserisci nome e cognome");
      return;
    }

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    if (existingProfile) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const isLoading2 = createMutation.isPending || updateMutation.isPending;

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.loadingContainer, { paddingTop: headerHeight + Spacing.xl }]}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + Spacing.md, paddingBottom: tabBarHeight + Spacing.xl },
        ]}
      >
        <Card style={styles.infoCard}>
          <Feather name="info" size={20} color={theme.primary} />
          <ThemedText style={{ marginLeft: Spacing.sm, flex: 1 }}>
            {existingProfile
              ? "Modifica i tuoi dati personali per i turni."
              : "Completa il tuo profilo per poterti iscrivere ai turni scoperti."}
          </ThemedText>
        </Card>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <ThemedText type="label" style={styles.label}>Nome *</ThemedText>
            <TextInput
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Inserisci il tuo nome"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="words"
              style={[styles.input, { backgroundColor: theme.cardBackground, color: theme.text, borderColor: theme.border }]}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText type="label" style={styles.label}>Cognome *</ThemedText>
            <TextInput
              value={lastName}
              onChangeText={setLastName}
              placeholder="Inserisci il tuo cognome"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="words"
              style={[styles.input, { backgroundColor: theme.cardBackground, color: theme.text, borderColor: theme.border }]}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText type="label" style={styles.label}>Email</ThemedText>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="esempio@email.com"
              placeholderTextColor={theme.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              style={[styles.input, { backgroundColor: theme.cardBackground, color: theme.text, borderColor: theme.border }]}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText type="label" style={styles.label}>Telefono</ThemedText>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="+39 123 456 7890"
              placeholderTextColor={theme.textSecondary}
              keyboardType="phone-pad"
              style={[styles.input, { backgroundColor: theme.cardBackground, color: theme.text, borderColor: theme.border }]}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText type="label" style={styles.label}>Ruolo principale *</ThemedText>
            <View style={styles.rolesGrid}>
              {ROLES.map((role) => (
                <Pressable
                  key={role.value}
                  style={[
                    styles.roleButton,
                    { 
                      backgroundColor: primaryRole === role.value ? theme.primary : theme.cardBackground,
                      borderColor: primaryRole === role.value ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => {
                    if (Platform.OS !== "web") {
                      Haptics.selectionAsync();
                    }
                    setPrimaryRole(role.value);
                  }}
                >
                  <ThemedText
                    style={{ 
                      color: primaryRole === role.value ? "#fff" : theme.text,
                      fontWeight: primaryRole === role.value ? "600" : "400",
                    }}
                  >
                    {role.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <Pressable
          style={[
            styles.saveButton,
            { backgroundColor: theme.primary },
            isLoading2 && { opacity: 0.6 },
          ]}
          onPress={handleSave}
          disabled={isLoading2}
        >
          {isLoading2 ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Feather name="check" size={20} color="#fff" />
              <ThemedText style={{ color: "#fff", marginLeft: Spacing.sm, fontWeight: "600" }}>
                {existingProfile ? "Salva modifiche" : "Crea profilo"}
              </ThemedText>
            </>
          )}
        </Pressable>
      </KeyboardAwareScrollViewCompat>
    </ThemedView>
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
  content: {
    paddingHorizontal: Spacing.md,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  form: {
    gap: Spacing.md,
  },
  inputGroup: {
    gap: Spacing.xs,
  },
  label: {
    marginLeft: Spacing.xs,
  },
  input: {
    minHeight: 48,
  },
  rolesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  roleButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xl,
  },
});
