import React, { useState, useRef, useCallback } from "react";
import { 
  View, 
  StyleSheet, 
  Pressable, 
  ActivityIndicator, 
  ScrollView, 
  Platform,
  TextInput as RNTextInput,
  Text,
  Dimensions
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useMutation } from "@tanstack/react-query";
import Svg, { Path } from "react-native-svg";
import { GestureDetector, Gesture } from "react-native-gesture-handler";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { getApiUrl } from "@/lib/query-client";

const { width } = Dimensions.get("window");

const AGREEMENT_TEXT = `Il/La sottoscritto/a, consapevole della delicatezza delle informazioni trattate nell'ambito delle attività di trasporto sanitario, si impegna formalmente a:

1. RISERVATEZZA ASSOLUTA
Mantenere la massima riservatezza su tutte le informazioni relative ai pazienti, inclusi dati anagrafici, condizioni di salute, indirizzi e qualsiasi altra informazione personale.

2. DIVIETO DI DIVULGAZIONE  
Non divulgare a terzi, in alcuna forma e con alcun mezzo, informazioni riservate acquisite durante l'attività.

3. PROTEZIONE DEI DATI
Adottare tutte le misure necessarie per proteggere i dati personali e sensibili da accessi non autorizzati.

4. UTILIZZO APPROPRIATO
Utilizzare le informazioni esclusivamente per le finalità connesse al servizio prestato.

5. SEGNALAZIONE VIOLAZIONI
Segnalare immediatamente eventuali violazioni dei dati al responsabile di sede.

La violazione degli obblighi di riservatezza può comportare sanzioni disciplinari, civili e penali ai sensi del GDPR.`;

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  staffType: string;
  role: string;
  locationId: string;
}

interface Location {
  id: string;
  name: string;
}

const STAFF_TYPES = [
  { value: "volontario", label: "Volontario" },
  { value: "dipendente", label: "Dipendente" },
  { value: "collaboratore", label: "Collaboratore" },
];

const ROLES = [
  { value: "autista", label: "Autista" },
  { value: "soccorritore", label: "Soccorritore" },
  { value: "infermiere", label: "Infermiere" },
  { value: "altro", label: "Altro" },
];

interface Point {
  x: number;
  y: number;
}

function SimpleSignaturePad({ 
  onSignatureReady, 
  height = 160 
}: { 
  onSignatureReady: (hasSignature: boolean, paths: string[]) => void;
  height?: number;
}) {
  const [paths, setPaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>("");
  const pointsRef = useRef<Point[]>([]);

  const pathToSvg = (points: Point[]): string => {
    if (points.length === 0) return "";
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }
    return d;
  };

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
        const newPaths = [...paths, currentPath];
        setPaths(newPaths);
        onSignatureReady(true, newPaths);
      }
      setCurrentPath("");
      pointsRef.current = [];
    })
    .minDistance(1)
    .runOnJS(true);

  const handleClear = () => {
    setPaths([]);
    setCurrentPath("");
    onSignatureReady(false, []);
  };

  const hasSignature = paths.length > 0 || currentPath.length > 0;

  return (
    <View style={sigStyles.container}>
      <View style={[sigStyles.signatureBox, { height }]}>
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
        
        {!hasSignature ? (
          <View style={sigStyles.placeholder}>
            <Feather name="edit-2" size={20} color="#9CA3AF" />
            <Text style={sigStyles.placeholderText}>Firma qui</Text>
          </View>
        ) : null}
      </View>

      <Pressable style={sigStyles.clearButton} onPress={handleClear}>
        <Feather name="trash-2" size={14} color="#DC2626" />
        <Text style={sigStyles.clearButtonText}>Cancella</Text>
      </Pressable>
    </View>
  );
}

const sigStyles = StyleSheet.create({
  container: {
    gap: 10,
  },
  signatureBox: {
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#D1D5DB",
    borderRadius: 10,
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
    pointerEvents: "none",
  },
  placeholderText: {
    fontSize: 13,
    color: "#9CA3AF",
    marginTop: 6,
  },
  clearButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    backgroundColor: "#FEF2F2",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  clearButtonText: {
    fontSize: 13,
    color: "#DC2626",
    fontWeight: "500",
  },
});

