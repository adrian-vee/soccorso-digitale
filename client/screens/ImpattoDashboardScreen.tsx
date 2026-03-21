import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
  Platform,
  ActivityIndicator,
  Animated,
  TextInput,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { getApiUrl } from "@/lib/query-client";

interface ImpactData {
  today: { services: number; km: number };
  month: { patients: number; km: number };
  year: { services: number; km: number; patients: number };
  live: { activeVehicles: number };
  campaign?: { name: string; goal: number; raised: number; description: string };
}

interface ActivityItem {
  id: string;
  message: string;
  timeAgo: string;
  km: number;
  type: string;
  icon: string;
}

function AnimatedNumber({ value, duration = 1500 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setDisplayValue(Math.floor(progress * value));
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration]);

  return <Text style={styles.metricValue}>{displayValue.toLocaleString("it-IT")}</Text>;
}

function MetricCard({ 
  icon, 
  label, 
  value, 
  unit, 
  color 
}: { 
  icon: keyof typeof Feather.glyphMap; 
  label: string; 
  value: number; 
  unit: string; 
  color: string;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, { backgroundColor: color + "20" }]}>
        <Feather name={icon} size={24} color={color} />
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <AnimatedNumber value={value} />
      <Text style={styles.metricUnit}>{unit}</Text>
    </View>
  );
}

function ActivityFeedItem({ activity, index }: { activity: ActivityItem; index: number }) {
  const slideAnim = useRef(new Animated.Value(-50)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        delay: index * 100,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [index]);

  return (
    <Animated.View 
      style={[
        styles.activityItem, 
        { transform: [{ translateX: slideAnim }], opacity: opacityAnim }
      ]}
    >
      <View style={styles.activityIcon}>
        <Feather name={activity.icon as keyof typeof Feather.glyphMap} size={16} color="#10b981" />
      </View>
      <View style={styles.activityContent}>
        <Text style={styles.activityMessage}>{activity.message}</Text>
        <Text style={styles.activityMeta}>
          {activity.km > 0 ? `${activity.km} km` : ""} {activity.timeAgo}
        </Text>
      </View>
      <View style={styles.activityPulse} />
    </Animated.View>
  );
}

function TaxCalculator() {
  const [donationAmount, setDonationAmount] = useState("100");
  
  const handleAmountChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, "");
    setDonationAmount(cleaned);
  };
  
  const amount = parseInt(donationAmount, 10) || 0;
  const taxDeduction = Math.round(amount * 0.30);
  const effectiveCost = Math.max(0, amount - taxDeduction);
  
  const impactKm = Math.round(amount * 4);
  const impactPeople = Math.max(1, Math.round(amount / 25));

  return (
    <View style={styles.calculatorSection}>
      <View style={styles.sectionHeader}>
        <Feather name="percent" size={20} color="#f59e0b" />
        <Text style={styles.sectionTitle}>Calcolatore Detrazione Fiscale</Text>
      </View>
      <Text style={styles.calculatorSubtitle}>
        Scopri quanto risparmierai con la detrazione del 30%
      </Text>
      
      <View style={styles.calculatorInput}>
        <Text style={styles.inputLabel}>Importo donazione</Text>
        <View style={styles.inputWrapper}>
          <Text style={styles.inputPrefix}>EUR</Text>
          <TextInput
            style={styles.input}
            value={donationAmount}
            onChangeText={handleAmountChange}
            keyboardType="number-pad"
            placeholder="100"
            placeholderTextColor="rgba(255,255,255,0.3)"
            maxLength={6}
          />
        </View>
      </View>
      
      <View style={styles.calculatorResults}>
        <View style={styles.resultRow}>
          <View style={styles.resultItem}>
            <Text style={styles.resultLabel}>Detrazione IRPEF</Text>
            <Text style={styles.resultValue}>-{taxDeduction.toLocaleString("it-IT")} EUR</Text>
          </View>
          <View style={styles.resultDivider} />
          <View style={styles.resultItem}>
            <Text style={styles.resultLabel}>Costo effettivo</Text>
            <Text style={[styles.resultValue, styles.resultHighlight]}>
              {effectiveCost.toLocaleString("it-IT")} EUR
            </Text>
          </View>
        </View>
        
        <View style={styles.impactEquivalent}>
          <Feather name="zap" size={16} color="#f59e0b" />
          <Text style={styles.impactText}>
            Con {amount.toLocaleString("it-IT")} EUR percorriamo circa {impactKm} km e aiutiamo {impactPeople} {impactPeople === 1 ? "persona" : "persone"}
          </Text>
        </View>
      </View>
      
      <Text style={styles.calculatorNote}>
        Art. 83, comma 1, D.Lgs. 117/2017 - Detraibile fino a 30.000 EUR/anno
      </Text>
    </View>
  );
}

