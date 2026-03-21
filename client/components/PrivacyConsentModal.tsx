import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Dimensions,
  Linking,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

const { width, height } = Dimensions.get("window");
const PRIVACY_CONSENT_KEY = "privacy_consent_v2";

interface PrivacyConsentModalProps {
  onAccept: () => void;
}

export function PrivacyConsentModal({ onAccept }: PrivacyConsentModalProps) {
  const [visible, setVisible] = useState(false);
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  useEffect(() => {
    checkConsentStatus();
  }, []);

  const checkConsentStatus = async () => {
    try {
      const consent = await AsyncStorage.getItem(PRIVACY_CONSENT_KEY);
      if (!consent) {
        setVisible(true);
      } else {
        onAccept();
      }
    } catch (error) {
      setVisible(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    try {
      const timestamp = new Date().toISOString();
      await AsyncStorage.setItem(PRIVACY_CONSENT_KEY, JSON.stringify({
        accepted: true,
        timestamp,
        version: "2.0.0",
      }));
      setVisible(false);
      onAccept();
    } catch (error) {
      console.error("Error saving privacy consent:", error);
    }
  };

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isEndReached = layoutMeasurement.height + contentOffset.y >= contentSize.height - 50;
    if (isEndReached && !hasScrolledToEnd) {
      setHasScrolledToEnd(true);
    }
  };

  const openPrivacyPolicy = () => {
    const baseUrl = process.env.EXPO_PUBLIC_DOMAIN || "";
    const protocol = baseUrl.includes("localhost") ? "http" : "https";
    Linking.openURL(`${protocol}://${baseUrl}/privacy`);
  };

  if (isLoading) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={[
          styles.container,
          {
            backgroundColor: theme.backgroundRoot,
            marginTop: insets.top + Spacing.lg,
            marginBottom: insets.bottom + Spacing.lg,
          }
        ]}>
          <LinearGradient
            colors={["#0066CC", "#004D99"]}
            style={styles.header}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.headerContent}>
              <View style={styles.logoContainer}>
                <Feather name="shield" size={36} color="#FFFFFF" />
              </View>
              <View style={styles.headerTextContainer}>
                <ThemedText type="h2" style={styles.headerTitle}>
                  Informativa Privacy
                </ThemedText>
                <ThemedText type="small" style={styles.headerSubtitle}>
                  Soccorso Digitale
                </ThemedText>
              </View>
            </View>
          </LinearGradient>

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={true}
          >
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIcon, { backgroundColor: "#0066CC15" }]}>
                  <Feather name="shield" size={20} color="#0066CC" />
                </View>
                <ThemedText type="h3" style={styles.sectionTitle}>
                  Protezione dei Tuoi Dati
                </ThemedText>
              </View>
              <ThemedText type="body" style={[styles.paragraph, { color: theme.textSecondary }]}>
                La tua privacy è importante per noi. Questa applicazione raccoglie e tratta i tuoi dati personali in conformità al Regolamento UE 2016/679 (GDPR) e alla normativa italiana vigente.
              </ThemedText>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIcon, { backgroundColor: "#00A65115" }]}>
                  <Feather name="database" size={20} color="#00A651" />
                </View>
                <ThemedText type="h3" style={styles.sectionTitle}>
                  Dati Raccolti
                </ThemedText>
              </View>
              <View style={styles.bulletList}>
                <View style={styles.bulletItem}>
                  <View style={[styles.bullet, { backgroundColor: "#0066CC" }]} />
                  <ThemedText type="body" style={[styles.bulletText, { color: theme.textSecondary }]}>
                    Nome e cognome (per checklist e segnalazione scadenze)
                  </ThemedText>
                </View>
                <View style={styles.bulletItem}>
                  <View style={[styles.bullet, { backgroundColor: "#0066CC" }]} />
                  <ThemedText type="body" style={[styles.bulletText, { color: theme.textSecondary }]}>
                    Email aziendale (esclusivamente per accesso all'app)
                  </ThemedText>
                </View>
                <View style={styles.bulletItem}>
                  <View style={[styles.bullet, { backgroundColor: "#0066CC" }]} />
                  <ThemedText type="body" style={[styles.bulletText, { color: theme.textSecondary }]}>
                    Dati di geolocalizzazione (solo per scopi lavorativi: calcolo km e percorsi)
                  </ThemedText>
                </View>
                <View style={styles.bulletItem}>
                  <View style={[styles.bullet, { backgroundColor: "#0066CC" }]} />
                  <ThemedText type="body" style={[styles.bulletText, { color: theme.textSecondary }]}>
                    Dati relativi ai servizi di trasporto
                  </ThemedText>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIcon, { backgroundColor: "#0066CC15" }]}>
                  <Feather name="target" size={20} color="#0066CC" />
                </View>
                <ThemedText type="h3" style={styles.sectionTitle}>
                  Finalità del Trattamento
                </ThemedText>
              </View>
              <View style={styles.bulletList}>
                <View style={styles.bulletItem}>
                  <View style={[styles.bullet, { backgroundColor: "#00A651" }]} />
                  <ThemedText type="body" style={[styles.bulletText, { color: theme.textSecondary }]}>
                    Gestione operativa dei servizi di trasporto sanitario
                  </ThemedText>
                </View>
                <View style={styles.bulletItem}>
                  <View style={[styles.bullet, { backgroundColor: "#00A651" }]} />
                  <ThemedText type="body" style={[styles.bulletText, { color: theme.textSecondary }]}>
                    Adempimenti fiscali e legali obbligatori
                  </ThemedText>
                </View>
                <View style={styles.bulletItem}>
                  <View style={[styles.bullet, { backgroundColor: "#00A651" }]} />
                  <ThemedText type="body" style={[styles.bulletText, { color: theme.textSecondary }]}>
                    Sicurezza e tracciabilità delle operazioni
                  </ThemedText>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIcon, { backgroundColor: "#EF444415" }]}>
                  <Feather name="alert-triangle" size={20} color="#EF4444" />
                </View>
                <ThemedText type="h3" style={styles.sectionTitle}>
                  Avvertenze di Sicurezza
                </ThemedText>
              </View>
              <View style={styles.bulletList}>
                <View style={styles.bulletItem}>
                  <View style={[styles.bullet, { backgroundColor: "#EF4444" }]} />
                  <ThemedText type="body" style={[styles.bulletText, { color: theme.textSecondary }]}>
                    Le credenziali di accesso non devono essere divulgate a terzi non autorizzati
                  </ThemedText>
                </View>
                <View style={styles.bulletItem}>
                  <View style={[styles.bullet, { backgroundColor: "#EF4444" }]} />
                  <ThemedText type="body" style={[styles.bulletText, { color: theme.textSecondary }]}>
                    È vietata l'installazione dell'app su dispositivi personali
                  </ThemedText>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIcon, { backgroundColor: "#00A65115" }]}>
                  <Feather name="check-circle" size={20} color="#00A651" />
                </View>
                <ThemedText type="h3" style={styles.sectionTitle}>
                  I Tuoi Diritti
                </ThemedText>
              </View>
              <ThemedText type="body" style={[styles.paragraph, { color: theme.textSecondary }]}>
                Hai diritto di accedere, rettificare, cancellare o limitare il trattamento dei tuoi dati. Puoi esercitare questi diritti contattando il responsabile della privacy della tua organizzazione.
              </ThemedText>
            </View>

            <View style={[styles.infoBox, { backgroundColor: theme.primaryLight }]}>
              <Feather name="info" size={18} color="#0066CC" />
              <ThemedText type="small" style={[styles.infoText, { color: "#0066CC" }]}>
                Per l'informativa completa, consulta la sezione Privacy nelle Impostazioni dell'app o visita il nostro sito web.
              </ThemedText>
            </View>

            <View style={styles.legalNote}>
              <ThemedText type="small" style={[styles.legalText, { color: theme.textSecondary }]}>
                Titolare del Trattamento: la tua organizzazione di appartenenza
              </ThemedText>
              <ThemedText type="small" style={[styles.legalText, { color: theme.textSecondary }]}>
                Ultimo aggiornamento: Febbraio 2026
              </ThemedText>
            </View>
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: theme.border }]}>
            <Pressable
              style={[styles.acceptButton, !hasScrolledToEnd && styles.acceptButtonDisabled]}
              onPress={handleAccept}
              disabled={!hasScrolledToEnd}
            >
              <LinearGradient
                colors={hasScrolledToEnd ? ["#00A651", "#008744"] : ["#9CA3AF", "#6B7280"]}
                style={styles.acceptButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Feather name="check" size={20} color="#FFFFFF" />
                <ThemedText type="body" style={styles.acceptButtonText}>
                  {hasScrolledToEnd ? "Accetto e Proseguo" : "Scorri per continuare"}
                </ThemedText>
              </LinearGradient>
            </Pressable>

            <View style={styles.footerLinks}>
              <ThemedText type="small" style={[styles.footerNote, { color: theme.textSecondary }]}>
                Continuando, confermi di aver letto e compreso l'informativa sulla privacy
              </ThemedText>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    paddingHorizontal: Spacing.md,
  },
  container: {
    flex: 1,
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
    maxHeight: height * 0.9,
  },
  header: {
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 4,
  },
  headerSubtitle: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 13,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    flexShrink: 1,
  },
  paragraph: {
    lineHeight: 22,
  },
  bulletList: {
    gap: Spacing.sm,
  },
  bulletItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
    marginRight: Spacing.sm,
  },
  bulletText: {
    flex: 1,
    lineHeight: 20,
  },
  infoBox: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
    alignItems: "flex-start",
  },
  infoText: {
    flex: 1,
    lineHeight: 18,
  },
  legalNote: {
    alignItems: "center",
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
    gap: 4,
  },
  legalText: {
    fontSize: 11,
    textAlign: "center",
  },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
  },
  acceptButton: {
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  acceptButtonDisabled: {
    opacity: 0.9,
  },
  acceptButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md + 2,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  acceptButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 15,
    flexShrink: 1,
  },
  footerLinks: {
    alignItems: "center",
    marginTop: Spacing.md,
  },
  footerNote: {
    textAlign: "center",
    fontSize: 12,
    lineHeight: 16,
  },
});

export { PRIVACY_CONSENT_KEY };
