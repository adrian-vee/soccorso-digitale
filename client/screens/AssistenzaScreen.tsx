import React, { useState } from "react";
import { View, StyleSheet, Pressable, Linking, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { 
  FadeIn, 
  FadeInDown, 
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useEffect } from "react";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Spacing, BorderRadius } from "@/constants/theme";

interface ContactButtonProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  sublabel: string;
  color: string;
  onPress: () => void;
  delay: number;
}

function ContactButton({ icon, label, sublabel, color, onPress, delay }: ContactButtonProps) {
  const { theme, isDark } = useTheme();

  const handlePress = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  return (
    <Animated.View entering={FadeInUp.duration(400).delay(delay)}>
      <Pressable onPress={handlePress}>
        {({ pressed }) => (
          <View style={[
            styles.contactButton,
            { 
              backgroundColor: isDark ? "#1A2744" : "#FFFFFF",
              borderColor: isDark ? "#2A3A5A" : "#E5E7EB",
              opacity: pressed ? 0.8 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            }
          ]}>
            <View style={[styles.contactIconCircle, { backgroundColor: color + "15" }]}>
              <Feather name={icon} size={20} color={color} />
            </View>
            <View style={styles.contactTextContainer}>
              <ThemedText style={styles.contactLabel}>{label}</ThemedText>
              <ThemedText style={[styles.contactSublabel, { color: theme.textSecondary }]}>
                {sublabel}
              </ThemedText>
            </View>
            <Feather name="arrow-right" size={18} color={theme.textSecondary} />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

interface FAQItemProps {
  question: string;
  answer: string;
  delay: number;
}

function FAQItem({ question, answer, delay }: FAQItemProps) {
  const [expanded, setExpanded] = useState(false);
  const { theme, isDark } = useTheme();

  const handlePress = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setExpanded(!expanded);
  };

  return (
    <Animated.View entering={FadeInUp.duration(400).delay(delay)}>
      <Pressable onPress={handlePress}>
        <View style={styles.faqItem}>
          <View style={styles.faqHeader}>
            <ThemedText style={styles.faqQuestion}>{question}</ThemedText>
            <Feather
              name={expanded ? "minus" : "plus"}
              size={18}
              color={isDark ? "#00D4FF" : "#0066CC"}
            />
          </View>
          {expanded ? (
            <ThemedText style={[styles.faqAnswer, { color: theme.textSecondary }]}>
              {answer}
            </ThemedText>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function StatusIndicator() {
  const { isDark } = useTheme();
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.4, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.statusDot, animatedStyle, { backgroundColor: "#10B981" }]} />
  );
}

export default function AssistenzaScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();

  const handleEmail = () => {
    Linking.openURL("mailto:supporto@soccorsodigitale.app?subject=Richiesta%20Assistenza%20App");
  };


  const faqs = [
    {
      question: "Come registro un nuovo viaggio?",
      answer: "Vai nella sezione 'Inserisci' dal menu, compila i campi richiesti e premi 'Salva'. I chilometri vengono calcolati automaticamente.",
    },
    {
      question: "Come funziona il GPS?",
      answer: "Il GPS traccia automaticamente il percorso. Assicurati di aver concesso i permessi di localizzazione nelle impostazioni del dispositivo.",
    },
    {
      question: "Posso modificare un viaggio salvato?",
      answer: "Si, dalla lista viaggi clicca sul viaggio da modificare. Alcune modifiche potrebbero richiedere approvazione.",
    },
  ];

  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      <Animated.View entering={FadeIn.duration(600)} style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: isDark ? "#1A2744" : "#F0F7FF" }]}>
          <Feather name="headphones" size={28} color={isDark ? "#00D4FF" : "#0066CC"} />
        </View>
        
        <ThemedText style={styles.headerTitle}>Come possiamo aiutarti?</ThemedText>
        
        <View style={styles.availabilityRow}>
          <StatusIndicator />
          <ThemedText style={[styles.availabilityText, { color: theme.textSecondary }]}>
            Lun-Ven 09:00-15:00
          </ThemedText>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(500).delay(200)}>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
      </Animated.View>

      <Animated.View entering={FadeInUp.duration(500).delay(300)} style={styles.section}>
        <ThemedText style={[styles.sectionLabel, { color: theme.textSecondary }]}>
          CONTATTACI
        </ThemedText>
        
        <View style={styles.contactsList}>
          <ContactButton
            icon="mail"
            label="Email"
            sublabel="supporto@soccorsodigitale.app"
            color="#3B82F6"
            onPress={handleEmail}
            delay={400}
          />
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(500).delay(700)}>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
      </Animated.View>

      <Animated.View entering={FadeInUp.duration(500).delay(800)} style={styles.section}>
        <ThemedText style={[styles.sectionLabel, { color: theme.textSecondary }]}>
          DOMANDE FREQUENTI
        </ThemedText>
        
        <View style={styles.faqList}>
          {faqs.map((faq, index) => (
            <FAQItem
              key={faq.question}
              question={faq.question}
              answer={faq.answer}
              delay={900 + index * 100}
            />
          ))}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInUp.duration(500).delay(1200)}>
        <View style={[
          styles.emergencyBanner,
          { 
            backgroundColor: isDark ? "rgba(239, 68, 68, 0.1)" : "rgba(239, 68, 68, 0.05)",
            borderColor: isDark ? "rgba(239, 68, 68, 0.3)" : "rgba(239, 68, 68, 0.2)",
          }
        ]}>
          <Feather name="alert-circle" size={18} color="#EF4444" />
          <View style={styles.emergencyText}>
            <ThemedText style={[styles.emergencyTitle, { color: "#EF4444" }]}>
              Problema urgente durante un servizio?
            </ThemedText>
            <ThemedText style={[styles.emergencySubtitle, { color: theme.textSecondary }]}>
              Contatta il coordinatore della sede
            </ThemedText>
          </View>
        </View>
      </Animated.View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  availabilityRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  availabilityText: {
    fontSize: 13,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.md,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: Spacing.md,
  },
  contactsList: {
    gap: Spacing.sm,
  },
  contactButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.md,
  },
  contactIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  contactTextContainer: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  contactSublabel: {
    fontSize: 13,
    marginTop: 2,
  },
  faqList: {
    gap: Spacing.sm,
  },
  faqItem: {
    paddingVertical: Spacing.md,
  },
  faqHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  faqQuestion: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
    paddingRight: Spacing.md,
  },
  faqAnswer: {
    fontSize: 14,
    lineHeight: 22,
    marginTop: Spacing.sm,
  },
  emergencyBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.lg,
    borderWidth: 1,
    gap: Spacing.md,
  },
  emergencyText: {
    flex: 1,
  },
  emergencyTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  emergencySubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
});