function MicroDonationButtons({ onDonate }: { onDonate: (amount: number) => void }) {
  const donationOptions = [
    { amount: 5, impact: "100 garze sterili" },
    { amount: 10, impact: "100 guanti nitrile" },
    { amount: 25, impact: "50 mascherine FFP2" },
    { amount: 50, impact: "1 trasporto" },
    { amount: 100, impact: "2 trasporti" },
  ];
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [isEditingCustom, setIsEditingCustom] = useState(false);
  
  const handleSelect = (amount: number) => {
    setSelectedAmount(amount);
    setIsEditingCustom(false);
    setCustomAmount("");
    onDonate(amount);
  };
  
  const handleCustomSubmit = () => {
    const amount = parseInt(customAmount, 10);
    if (amount && amount > 0) {
      setSelectedAmount(amount);
      onDonate(amount);
    }
    setIsEditingCustom(false);
  };
  
  const handleCustomPress = () => {
    setIsEditingCustom(true);
    setSelectedAmount(null);
  };
  
  const handleCustomBlur = () => {
    if (!customAmount || parseInt(customAmount, 10) <= 0) {
      setIsEditingCustom(false);
      setCustomAmount("");
    }
  };

  return (
    <View style={styles.microDonationSection}>
      <View style={styles.sectionHeader}>
        <Feather name="gift" size={20} color="#e8655f" />
        <Text style={styles.sectionTitle}>Dona con un click</Text>
      </View>
      <Text style={styles.microDonationSubtitle}>
        Scegli un importo e sostieni i nostri servizi
      </Text>
      
      <View style={styles.amountGrid}>
        {donationOptions.map(({ amount, impact }) => (
          <Pressable
            key={amount}
            style={[
              styles.amountButton,
              selectedAmount === amount && styles.amountButtonSelected
            ]}
            onPress={() => handleSelect(amount)}
          >
            <View style={styles.amountRow}>
              <Text style={[
                styles.amountValue,
                selectedAmount === amount && styles.amountTextSelected
              ]}>
                {amount}
              </Text>
              <Text style={[
                styles.amountCurrency,
                selectedAmount === amount && styles.amountTextSelected
              ]}>
                {" "}EUR
              </Text>
            </View>
            <Text style={[
              styles.amountImpact,
              selectedAmount === amount && styles.amountImpactSelected
            ]}>
              {impact}
            </Text>
          </Pressable>
        ))}
        <Pressable 
          style={[styles.amountButtonCustom, isEditingCustom && styles.amountButtonSelected]}
          onPress={handleCustomPress}
        >
          {isEditingCustom ? (
            <View style={styles.customInputContainer}>
              <View style={styles.customInputRow}>
                <TextInput
                  style={styles.customInput}
                  value={customAmount}
                  onChangeText={(t) => setCustomAmount(t.replace(/[^0-9]/g, ""))}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  autoFocus
                  maxLength={5}
                  onSubmitEditing={handleCustomSubmit}
                  onBlur={handleCustomBlur}
                />
                <Text style={styles.customInputEur}> EUR</Text>
              </View>
              <Pressable onPress={handleCustomSubmit} style={styles.customInputConfirm}>
                <Feather name="check" size={16} color="#10b981" />
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.amountText}>Altro</Text>
              <Feather name="edit-2" size={14} color="rgba(255,255,255,0.7)" />
            </>
          )}
        </Pressable>
      </View>
      
      <View style={styles.paymentMethods}>
        <View style={styles.paymentBadge}>
          <Feather name="credit-card" size={14} color="rgba(255,255,255,0.6)" />
          <Text style={styles.paymentText}>Carta</Text>
        </View>
        <View style={styles.paymentBadge}>
          <Feather name="smartphone" size={14} color="rgba(255,255,255,0.6)" />
          <Text style={styles.paymentText}>PayPal</Text>
        </View>
        <View style={styles.paymentBadge}>
          <Feather name="send" size={14} color="rgba(255,255,255,0.6)" />
          <Text style={styles.paymentText}>Bonifico</Text>
        </View>
      </View>
    </View>
  );
}

