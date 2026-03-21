import React, { useState } from "react";
import { View, StyleSheet, Pressable, Alert, ActivityIndicator, ScrollView, Platform, TextInput as RNTextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { TextInput } from "@/components/TextInput";
import { Card } from "@/components/Card";
import { SignaturePad } from "@/components/SignaturePad";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";

interface Location {
  id: string;
  name: string;
}

interface ConfidentialityStatus {
  hasSigned: boolean;
  agreement: any;
  agreementText: string;
  agreementVersion: string;
  locations: Location[];
}

interface CheckboxItemProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
  required?: boolean;
}

function CheckboxItem({ label, checked, onToggle, required = true }: CheckboxItemProps) {
  const { theme, isDark } = useTheme();

  return (
    <Pressable 
      style={[styles.checkboxRow, { backgroundColor: isDark ? "#1A2744" : "#F8FAFC", borderColor: checked ? theme.primary : theme.border }]}
      onPress={() => {
        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onToggle();
      }}
    >
      <View style={[styles.checkbox, { borderColor: checked ? theme.primary : theme.border, backgroundColor: checked ? theme.primary : "transparent" }]}>
        {checked ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
      </View>
      <ThemedText style={styles.checkboxLabel}>
        {label}
        {required ? <ThemedText style={{ color: theme.error }}> *</ThemedText> : null}
      </ThemedText>
    </Pressable>
  );
}

interface StaffTypeOption {
  value: string;
  label: string;
}

const STAFF_TYPES: StaffTypeOption[] = [
  { value: "autista_soccorritore", label: "Autista Soccorritore" },
  { value: "soccorritore", label: "Soccorritore" },
  { value: "infermiere", label: "Infermiere" },
];

function StaffTypeSelector({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const { theme, isDark } = useTheme();
  
  return (
    <View style={styles.selectorRow}>
      {STAFF_TYPES.map((option) => (
        <Pressable
          key={option.value}
          style={[
            styles.selectorOption,
            { 
              backgroundColor: value === option.value ? theme.primary : (isDark ? "#1A2744" : "#F8FAFC"),
              borderColor: value === option.value ? theme.primary : theme.border,
            }
          ]}
          onPress={() => {
            if (Platform.OS !== "web") {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            onChange(option.value);
          }}
        >
          <ThemedText style={[styles.selectorText, { color: value === option.value ? "#FFFFFF" : theme.text }]}>
            {option.label}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

export default function ConfidentialityAgreementScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [fiscalCode, setFiscalCode] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [staffType, setStaffType] = useState<string>("autista_soccorritore");
  const [role, setRole] = useState("");
  const [locationId, setLocationId] = useState<string>("");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string>("");
  
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedGdpr, setAcceptedGdpr] = useState(false);
  const [acceptedNoDisclosure, setAcceptedNoDisclosure] = useState(false);
  const [acceptedNoPhotos, setAcceptedNoPhotos] = useState(false);
  const [acceptedDataProtection, setAcceptedDataProtection] = useState(false);

  const { data: status, isLoading, error } = useQuery<ConfidentialityStatus>({
    queryKey: ["/api/confidentiality/status"],
  });

  const signMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = new URL("/api/confidentiality/sign", getApiUrl());
      return apiRequest("POST", url.toString(), data);
    },
    onSuccess: () => {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/confidentiality/status"] });
      Alert.alert(
        "Firma Completata",
        "Grazie per aver firmato l'impegno alla riservatezza. Ora puoi utilizzare l'applicazione.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    },
    onError: (error: any) => {
      Alert.alert("Errore", error.message || "Si è verificato un errore durante la firma");
    },
  });

  const handleSignatureCapture = (base64: string) => {
    setSignatureDataUrl(base64);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleClearSignature = () => {
    setSignatureDataUrl("");
  };

  const allCheckboxesAccepted = acceptedTerms && acceptedGdpr && acceptedNoDisclosure && acceptedNoPhotos && acceptedDataProtection;
  const isFormValid = firstName.trim() && lastName.trim() && staffType && signatureDataUrl && allCheckboxesAccepted;

  const handleSubmit = () => {
    if (!isFormValid) {
      Alert.alert("Attenzione", "Compila tutti i campi obbligatori, accetta tutte le condizioni e firma il documento");
      return;
    }

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    signMutation.mutate({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      fiscalCode: fiscalCode.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      staffType,
      role: role.trim() || null,
      locationId: locationId || null,
      signatureDataUrl,
      acceptedTerms,
      acceptedGdpr,
      acceptedNoDisclosure,
      acceptedNoPhotos,
      acceptedDataProtection,
    });
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText style={{ marginTop: Spacing.md }}>Caricamento...</ThemedText>
      </ThemedView>
    );
  }

  if (status?.hasSigned) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top + Spacing.xl }]}>
        <Animated.View entering={FadeInUp.duration(500)} style={styles.successContainer}>
          <View style={[styles.successIcon, { backgroundColor: theme.success + "20" }]}>
            <Feather name="check-circle" size={64} color={theme.success} />
          </View>
          <ThemedText type="h2" style={styles.successTitle}>
            Impegno Già Firmato
          </ThemedText>
          <ThemedText type="body" style={[styles.successText, { color: theme.textSecondary }]}>
            Hai già firmato l'impegno alla riservatezza in data{" "}
            {new Date(status.agreement.signatureTimestamp).toLocaleDateString("it-IT")}
          </ThemedText>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
            onPress={() => navigation.goBack()}
          >
            <ThemedText style={{ color: "#FFFFFF", fontWeight: "600" }}>Torna Indietro</ThemedText>
          </Pressable>
        </Animated.View>
      </ThemedView>
    );
  }

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.xl + 20, paddingBottom: insets.bottom + 150 }]}
    >
      <Animated.View entering={FadeInDown.duration(400)}>
        <View style={styles.header}>
          <View style={[styles.headerIcon, { backgroundColor: theme.primary + "15" }]}>
            <Feather name="shield" size={32} color={theme.primary} />
          </View>
          <ThemedText type="h2" style={styles.title}>
            Impegno alla Riservatezza
          </ThemedText>
          <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
            Prima di utilizzare l'applicazione, è necessario leggere e firmare l'impegno alla riservatezza
          </ThemedText>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(400).delay(100)}>
        <Card style={styles.agreementCard}>
          <View style={styles.agreementHeader}>
            <Feather name="file-text" size={20} color={theme.primary} />
            <ThemedText type="h3" style={{ marginLeft: Spacing.sm }}>
              Documento da Firmare
            </ThemedText>
          </View>
          <View style={[styles.agreementScrollContainer, { borderColor: theme.border }]}>
            <ScrollView 
              style={[styles.agreementScroll, { backgroundColor: isDark ? "#0D1829" : "#F8FAFC" }]} 
              nestedScrollEnabled
              showsVerticalScrollIndicator={true}
              indicatorStyle={isDark ? "white" : "black"}
              persistentScrollbar={true}
            >
              <ThemedText style={styles.agreementText}>
                {status?.agreementText || "Caricamento..."}
              </ThemedText>
            </ScrollView>
            <Animated.View 
              entering={FadeInDown.delay(500).duration(300)}
              style={[styles.scrollHint, { backgroundColor: theme.primary + "30" }]}
            >
              <Feather name="chevrons-down" size={18} color={theme.primary} />
              <ThemedText type="small" style={{ color: theme.primary, marginLeft: 6, fontWeight: "600" }}>
                Scorri verso il basso per leggere tutto il documento
              </ThemedText>
              <Feather name="chevrons-down" size={18} color={theme.primary} />
            </Animated.View>
          </View>
          <ThemedText type="small" style={[styles.versionText, { color: theme.textSecondary }]}>
            Versione: {status?.agreementVersion || "1.0"}
          </ThemedText>
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(400).delay(200)}>
        <Card style={styles.formCard}>
          <View style={styles.sectionHeader}>
            <Feather name="user" size={20} color={theme.primary} />
            <ThemedText type="h3" style={{ marginLeft: Spacing.sm }}>
              Dati del Firmatario
            </ThemedText>
          </View>

          <View style={styles.formRow}>
            <View style={styles.formField}>
              <TextInput
                label="Nome *"
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Inserisci nome"
              />
            </View>
            <View style={styles.formField}>
              <TextInput
                label="Cognome *"
                value={lastName}
                onChangeText={setLastName}
                placeholder="Inserisci cognome"
              />
            </View>
          </View>

          <View style={styles.formField}>
            <TextInput
              label="Codice Fiscale"
              value={fiscalCode}
              onChangeText={setFiscalCode}
              placeholder="RSSMRA80A01H501Z"
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.formRow}>
            <View style={styles.formField}>
              <TextInput
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="email@esempio.it"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.formField}>
              <TextInput
                label="Telefono"
                value={phone}
                onChangeText={setPhone}
                placeholder="+39 333 1234567"
                keyboardType="phone-pad"
              />
            </View>
          </View>

          <View style={styles.formField}>
            <ThemedText type="small" style={styles.label}>Tipologia Rapporto *</ThemedText>
            <StaffTypeSelector value={staffType} onChange={setStaffType} />
          </View>

          <View style={styles.formField}>
            <TextInput
              label="Ruolo"
              value={role}
              onChangeText={setRole}
              placeholder="Es: Autista, Soccorritore, Infermiere"
            />
          </View>

          {status?.locations && status.locations.length > 0 ? (
            <View style={styles.formField}>
              <ThemedText type="small" style={styles.label}>Sede di Appartenenza</ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.locationsScroll}>
                <View style={styles.selectorRow}>
                  <Pressable
                    style={[
                      styles.selectorOption,
                      { 
                        backgroundColor: !locationId ? theme.primary : (isDark ? "#1A2744" : "#F8FAFC"),
                        borderColor: !locationId ? theme.primary : theme.border,
                      }
                    ]}
                    onPress={() => setLocationId("")}
                  >
                    <ThemedText style={[styles.selectorText, { color: !locationId ? "#FFFFFF" : theme.text }]}>
                      Nessuna
                    </ThemedText>
                  </Pressable>
                  {status.locations.map((loc) => (
                    <Pressable
                      key={loc.id}
                      style={[
                        styles.selectorOption,
                        { 
                          backgroundColor: locationId === loc.id ? theme.primary : (isDark ? "#1A2744" : "#F8FAFC"),
                          borderColor: locationId === loc.id ? theme.primary : theme.border,
                        }
                      ]}
                      onPress={() => {
                        if (Platform.OS !== "web") {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }
                        setLocationId(loc.id);
                      }}
                    >
                      <ThemedText style={[styles.selectorText, { color: locationId === loc.id ? "#FFFFFF" : theme.text }]}>
                        {loc.name}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>
          ) : null}
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(400).delay(300)}>
        <Card style={styles.formCard}>
          <View style={styles.sectionHeader}>
            <Feather name="check-square" size={20} color={theme.primary} />
            <ThemedText type="h3" style={{ marginLeft: Spacing.sm }}>
              Accettazione Condizioni
            </ThemedText>
          </View>
          <ThemedText type="small" style={[styles.requiredNote, { color: theme.textSecondary }]}>
            Tutti i consensi sono obbligatori per procedere
          </ThemedText>

          <View style={styles.checkboxList}>
            <CheckboxItem
              label="Dichiaro di aver letto e compreso integralmente il contenuto del presente impegno"
              checked={acceptedTerms}
              onToggle={() => setAcceptedTerms(!acceptedTerms)}
            />
            <CheckboxItem
              label="Accetto l'informativa sulla privacy ai sensi del GDPR (Reg. UE 2016/679)"
              checked={acceptedGdpr}
              onToggle={() => setAcceptedGdpr(!acceptedGdpr)}
            />
            <CheckboxItem
              label="Mi impegno a non divulgare a terzi i dati personali dei pazienti"
              checked={acceptedNoDisclosure}
              onToggle={() => setAcceptedNoDisclosure(!acceptedNoDisclosure)}
            />
            <CheckboxItem
              label="Mi impegno a non effettuare foto, screenshot o registrazioni dell'app"
              checked={acceptedNoPhotos}
              onToggle={() => setAcceptedNoPhotos(!acceptedNoPhotos)}
            />
            <CheckboxItem
              label="Mi impegno a proteggere i dati personali secondo le normative vigenti"
              checked={acceptedDataProtection}
              onToggle={() => setAcceptedDataProtection(!acceptedDataProtection)}
            />
          </View>
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(400).delay(400)}>
        <Card style={styles.formCard}>
          <View style={styles.sectionHeader}>
            <Feather name="edit-3" size={20} color={theme.primary} />
            <ThemedText type="h3" style={{ marginLeft: Spacing.sm }}>
              Firma Digitale
            </ThemedText>
          </View>
          <ThemedText type="small" style={[styles.signatureNote, { color: theme.textSecondary }]}>
            Utilizza il dito per firmare nell'area sottostante
          </ThemedText>

          <SignaturePad
            onSignatureCapture={handleSignatureCapture}
            onClear={handleClearSignature}
            height={180}
          />

          {signatureDataUrl ? (
            <View style={[styles.signatureConfirmed, { backgroundColor: theme.success + "10", borderColor: theme.success }]}>
              <Feather name="check-circle" size={18} color={theme.success} />
              <ThemedText style={{ color: theme.success, marginLeft: Spacing.sm, fontWeight: "500" }}>
                Firma acquisita correttamente
              </ThemedText>
            </View>
          ) : null}
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(400).delay(500)}>
        <Pressable
          style={[
            styles.submitButton,
            { backgroundColor: isFormValid ? theme.primary : theme.border }
          ]}
          onPress={handleSubmit}
          disabled={!isFormValid || signMutation.isPending}
        >
          {signMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Feather name="send" size={20} color="#FFFFFF" />
              <ThemedText style={styles.submitButtonText}>
                Firma e Conferma
              </ThemedText>
            </>
          )}
        </Pressable>

        {!allCheckboxesAccepted ? (
          <ThemedText type="small" style={[styles.warningText, { color: theme.warning }]}>
            Devi accettare tutte le condizioni per procedere
          </ThemedText>
        ) : null}
      </Animated.View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  successContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  successIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  successTitle: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  successText: {
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  headerIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    textAlign: "center",
    paddingHorizontal: Spacing.lg,
  },
  agreementCard: {
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
  },
  agreementHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  agreementScrollContainer: {
    borderWidth: 2,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    overflow: "hidden",
  },
  agreementScroll: {
    maxHeight: 280,
    padding: Spacing.md,
  },
  scrollHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
    gap: 4,
  },
  agreementText: {
    fontSize: 12,
    lineHeight: 18,
  },
  versionText: {
    textAlign: "right",
  },
  formCard: {
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  formRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  formField: {
    flex: 1,
    marginBottom: Spacing.md,
  },
  label: {
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  selectorRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  selectorOption: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  selectorText: {
    fontSize: 14,
    fontWeight: "500",
  },
  locationsScroll: {
    marginTop: Spacing.xs,
  },
  requiredNote: {
    marginBottom: Spacing.lg,
  },
  checkboxList: {
    gap: Spacing.sm,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
    marginTop: 2,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  signatureNote: {
    marginBottom: Spacing.lg,
  },
  signatureConfirmed: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  warningText: {
    textAlign: "center",
    marginTop: Spacing.md,
  },
  primaryButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
  },
});
