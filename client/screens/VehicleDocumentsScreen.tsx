import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";

const DOC_TYPES: Record<string, { label: string; icon: string; color: string }> = {
  libretto: { label: "Libretto", icon: "book-open", color: "#0064C5" },
  assicurazione: { label: "Assicurazione", icon: "shield", color: "#00A651" },
  revisione: { label: "Revisione", icon: "check-circle", color: "#8B5CF6" },
  bollo: { label: "Bollo", icon: "file-text", color: "#F59E0B" },
  autorizzazione_sanitaria: { label: "Aut. Sanitaria", icon: "activity", color: "#EF4444" },
  altro: { label: "Altro", icon: "paperclip", color: "#6B7280" },
};

interface VehicleDocument {
  id: string;
  vehicleId: string;
  vehicleCode: string;
  documentType: string;
  documentLabel: string;
  expiryDate: string | null;
  issueDate: string | null;
  documentNumber: string | null;
  notes: string | null;
  photoUrl: string | null;
  uploadedByName: string | null;
  createdAt: string;
}

function getExpiryStatus(expiryDate: string | null): { color: string; label: string; isWarning: boolean } {
  if (!expiryDate) return { color: "#9CA3AF", label: "Nessuna scadenza", isWarning: false };
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { color: "#EF4444", label: `Scaduto da ${Math.abs(diffDays)}g`, isWarning: true };
  if (diffDays <= 7) return { color: "#EF4444", label: `Scade tra ${diffDays}g`, isWarning: true };
  if (diffDays <= 30) return { color: "#F59E0B", label: `Scade tra ${diffDays}g`, isWarning: true };
  return { color: "#00A651", label: "Valido", isWarning: false };
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "---";
  return new Date(dateStr).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function VehicleDocumentsScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user } = useAuth();

  const vehicleId = user?.vehicle?.id;
  const vehicleCode = user?.vehicle?.code;

  const { data: documents, isLoading } = useQuery<VehicleDocument[]>({
    queryKey: [`/api/vehicle-documents/${vehicleId}`],
    enabled: !!vehicleId,
  });

  const docCount = documents?.length || 0;
  const groupedDocs: Record<string, VehicleDocument[]> = {};
  (documents || []).forEach((doc) => {
    const key = doc.documentType || "altro";
    if (!groupedDocs[key]) groupedDocs[key] = [];
    groupedDocs[key].push(doc);
  });

  const alertDocs = (documents || []).filter((doc) => {
    const status = getExpiryStatus(doc.expiryDate);
    return status.isWarning;
  });
  const alertCount = alertDocs.length;

  if (!vehicleId) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerEmpty}>
          <Feather name="folder" size={48} color={theme.textSecondary} />
          <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
            Nessun veicolo assegnato
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {alertCount > 0 ? (
          <Animated.View entering={FadeInDown.delay(80).springify()}>
            <View style={styles.alertStrip}>
              <LinearGradient
                colors={["#FEF3C7", "#FDE68A"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.alertStripGradient}
              >
                <View style={styles.alertStripIcon}>
                  <Feather name="alert-triangle" size={18} color="#D97706" />
                </View>
                <ThemedText type="body" style={styles.alertStripText}>
                  {alertCount} {alertCount === 1 ? "documento in scadenza" : "documenti in scadenza"}
                </ThemedText>
              </LinearGradient>
            </View>
          </Animated.View>
        ) : null}

        {isLoading ? (
          <Card style={styles.sectionCard}>
            <ActivityIndicator color={theme.primary} style={{ paddingVertical: Spacing.xl }} />
            <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center", paddingBottom: Spacing.md }}>
              Caricamento documenti...
            </ThemedText>
          </Card>
        ) : docCount === 0 ? (
          <Animated.View entering={FadeInDown.delay(150).springify()}>
            <Card style={styles.sectionCard}>
              <View style={styles.emptyState}>
                <View style={[styles.emptyIcon, { backgroundColor: theme.primaryLight }]}>
                  <Feather name="folder" size={32} color={theme.primary} />
                </View>
                <ThemedText type="h3" style={{ marginTop: Spacing.md, textAlign: "center" }}>
                  Nessun documento
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm, textAlign: "center", paddingHorizontal: Spacing.lg }}>
                  I documenti vengono gestiti dall'amministrazione
                </ThemedText>
              </View>
            </Card>
          </Animated.View>
        ) : (
          Object.entries(groupedDocs).map(([type, docs], groupIdx) => {
            const docType = DOC_TYPES[type] || DOC_TYPES.altro;
            return (
              <Animated.View key={type} entering={FadeInDown.delay(100 + groupIdx * 80).springify()}>
                <Card style={styles.sectionCard}>
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionTitleRow}>
                      <View style={[styles.sectionIcon, { backgroundColor: docType.color + "20" }]}>
                        <Feather name={docType.icon as any} size={16} color={docType.color} />
                      </View>
                      <ThemedText type="h3" style={styles.sectionTitle}>
                        {docType.label}
                      </ThemedText>
                    </View>
                    <View style={[styles.countBadge, { backgroundColor: docType.color + "15" }]}>
                      <ThemedText type="small" style={{ color: docType.color, fontWeight: "700", fontSize: 11 }}>
                        {docs.length}
                      </ThemedText>
                    </View>
                  </View>

                  {docs.map((doc, i) => {
                    const expiry = getExpiryStatus(doc.expiryDate);
                    return (
                      <View
                        key={doc.id}
                        style={[
                          styles.docRow,
                          i < docs.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border },
                          expiry.isWarning && styles.docRowWarning,
                          expiry.isWarning && { borderColor: expiry.color + "40" },
                        ]}
                      >
                        <View style={styles.docRowLeft}>
                          <View style={[styles.statusDot, { backgroundColor: expiry.color }]} />
                          <View style={styles.docDetails}>
                            <ThemedText type="body" style={{ fontWeight: "600" }} numberOfLines={1}>
                              {doc.documentLabel}
                            </ThemedText>
                            <View style={styles.docMeta}>
                              <ThemedText type="small" style={{ color: expiry.color, fontWeight: "600", fontSize: 11 }}>
                                {doc.expiryDate ? formatDate(doc.expiryDate) : "---"}
                              </ThemedText>
                              <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 11 }}>
                                {expiry.label}
                              </ThemedText>
                            </View>
                            {doc.documentNumber ? (
                              <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 10, marginTop: 2 }}>
                                N. {doc.documentNumber}
                              </ThemedText>
                            ) : null}
                          </View>
                        </View>
                        {expiry.isWarning ? (
                          <View style={[styles.warningIcon, { backgroundColor: expiry.color + "15" }]}>
                            <Feather name="alert-circle" size={16} color={expiry.color} />
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </Card>
              </Animated.View>
            );
          })
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  centerEmpty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerGradient: {
    borderRadius: BorderRadius["2xl"],
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    flex: 1,
  },
  headerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    marginTop: 2,
  },
  headerBadge: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  headerCount: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
  },
  headerCountLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1,
  },
  alertStrip: {
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#D97706",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
      default: {},
    }),
  },
  alertStripGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  alertStripIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(217,119,6,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  alertStripText: {
    color: "#92400E",
    fontWeight: "700",
    fontSize: 14,
  },
  sectionCard: {
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontWeight: "600",
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    minWidth: 28,
    alignItems: "center",
  },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
  },
  docRowWarning: {
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    marginHorizontal: -Spacing.sm,
    marginVertical: 2,
  },
  docRowLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    flex: 1,
    gap: Spacing.md,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
  },
  docDetails: {
    flex: 1,
  },
  docMeta: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: 3,
    alignItems: "center",
  },
  warningIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    paddingVertical: Spacing["2xl"],
    alignItems: "center",
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