export default function ImpattoDashboardScreen() {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<ImpactData | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [showDonationConfirm, setShowDonationConfirm] = useState(false);
  const [donationAmount, setDonationAmount] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const confirmAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const fetchData = async () => {
    try {
      setError(null);
      const [impactRes, activityRes] = await Promise.all([
        fetch(new URL("/api/public/impact", getApiUrl()).toString()),
        fetch(new URL("/api/public/activity-feed", getApiUrl()).toString()),
      ]);
      
      if (!impactRes.ok) throw new Error("Errore nel caricamento dei dati");
      
      const impactJson = await impactRes.json();
      const activityJson = activityRes.ok ? await activityRes.json() : { activities: [] };
      setData(impactJson);
      setActivities(activityJson.activities || []);
      setLastUpdate(new Date());
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Impossibile caricare i dati. Riprova.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const shareUrl = Platform.OS === "web" ? window.location.href : "";

  const handleShare = (platform: string) => {
    if (Platform.OS !== "web") return;
    const encodedUrl = encodeURIComponent(shareUrl);
    const urls: Record<string, string> = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    };
    if (urls[platform]) {
      Linking.openURL(urls[platform]);
    }
  };

  const copyLink = async () => {
    if (Platform.OS === "web" && navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl);
      alert("Link copiato!");
    }
  };

  const handleDonation = (amount: number) => {
    setDonationAmount(amount);
    setShowDonationConfirm(true);
    Animated.spring(confirmAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();
  };

  const closeDonationConfirm = () => {
    Animated.timing(confirmAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setShowDonationConfirm(false));
  };

  const openPaymentPage = () => {
    Linking.openURL("mailto:donazioni@soccorsodigitale.it?subject=Donazione%20" + donationAmount + "EUR");
    closeDonationConfirm();
  };

  if (loading) {
    return (
      <LinearGradient colors={["#0f172a", "#1e3a5f", "#0f172a"]} style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Caricamento dati...</Text>
      </LinearGradient>
    );
  }

  if (error && !data) {
    return (
      <LinearGradient colors={["#0f172a", "#1e3a5f", "#0f172a"]} style={styles.loadingContainer}>
        <Feather name="wifi-off" size={48} color="rgba(255,255,255,0.5)" />
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={fetchData}>
          <Feather name="refresh-cw" size={18} color="#fff" />
          <Text style={styles.retryButtonText}>Riprova</Text>
        </Pressable>
      </LinearGradient>
    );
  }

  const co2Saved = data ? Math.round((data.month.km || 0) * 0.12) : 0;
  const campaignProgress = data?.campaign ? Math.min((data.campaign.raised / data.campaign.goal) * 100, 100) : 0;

  return (
    <LinearGradient colors={["#0f172a", "#1e3a5f", "#0f172a"]} style={styles.container}>
      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.liveIndicator}>
            <Animated.View style={[styles.liveDot, { transform: [{ scale: pulseAnim }] }]} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
          <Text style={styles.headerTitle}>Dashboard Impatto Sociale</Text>
          <Text style={styles.headerSubtitle}>Trasparenza in tempo reale</Text>
        </View>

        <View style={styles.heroSection}>
          <View style={styles.heartContainer}>
            <Animated.View style={[styles.heartRing, { transform: [{ scale: pulseAnim }] }]} />
            <Feather name="heart" size={48} color="#e8655f" />
          </View>
          <Text style={styles.heroTitle}>Il cuore che batte per la comunita</Text>
          <Text style={styles.heroSubtitle}>
            Ogni numero racconta una storia di aiuto, dedizione e solidarieta
          </Text>
        </View>

        {activities.length > 0 && (
          <View style={styles.activitySection}>
            <View style={styles.activityHeader}>
              <View style={styles.activityHeaderLeft}>
                <View style={styles.activityLiveDot} />
                <Text style={styles.activityTitle}>Attivita in tempo reale</Text>
              </View>
              <Text style={styles.activityCount}>{activities.length} recenti</Text>
            </View>
            <View style={styles.activityList}>
              {activities.slice(0, 5).map((activity, index) => (
                <ActivityFeedItem key={activity.id} activity={activity} index={index} />
              ))}
            </View>
          </View>
        )}

        <View style={styles.metricsGrid}>
          <MetricCard
            icon="truck"
            label="Chilometri oggi"
            value={data?.today.km || 0}
            unit="km percorsi"
            color="#3b82f6"
          />
          <MetricCard
            icon="users"
            label="Pazienti questo mese"
            value={data?.month.patients || 0}
            unit="persone trasportate"
            color="#10b981"
          />
          <MetricCard
            icon="wind"
            label="CO2 risparmiata"
            value={co2Saved}
            unit="kg grazie all'ottimizzazione"
            color="#22c55e"
          />
          <MetricCard
            icon="activity"
            label="Mezzi attivi ora"
            value={data?.live.activeVehicles || 0}
            unit="ambulanze in servizio"
            color="#f59e0b"
          />
        </View>

        <View style={styles.yearlySection}>
          <Text style={styles.sectionTitle}>Impatto annuale 2025</Text>
          <View style={styles.yearlyStats}>
            <View style={styles.yearlyStat}>
              <Text style={styles.yearlyValue}>{(data?.year.km || 0).toLocaleString("it-IT")}</Text>
              <Text style={styles.yearlyLabel}>Chilometri</Text>
            </View>
            <View style={styles.yearlyDivider} />
            <View style={styles.yearlyStat}>
              <Text style={styles.yearlyValue}>{(data?.year.patients || 0).toLocaleString("it-IT")}</Text>
              <Text style={styles.yearlyLabel}>Pazienti</Text>
            </View>
            <View style={styles.yearlyDivider} />
            <View style={styles.yearlyStat}>
              <Text style={styles.yearlyValue}>{(data?.year.services || 0).toLocaleString("it-IT")}</Text>
              <Text style={styles.yearlyLabel}>Servizi</Text>
            </View>
          </View>
        </View>

        <MicroDonationButtons onDonate={handleDonation} />

        <TaxCalculator />

        {data?.campaign && (
          <View style={styles.campaignSection}>
            <View style={styles.campaignBadge}>
              <Feather name="star" size={14} color="#f59e0b" />
              <Text style={styles.campaignBadgeText}>CAMPAGNA ATTIVA</Text>
            </View>
            <Text style={styles.campaignTitle}>{data.campaign.name}</Text>
            <Text style={styles.campaignDescription}>{data.campaign.description}</Text>
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${campaignProgress}%` }]} />
              </View>
              <View style={styles.progressLabels}>
                <Text style={styles.progressRaised}>{data.campaign.raised.toLocaleString("it-IT")} EUR</Text>
                <Text style={styles.progressGoal}>Obiettivo: {data.campaign.goal.toLocaleString("it-IT")} EUR</Text>
              </View>
              <Text style={styles.progressPercent}>{Math.round(campaignProgress)}% raggiunto</Text>
            </View>
            <View style={styles.ctaButtons}>
              <Pressable style={styles.ctaPrimary} onPress={() => handleDonation(50)}>
                <Feather name="heart" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.ctaPrimaryText}>Dona ora</Text>
              </Pressable>
              <Pressable style={styles.ctaSecondary}>
                <Text style={styles.ctaSecondaryText}>Diventa sponsor</Text>
              </Pressable>
            </View>
          </View>
        )}

        <View style={styles.shareSection}>
          <Text style={styles.shareTitle}>Condividi l'impatto</Text>
          <View style={styles.shareButtons}>
            <Pressable style={styles.shareButton} onPress={() => handleShare("facebook")}>
              <Feather name="facebook" size={20} color="#fff" />
            </Pressable>
            <Pressable style={styles.shareButton} onPress={() => handleShare("linkedin")}>
              <Feather name="linkedin" size={20} color="#fff" />
            </Pressable>
            <Pressable style={styles.shareButton} onPress={copyLink}>
              <Feather name="link" size={20} color="#fff" />
            </Pressable>
          </View>
        </View>

        {lastUpdate && (
          <Text style={styles.lastUpdate}>
            Ultimo aggiornamento: {lastUpdate.toLocaleString("it-IT")}
          </Text>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            SOCCORSO DIGITALE - Servizi di Trasporto Sanitario
          </Text>
          <Text style={styles.footerSubtext}>
            Questa dashboard mostra dati aggregati e anonimi.
          </Text>
        </View>
      </ScrollView>

      {showDonationConfirm && (
        <View style={styles.confirmOverlay} accessibilityLabel="Conferma donazione">
          <Pressable style={styles.confirmBackdrop} onPress={closeDonationConfirm} accessibilityLabel="Chiudi" />
          <Animated.View 
            style={[
              styles.confirmModal,
              { 
                transform: [{ scale: confirmAnim }],
                opacity: confirmAnim 
              }
            ]}
          >
            <Pressable style={styles.confirmCloseButton} onPress={closeDonationConfirm} accessibilityLabel="Chiudi" accessibilityRole="button">
              <Feather name="x" size={24} color="rgba(255,255,255,0.6)" />
            </Pressable>
            <View style={styles.confirmIcon}>
              <Feather name="heart" size={32} color="#e8655f" />
            </View>
            <Text style={styles.confirmTitle}>Grazie per il tuo supporto!</Text>
            <Text style={styles.confirmAmount}>{donationAmount} EUR</Text>
            <Text style={styles.confirmText}>
              Hai scelto di donare {donationAmount} EUR. Clicca per contattarci e completare la donazione.
            </Text>
            <View style={styles.confirmTax}>
              <Feather name="check-circle" size={16} color="#10b981" />
              <Text style={styles.confirmTaxText}>
                Risparmierai {Math.round(donationAmount * 0.3)} EUR con la detrazione fiscale
              </Text>
            </View>
            <Pressable style={styles.confirmButton} onPress={openPaymentPage} accessibilityRole="button">
              <Feather name="mail" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.confirmButtonText}>Contattaci per donare</Text>
            </Pressable>
            <Pressable style={styles.confirmCancel} onPress={closeDonationConfirm} accessibilityRole="button">
              <Text style={styles.confirmCancelText}>Annulla</Text>
            </Pressable>
          </Animated.View>
        </View>
      )}
    </LinearGradient>
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
  loadingText: {
    color: "#fff",
    marginTop: 16,
    fontSize: 16,
  },
  errorText: {
    color: "#fff",
    marginTop: 16,
    marginBottom: 24,
    fontSize: 16,
    textAlign: "center",
    paddingHorizontal: 32,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#e8655f",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 30,
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10b981",
    marginRight: 8,
  },
  liveText: {
    color: "#10b981",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
  },
  heroSection: {
    alignItems: "center",
    marginBottom: 24,
    padding: 24,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  heartContainer: {
    position: "relative",
    width: 80,
    height: 80,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  heartRing: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: "rgba(232, 101, 95, 0.3)",
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    lineHeight: 20,
  },
  activitySection: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
  },
  activityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  activityHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  activityLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10b981",
    marginRight: 8,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#10b981",
  },
  activityCount: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
  },
  activityList: {
    gap: 8,
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    padding: 12,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityMessage: {
    fontSize: 13,
    color: "#fff",
    fontWeight: "500",
  },
  activityMeta: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    marginTop: 2,
  },
  activityPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10b981",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  metricCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  metricIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  metricLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 4,
  },
  metricUnit: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
  },
  yearlySection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  yearlyStats: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  yearlyStat: {
    flex: 1,
    alignItems: "center",
  },
  yearlyValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 4,
  },
  yearlyLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
  },
  yearlyDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginHorizontal: 16,
  },
  microDonationSection: {
    backgroundColor: "rgba(232, 101, 95, 0.1)",
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(232, 101, 95, 0.2)",
  },
  microDonationSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    marginBottom: 16,
  },
  amountGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  amountButton: {
    flex: 1,
    minWidth: "30%",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  amountButtonSelected: {
    backgroundColor: "rgba(232, 101, 95, 0.2)",
    borderColor: "#e8655f",
  },
  amountButtonCustom: {
    flex: 1,
    minWidth: "30%",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderStyle: "dashed",
  },
  customInputContainer: {
    alignItems: "center",
    width: "100%",
  },
  customInputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  customInput: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    minWidth: 50,
    textAlign: "right",
    padding: 0,
  },
  customInputEur: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  customInputConfirm: {
    marginTop: 4,
    padding: 4,
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
  },
  amountValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  amountCurrency: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
  },
  amountText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  amountTextSelected: {
    color: "#e8655f",
  },
  amountImpact: {
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
    marginTop: 4,
  },
  amountImpactSelected: {
    color: "rgba(232, 101, 95, 0.8)",
  },
  paymentMethods: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
  },
  paymentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  paymentText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
  },
  calculatorSection: {
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.2)",
  },
  calculatorSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    marginBottom: 16,
  },
  calculatorInput: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  inputPrefix: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    paddingVertical: 14,
  },
  calculatorResults: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  resultRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
  resultItem: {
    flex: 1,
    alignItems: "center",
  },
  resultDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  resultLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 4,
  },
  resultValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#10b981",
  },
  resultHighlight: {
    color: "#f59e0b",
  },
  impactEquivalent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderRadius: 8,
    padding: 12,
  },
  impactText: {
    flex: 1,
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    lineHeight: 18,
  },
  calculatorNote: {
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
    fontStyle: "italic",
  },
  campaignSection: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  campaignBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
    gap: 6,
  },
  campaignBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#f59e0b",
    letterSpacing: 0.5,
  },
  campaignTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 8,
  },
  campaignDescription: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    lineHeight: 20,
    marginBottom: 20,
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressBar: {
    height: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#f59e0b",
    borderRadius: 6,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  progressRaised: {
    fontSize: 14,
    fontWeight: "700",
    color: "#f59e0b",
  },
  progressGoal: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
  },
  progressPercent: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
  },
  ctaButtons: {
    flexDirection: "row",
    gap: 12,
  },
  ctaPrimary: {
    flex: 1,
    backgroundColor: "#e8655f",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  ctaPrimaryText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  ctaSecondary: {
    flex: 1,
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  ctaSecondaryText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  shareSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  shareTitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    marginBottom: 12,
  },
  shareButtons: {
    flexDirection: "row",
    gap: 12,
  },
  shareButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  lastUpdate: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
    marginBottom: 24,
  },
  footer: {
    alignItems: "center",
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  footerText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
  },
  confirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  confirmBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  confirmModal: {
    width: "85%",
    maxWidth: 360,
    backgroundColor: "#1e293b",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    position: "relative",
  },
  confirmCloseButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  confirmIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(232, 101, 95, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
  },
  confirmAmount: {
    fontSize: 36,
    fontWeight: "800",
    color: "#e8655f",
    marginBottom: 12,
  },
  confirmText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
  },
  confirmTax: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 20,
  },
  confirmTaxText: {
    fontSize: 13,
    color: "#10b981",
  },
  confirmButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#e8655f",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: "100%",
    marginBottom: 12,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  confirmCancel: {
    paddingVertical: 8,
  },
  confirmCancelText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
  },
});