export default function PublicConfidentialityScreen() {
  const insets = useSafeAreaInsets();
  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    staffType: "",
    role: "",
    locationId: "",
  });
  const [locations, setLocations] = useState<Location[]>([]);
  const [hasSignature, setHasSignature] = useState(false);
  const signaturePathsRef = useRef<string[]>([]);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedGdpr, setAcceptedGdpr] = useState(false);
  const [acceptedNoDisclosure, setAcceptedNoDisclosure] = useState(false);
  const [acceptedNoPhotos, setAcceptedNoPhotos] = useState(false);
  const [acceptedDataProtection, setAcceptedDataProtection] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch locations on mount
  React.useEffect(() => {
    fetch(new URL("/api/public/confidentiality/locations", getApiUrl()).toString())
      .then(res => res.json())
      .then(data => setLocations(data || []))
      .catch(err => console.error("Error loading locations:", err));
  }, []);

  const createSignatureSvgDataUrl = (paths: string[], w: number, h: number): string => {
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <rect width="${w}" height="${h}" fill="white"/>
      ${paths.map(d => `<path d="${d}" stroke="#1a1a2e" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}
    </svg>`;
    return `data:image/svg+xml;base64,${btoa(svgContent)}`;
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const signatureDataUrl = createSignatureSvgDataUrl(signaturePathsRef.current, 300, 160);
      
      const response = await fetch(new URL("/api/public/confidentiality/sign", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email || null,
          phone: formData.phone || null,
          staffType: formData.staffType,
          role: formData.role || null,
          locationId: formData.locationId || null,
          signatureDataUrl,
          acceptedTerms: true,
          acceptedGdpr: true,
          acceptedNoDisclosure: true,
          acceptedNoPhotos: true,
          acceptedDataProtection: true,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Errore durante l'invio");
      }
      return response.json();
    },
    onSuccess: () => {
      setSuccess(true);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleSubmit = () => {
    setError(null);
    if (!formData.firstName || !formData.lastName) {
      setError("Nome e Cognome sono obbligatori");
      return;
    }
    if (!formData.staffType) {
      setError("Seleziona il tuo ruolo (Volontario/Dipendente/Collaboratore)");
      return;
    }
    if (!acceptedTerms || !acceptedGdpr || !acceptedNoDisclosure || !acceptedNoPhotos || !acceptedDataProtection) {
      setError("Tutti i consensi sono obbligatori");
      return;
    }
    if (!hasSignature) {
      setError("La firma è obbligatoria - disegna la tua firma nel riquadro");
      return;
    }
    submitMutation.mutate();
  };

  const handleSignatureReady = (hasSig: boolean, paths: string[]) => {
    setHasSignature(hasSig);
    signaturePathsRef.current = paths;
  };

  const haptic = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  if (success) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>SOCCORSO DIGITALE</Text>
          <Text style={styles.headerSubtitle}>Impegno alla Riservatezza</Text>
        </View>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Feather name="check-circle" size={72} color="#10B981" />
          </View>
          <Text style={styles.successTitle}>Grazie!</Text>
          <Text style={styles.successText}>L'impegno alla riservatezza è stato firmato con successo.</Text>
          {formData.email ? (
            <Text style={styles.successSubtext}>Riceverai una copia via email a {formData.email}</Text>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SOCCORSO DIGITALE</Text>
        <Text style={styles.headerSubtitle}>Impegno alla Riservatezza</Text>
      </View>

      <KeyboardAwareScrollViewCompat 
        style={styles.scrollView} 
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      >
        {error ? (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={16} color="#DC2626" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Testo dell'Impegno</Text>
          <View style={styles.agreementBox}>
            <ScrollView style={styles.agreementScroll} nestedScrollEnabled showsVerticalScrollIndicator>
              <Text style={styles.agreementText}>{AGREEMENT_TEXT}</Text>
            </ScrollView>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dati Personali</Text>
          
          <View style={styles.fieldRow}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Nome *</Text>
              <RNTextInput
                style={styles.fieldInput}
                value={formData.firstName}
                onChangeText={(t) => setFormData(p => ({ ...p, firstName: t }))}
                placeholder="Mario"
                placeholderTextColor="#9CA3AF"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Cognome *</Text>
              <RNTextInput
                style={styles.fieldInput}
                value={formData.lastName}
                onChangeText={(t) => setFormData(p => ({ ...p, lastName: t }))}
                placeholder="Rossi"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Email</Text>
              <RNTextInput
                style={styles.fieldInput}
                value={formData.email}
                onChangeText={(t) => setFormData(p => ({ ...p, email: t }))}
                placeholder="email@esempio.it"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Telefono</Text>
              <RNTextInput
                style={styles.fieldInput}
                value={formData.phone}
                onChangeText={(t) => setFormData(p => ({ ...p, phone: t }))}
                placeholder="333 1234567"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
              />
            </View>
          </View>

        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tipologia *</Text>
          <View style={styles.chipRow}>
            {STAFF_TYPES.map((type) => (
              <Pressable
                key={type.value}
                style={[styles.chip, formData.staffType === type.value && styles.chipActive]}
                onPress={() => { haptic(); setFormData(p => ({ ...p, staffType: type.value })); }}
              >
                <Text style={[styles.chipText, formData.staffType === type.value && styles.chipTextActive]}>
                  {type.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mansione</Text>
          <View style={styles.chipRow}>
            {ROLES.map((role) => (
              <Pressable
                key={role.value}
                style={[styles.chipSmall, formData.role === role.value && styles.chipSmallActive]}
                onPress={() => { haptic(); setFormData(p => ({ ...p, role: role.value })); }}
              >
                <Text style={[styles.chipSmallText, formData.role === role.value && styles.chipSmallTextActive]}>
                  {role.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sede di Appartenenza</Text>
          <View style={styles.chipRow}>
            {locations.map((loc) => (
              <Pressable
                key={loc.id}
                style={[styles.chipSmall, formData.locationId === loc.id && styles.chipSmallActive]}
                onPress={() => { haptic(); setFormData(p => ({ ...p, locationId: loc.id })); }}
              >
                <Text style={[styles.chipSmallText, formData.locationId === loc.id && styles.chipSmallTextActive]}>
                  {loc.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Consensi Obbligatori</Text>
          
          <CheckItem checked={acceptedTerms} onPress={() => { haptic(); setAcceptedTerms(!acceptedTerms); }}>
            Ho letto e compreso l'impegno alla riservatezza
          </CheckItem>
          <CheckItem checked={acceptedGdpr} onPress={() => { haptic(); setAcceptedGdpr(!acceptedGdpr); }}>
            Acconsento al trattamento dati ai sensi del GDPR
          </CheckItem>
          <CheckItem checked={acceptedNoDisclosure} onPress={() => { haptic(); setAcceptedNoDisclosure(!acceptedNoDisclosure); }}>
            Mi impegno a non divulgare informazioni riservate
          </CheckItem>
          <CheckItem checked={acceptedNoPhotos} onPress={() => { haptic(); setAcceptedNoPhotos(!acceptedNoPhotos); }}>
            Mi impegno a non fotografare/registrare dati personali
          </CheckItem>
          <CheckItem checked={acceptedDataProtection} onPress={() => { haptic(); setAcceptedDataProtection(!acceptedDataProtection); }}>
            Mi impegno a proteggere i dati trattati
          </CheckItem>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Firma</Text>
          <Text style={styles.signatureHint}>Disegna la tua firma nel riquadro sottostante</Text>
          <View style={styles.signatureWrapper}>
            <SimpleSignaturePad
              onSignatureReady={handleSignatureReady}
              height={160}
            />
          </View>
          {hasSignature ? (
            <View style={styles.signatureConfirmed}>
              <Feather name="check-circle" size={14} color="#10B981" />
              <Text style={styles.signatureConfirmedText}>Firma inserita</Text>
            </View>
          ) : null}
        </View>

        <Pressable
          style={[styles.submitBtn, submitMutation.isPending && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitMutation.isPending}
        >
          {submitMutation.isPending ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <>
              <Feather name="check" size={20} color="#FFF" />
              <Text style={styles.submitBtnText}>Firma e Invia</Text>
            </>
          )}
        </Pressable>

        <Text style={styles.footer}>
          Soccorso Digitale{"\n"}
          Piattaforma Gestione Trasporti Sanitari
        </Text>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

function CheckItem({ checked, onPress, children }: { checked: boolean; onPress: () => void; children: string }) {
  return (
    <Pressable style={[styles.checkItem, checked && styles.checkItemActive]} onPress={onPress}>
      <View style={[styles.checkBox, checked && styles.checkBoxActive]}>
        {checked ? <Feather name="check" size={12} color="#FFF" /> : null}
      </View>
      <Text style={styles.checkText}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  header: {
    backgroundColor: "#0066CC",
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFF",
    letterSpacing: 2,
  },
  headerAddress: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    marginTop: 6,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    maxWidth: 500,
    alignSelf: "center",
    width: "100%",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    color: "#DC2626",
    fontSize: 13,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  agreementBox: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  agreementScroll: {
    maxHeight: 180,
    padding: 14,
  },
  agreementText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#4B5563",
  },
  fieldRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  field: {
    flex: 1,
  },
  fieldSingle: {
    marginBottom: 0,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6B7280",
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: "#111827",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  chipActive: {
    backgroundColor: "#0066CC",
    borderColor: "#0066CC",
  },
  chipText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  chipTextActive: {
    color: "#FFF",
  },
  chipSmall: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  chipSmallActive: {
    backgroundColor: "#EBF5FF",
    borderColor: "#0066CC",
  },
  chipSmallText: {
    fontSize: 13,
    color: "#6B7280",
  },
  chipSmallTextActive: {
    color: "#0066CC",
    fontWeight: "500",
  },
  checkItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
    marginBottom: 8,
  },
  checkItemActive: {
    backgroundColor: "#EBF5FF",
    borderColor: "#93C5FD",
  },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  checkBoxActive: {
    backgroundColor: "#0066CC",
    borderColor: "#0066CC",
  },
  checkText: {
    flex: 1,
    fontSize: 13,
    color: "#374151",
    lineHeight: 18,
  },
  signatureWrapper: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
    overflow: "hidden",
  },
  signatureHint: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 10,
  },
  signatureConfirmed: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  signatureConfirmedText: {
    fontSize: 13,
    color: "#10B981",
    fontWeight: "500",
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#0066CC",
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 8,
  },
  submitBtnDisabled: {
    backgroundColor: "#9CA3AF",
  },
  submitBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  footer: {
    textAlign: "center",
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 24,
    lineHeight: 16,
  },
  successContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  successIcon: {
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#10B981",
    marginBottom: 12,
  },
  successText: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
  },
  successSubtext: {
    fontSize: 14,
    color: "#9CA3AF",
    marginTop: 12,
  },
});
