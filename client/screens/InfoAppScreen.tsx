import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import Animated, { 
  FadeIn, 
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Spacing, BorderRadius } from "@/constants/theme";

const APP_VERSION = "2.0.0";
const RELEASE_DATE = "Febbraio 2026";

const PRIMARY_BLUE = "#0066CC";
const PRIMARY_GREEN = "#00A651";

interface FeatureItemProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
  color: string;
  delay: number;
}

function FeatureItem({ icon, title, description, color, delay }: FeatureItemProps) {
  const { theme } = useTheme();

  return (
    <Animated.View 
      entering={FadeInDown.duration(400).delay(delay)}
      style={styles.featureItem}
    >
      <View style={[styles.featureIcon, { backgroundColor: `${color}15` }]}>
        <Feather name={icon} size={20} color={color} />
      </View>
      <View style={styles.featureContent}>
        <ThemedText style={styles.featureTitle}>{title}</ThemedText>
        <ThemedText style={[styles.featureDesc, { color: theme.textSecondary }]}>
          {description}
        </ThemedText>
      </View>
    </Animated.View>
  );
}

export default function InfoAppScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();

  const pulseScale = useSharedValue(1);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.02, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const animatedLogoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const features = [
    { 
      icon: "truck" as const, 
      title: "Gestione Servizi", 
      description: "Registrazione completa viaggi e trasporti",
      color: PRIMARY_BLUE 
    },
    { 
      icon: "map-pin" as const, 
      title: "Tracciamento GPS", 
      description: "Localizzazione in tempo reale",
      color: PRIMARY_GREEN 
    },
    { 
      icon: "check-square" as const, 
      title: "Checklist Digitali", 
      description: "Controlli veicolo e attrezzature",
      color: "#F59E0B" 
    },
    { 
      icon: "calendar" as const, 
      title: "Scadenze Materiali", 
      description: "Gestione scadenze e ripristini",
      color: "#8B5CF6" 
    },
    { 
      icon: "shield" as const, 
      title: "Conformita GDPR", 
      description: "Protezione dati e privacy",
      color: "#EF4444" 
    },
    { 
      icon: "bar-chart-2" as const, 
      title: "Statistiche", 
      description: "Report e analisi dettagliate",
      color: "#06B6D4" 
    },
  ];

  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.md,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      <Animated.View entering={FadeIn.duration(600)} style={styles.header}>
        <Animated.View style={[styles.logoContainer, animatedLogoStyle]}>
          <Image
            source={require("@/assets/images/app-icon-transparent.png")}
            style={styles.logoImage}
            contentFit="contain"
          />
        </Animated.View>
        
        <ThemedText style={styles.appName}>
          SOCCORSO DIGITALE
        </ThemedText>
        
        <ThemedText style={[styles.tagline, { color: theme.textSecondary }]}>
          Piattaforma Gestionale Trasporti Sanitari
        </ThemedText>

        <View style={styles.versionRow}>
          <View style={[styles.versionBadge, { backgroundColor: `${PRIMARY_BLUE}15` }]}>
            <ThemedText style={[styles.versionText, { color: PRIMARY_BLUE }]}>
              v{APP_VERSION}
            </ThemedText>
          </View>
          <View style={[styles.betaBadge, { backgroundColor: "#FF6B00" }]}>
            <ThemedText style={styles.betaText}>
              BETA
            </ThemedText>
          </View>
          <View style={[styles.platformBadge, { backgroundColor: `${PRIMARY_GREEN}15` }]}>
            <Feather name="smartphone" size={12} color={PRIMARY_GREEN} />
            <ThemedText style={[styles.platformText, { color: PRIMARY_GREEN }]}>
              Android
            </ThemedText>
          </View>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(400).delay(200)}>
        <Card style={styles.featuresCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: `${PRIMARY_BLUE}15` }]}>
              <Feather name="zap" size={16} color={PRIMARY_BLUE} />
            </View>
            <ThemedText style={styles.sectionTitle}>Funzionalita</ThemedText>
          </View>
          
          <View style={styles.featuresList}>
            {features.map((feature, index) => (
              <FeatureItem
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                color={feature.color}
                delay={300 + (index * 80)}
              />
            ))}
          </View>
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(400).delay(800)}>
        <Card style={styles.infoCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: `${PRIMARY_GREEN}15` }]}>
              <Feather name="info" size={16} color={PRIMARY_GREEN} />
            </View>
            <ThemedText style={styles.sectionTitle}>Informazioni</ThemedText>
          </View>
          
          <View style={styles.infoGrid}>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>
                  Sviluppatore
                </ThemedText>
                <ThemedText style={styles.infoValue}>Adrian Vasile</ThemedText>
              </View>
              <View style={styles.infoItem}>
                <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>
                  Versione
                </ThemedText>
                <ThemedText style={styles.infoValue}>{APP_VERSION} BETA</ThemedText>
              </View>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>
                  Piattaforma
                </ThemedText>
                <ThemedText style={styles.infoValue}>Android</ThemedText>
              </View>
              <View style={styles.infoItem}>
                <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>
                  Aggiornamento
                </ThemedText>
                <ThemedText style={styles.infoValue}>{RELEASE_DATE}</ThemedText>
              </View>
            </View>
          </View>
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(400).delay(1000)} style={styles.footer}>
        <View style={[styles.footerDivider, { backgroundColor: theme.border }]} />
        <View style={styles.footerContent}>
          <ThemedText style={[styles.footerText, { color: theme.textSecondary }]}>
            Sviluppato con
          </ThemedText>
          <Feather name="heart" size={12} color={PRIMARY_GREEN} />
          <ThemedText style={[styles.footerText, { color: theme.textSecondary }]}>
            in Italia
          </ThemedText>
        </View>
        <ThemedText style={[styles.companyName, { color: theme.text }]}>
          Soccorso Digitale
        </ThemedText>
        <ThemedText style={[styles.copyright, { color: theme.textSecondary }]}>
          2026
        </ThemedText>
      </Animated.View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  logoContainer: {
    marginBottom: Spacing.lg,
  },
  logoImage: {
    width: 100,
    height: 100,
    borderRadius: 24,
  },
  appName: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 2,
    textAlign: "center",
    color: PRIMARY_BLUE,
  },
  tagline: {
    fontSize: 13,
    marginTop: Spacing.xs,
    textAlign: "center",
  },
  versionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  versionBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  versionText: {
    fontSize: 12,
    fontWeight: "700",
  },
  betaBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  betaText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  platformBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  platformText: {
    fontSize: 12,
    fontWeight: "600",
  },
  featuresCard: {
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  featuresList: {
    gap: Spacing.sm,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  featureContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  featureDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  infoCard: {
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
  },
  infoGrid: {
    gap: Spacing.md,
  },
  infoRow: {
    flexDirection: "row",
    gap: Spacing.lg,
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  footer: {
    alignItems: "center",
    paddingTop: Spacing.lg,
  },
  footerDivider: {
    width: 60,
    height: 1,
    marginBottom: Spacing.lg,
  },
  footerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: Spacing.sm,
  },
  footerText: {
    fontSize: 12,
  },
  companyName: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
  },
  copyright: {
    fontSize: 11,
  },
});
