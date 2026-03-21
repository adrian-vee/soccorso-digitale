import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  Pressable,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";

interface FuelAnalytics {
  vehicle: {
    code: string;
    model: string;
    fuelType: string;
    currentKm: number;
    consumptionRate: number;
  };
  thisMonth: PeriodData;
  lastMonth: PeriodData;
  thisYear: PeriodData;
  allTime: PeriodData;
  monthlyBreakdown: MonthlyData[];
  fuelPrice: number;
  co2: {
    thisMonth: number;
    thisYear: number;
  };
  kmPerTrip: number;
}

interface PeriodData {
  km: number;
  trips: number;
  estimatedLiters: number;
  estimatedCost: number;
}

interface MonthlyData {
  month: string;
  year: number;
  trips: number;
  km: number;
  estimatedLiters: number;
  estimatedCost: number;
}

interface FuelPriceResponse {
  date: string;
  province: string;
  stationsCount: number;
  averages: {
    selfService: number;
    fullService: number;
  };
  loroStations: Array<{
    selfServicePrice: number | null;
    fullServicePrice: number | null;
    brandName: string | null;
    stationName: string | null;
  }>;
}

interface FuelCard {
  id: string;
  provider: string;
  cardNumber: string;
  cardPin: string | null;
  expiryDate: string | null;
  holderName: string | null;
  isActive: boolean;
}

function maskCardNumber(cardNumber: string): string {
  if (!cardNumber || cardNumber.length < 4) return cardNumber || "";
  const last4 = cardNumber.slice(-4);
  const masked = cardNumber.slice(0, -4).replace(/./g, "*");
  const groups = [];
  const full = masked + last4;
  for (let i = 0; i < full.length; i += 4) {
    groups.push(full.slice(i, i + 4));
  }
  return groups.join("  ");
}

function FuelCardWallet({ card, vehicleCode, organizationName }: { card: FuelCard | null; vehicleCode: string; organizationName: string }) {
  const { theme } = useTheme();
  const flipProgress = useSharedValue(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const cardScale = useSharedValue(1);

  const displayCard = {
    provider: card?.provider || "LORO",
    cardNumber: card?.cardNumber || "0000000000000000",
    cardPin: card?.cardPin || "----",
    expiryDate: card?.expiryDate ? new Date(card.expiryDate).toLocaleDateString("it-IT", { month: "2-digit", year: "2-digit" }) : "--/--",
  };

  const handleFlip = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    cardScale.value = withSequence(
      withSpring(0.95, { damping: 10, stiffness: 200 }),
      withSpring(1, { damping: 12, stiffness: 150 })
    );
    const toValue = isFlipped ? 0 : 1;
    flipProgress.value = withSpring(toValue, {
      damping: 14,
      stiffness: 100,
      mass: 0.7,
    });
    setIsFlipped(!isFlipped);
  }, [isFlipped]);

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: cardScale.value },
    ],
  }));

  const frontAnimatedStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flipProgress.value, [0, 1], [0, 180], Extrapolation.CLAMP);
    const opacity = interpolate(flipProgress.value, [0, 0.5, 0.5, 1], [1, 1, 0, 0], Extrapolation.CLAMP);
    return {
      transform: [{ perspective: 1200 }, { rotateY: `${rotateY}deg` }],
      opacity,
    };
  });

  const backAnimatedStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flipProgress.value, [0, 1], [180, 360], Extrapolation.CLAMP);
    const opacity = interpolate(flipProgress.value, [0, 0.5, 0.5, 1], [0, 0, 1, 1], Extrapolation.CLAMP);
    return {
      transform: [{ perspective: 1200 }, { rotateY: `${rotateY}deg` }],
      opacity,
    };
  });

  return (
    <Animated.View entering={FadeInDown.springify().damping(16)}>
      <Animated.View style={containerAnimatedStyle}>
        <Pressable onPress={handleFlip} style={styles.fuelCardWrapper}>
          <View style={styles.flipContainer}>
            {/* FRONT */}
            <Animated.View style={[styles.flipCard, frontAnimatedStyle]}>
              <LinearGradient
                colors={["#0A1628", "#0D2B4A", "#143A5C", "#1A4A6E"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.fuelCardGradient}
              >
                <View style={styles.fuelCardTop}>
                  <ThemedText type="h2" style={styles.brandName}>
                    {organizationName}
                  </ThemedText>
                  <View style={styles.contactlessBadge}>
                    <Feather name="wifi" size={16} color="rgba(255,255,255,0.7)" style={{ transform: [{ rotate: "90deg" }] }} />
                  </View>
                </View>

                <View style={styles.chipRow}>
                  <View style={styles.chipOuter}>
                    <LinearGradient
                      colors={["#FFD700", "#DAA520", "#FFD700"]}
                      style={styles.chipGradient}
                    >
                      <View style={styles.chipLines}>
                        <View style={styles.chipLineH} />
                        <View style={styles.chipLineV} />
                      </View>
                    </LinearGradient>
                  </View>
                  <View style={styles.providerTag}>
                    <ThemedText type="small" style={styles.providerTagText}>
                      {displayCard.provider}
                    </ThemedText>
                  </View>
                </View>

                <ThemedText type="h2" style={styles.fuelCardNumber} numberOfLines={1} adjustsFontSizeToFit>
                  {maskCardNumber(displayCard.cardNumber)}
                </ThemedText>

                <View style={styles.fuelCardBottom}>
                  <View style={styles.cardInfoBlock}>
                    <ThemedText type="small" style={styles.fuelCardLabel}>SCADENZA</ThemedText>
                    <ThemedText type="body" style={styles.fuelCardValue}>{displayCard.expiryDate}</ThemedText>
                  </View>
                  <View style={styles.vehicleCodeBlock}>
                    <ThemedText type="small" style={styles.fuelCardLabel}>VEICOLO</ThemedText>
                    <ThemedText type="body" style={styles.vehicleCodeText}>{vehicleCode || "---"}</ThemedText>
                  </View>
                </View>

                <View style={styles.flipHint}>
                  <View style={styles.flipHintPill}>
                    <Feather name="rotate-cw" size={12} color="#FFFFFF" />
                    <ThemedText type="small" style={styles.flipHintText}>Tocca per il PIN</ThemedText>
                  </View>
                </View>
              </LinearGradient>
            </Animated.View>

            {/* BACK */}
            <Animated.View style={[styles.flipCard, styles.flipCardBack, backAnimatedStyle]}>
              <LinearGradient
                colors={["#0A1628", "#0F2440", "#1A3A5C"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.fuelCardGradient}
              >
                <View style={styles.backMagStripe}>
                  <ThemedText type="small" style={styles.magStripeText}>
                    {organizationName}
                  </ThemedText>
                </View>

                <View style={styles.backContent}>
                  <View style={styles.pinSection}>
                    <View style={styles.pinLabelRow}>
                      <View style={styles.pinLockIcon}>
                        <Feather name="shield" size={14} color="#00A651" />
                      </View>
                      <ThemedText type="small" style={styles.pinLabel}>PIN TESSERA</ThemedText>
                    </View>
                    <View style={styles.pinContainer}>
                      {displayCard.cardPin.split("").map((digit, i) => (
                        <View key={i} style={styles.pinDigitBox}>
                          <LinearGradient
                            colors={["rgba(0,102,204,0.25)", "rgba(0,102,204,0.1)"]}
                            style={StyleSheet.absoluteFill}
                          />
                          <ThemedText type="h1" style={styles.pinDigit}>{digit}</ThemedText>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View style={styles.backInfoRow}>
                    <View style={styles.backInfoItem}>
                      <ThemedText type="small" style={styles.backInfoLabel}>VEICOLO</ThemedText>
                      <ThemedText type="body" style={styles.backVehicleCode}>{vehicleCode || "---"}</ThemedText>
                    </View>
                  </View>

                  <View style={styles.backFooter}>
                    <View style={styles.footerDivider} />
                    <ThemedText type="small" style={styles.backFooterText}>
                      Uso esclusivo veicolo aziendale
                    </ThemedText>
                    <ThemedText type="small" style={styles.backFooterText}>
                      In caso di smarrimento contattare la sede
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.flipHint}>
                  <View style={styles.flipHintPill}>
                    <Feather name="rotate-ccw" size={12} color="#FFFFFF" />
                    <ThemedText type="small" style={styles.flipHintText}>Tocca per tornare</ThemedText>
                  </View>
                </View>
              </LinearGradient>
            </Animated.View>
          </View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

function FuelPriceSection({ prices }: { prices: FuelPriceResponse | null }) {
  const { theme } = useTheme();

  const loroStations = prices?.loroStations || [];
  const loroPrice = loroStations.length > 0
    ? Math.round(loroStations.reduce((sum: number, s: any) => sum + (s.selfServicePrice || 0), 0) / loroStations.length * 1000) / 1000
    : null;
  const avgPrice = prices?.averages?.selfService ?? null;

  return (
    <Animated.View entering={FadeInDown.delay(100).springify()}>
      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionIcon, { backgroundColor: theme.warningLight }]}>
              <Feather name="droplet" size={16} color={theme.warning} />
            </View>
            <ThemedText type="h3" style={styles.sectionTitle}>
              Prezzi Gasolio Oggi
            </ThemedText>
          </View>
          {prices?.date ? (
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {new Date(prices.date).toLocaleDateString("it-IT")}
            </ThemedText>
          ) : null}
        </View>

        <View style={styles.priceGrid}>
          <View style={[styles.priceCard, { backgroundColor: theme.primaryLight }]}>
            <Feather name="droplet" size={18} color={theme.primary} style={{ marginBottom: 6 }} />
            <ThemedText type="small" style={{ color: theme.primary, fontWeight: "600", marginBottom: 4 }}>
              LORO CARBURANTI
            </ThemedText>
            <ThemedText type="h1" style={{ color: theme.primary }}>
              {loroPrice != null ? loroPrice.toFixed(3) : (avgPrice != null ? avgPrice.toFixed(3) : "N/D")}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              EUR/litro (self)
            </ThemedText>
          </View>
          <View style={[styles.priceCard, { backgroundColor: theme.successLight }]}>
            <Feather name="trending-down" size={18} color={theme.success} style={{ marginBottom: 6 }} />
            <ThemedText type="small" style={{ color: theme.success, fontWeight: "600", marginBottom: 4 }}>
              MEDIA PROVINCIA
            </ThemedText>
            <ThemedText type="h1" style={{ color: theme.success }}>
              {avgPrice != null ? avgPrice.toFixed(3) : "N/D"}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              EUR/litro (self)
            </ThemedText>
          </View>
        </View>

        {prices?.stationsCount ? (
          <View style={{ marginTop: Spacing.sm, alignItems: "center" }}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Dati da {loroStations.length} stazioni LORO - Prov. {prices.province}
            </ThemedText>
          </View>
        ) : null}
      </Card>
    </Animated.View>
  );
}

function PeriodSummaryCard({ title, icon, data, color, delay }: {
  title: string;
  icon: string;
  data: PeriodData;
  color: string;
  delay: number;
}) {
  const { theme } = useTheme();

  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()} style={{ flex: 1 }}>
      <View style={[styles.periodCard, { backgroundColor: color + "15", borderColor: color + "30" }]}>
        <View style={[styles.periodIconCircle, { backgroundColor: color + "25" }]}>
          <Feather name={icon as any} size={16} color={color} />
        </View>
        <ThemedText type="small" style={{ color, fontWeight: "700", fontSize: 10, marginBottom: 4 }}>
          {title}
        </ThemedText>
        <ThemedText type="h3" style={{ fontWeight: "800", marginBottom: 2 }}>
          {data.km.toLocaleString("it-IT")}
        </ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 10 }}>
          km percorsi
        </ThemedText>
        <View style={[styles.periodDivider, { backgroundColor: color + "20" }]} />
        <ThemedText type="small" style={{ color, fontWeight: "600" }}>
          ~{data.estimatedLiters.toFixed(0)} L
        </ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 10 }}>
          ~{data.estimatedCost.toFixed(0)} EUR
        </ThemedText>
      </View>
    </Animated.View>
  );
}

function MonthlyTrendSection({ breakdown, fuelPrice }: { breakdown: MonthlyData[]; fuelPrice: number }) {
  const { theme } = useTheme();
  const maxKm = Math.max(...breakdown.map(m => m.km), 1);

  return (
    <Animated.View entering={FadeInDown.delay(350).springify()}>
      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionIcon, { backgroundColor: theme.primaryLight }]}>
              <Feather name="bar-chart-2" size={16} color={theme.primary} />
            </View>
            <ThemedText type="h3" style={styles.sectionTitle}>
              Andamento 6 Mesi
            </ThemedText>
          </View>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {fuelPrice.toFixed(3)} EUR/L
          </ThemedText>
        </View>

        <View style={styles.chartContainer}>
          {breakdown.map((month, i) => {
            const barHeight = maxKm > 0 ? (month.km / maxKm) * 100 : 0;
            const isCurrentMonth = i === breakdown.length - 1;

            return (
              <View key={`${month.month}-${month.year}`} style={styles.chartBarWrapper}>
                <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 9, marginBottom: 4 }}>
                  {month.estimatedCost > 0 ? `${Math.round(month.estimatedCost)}` : ""}
                </ThemedText>
                <View style={styles.chartBarContainer}>
                  <View
                    style={[
                      styles.chartBar,
                      {
                        height: `${Math.max(barHeight, 3)}%`,
                        backgroundColor: isCurrentMonth ? theme.primary : theme.primary + "60",
                        borderRadius: 4,
                      },
                    ]}
                  />
                </View>
                <ThemedText type="small" style={{ 
                  color: isCurrentMonth ? theme.primary : theme.textSecondary, 
                  fontSize: 10, 
                  fontWeight: isCurrentMonth ? "700" : "500",
                  marginTop: 4,
                }}>
                  {month.month}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 8 }}>
                  {month.km > 0 ? `${month.km}km` : "-"}
                </ThemedText>
              </View>
            );
          })}
        </View>

        <View style={[styles.chartLegend, { borderTopColor: theme.border }]}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.primary }]} />
            <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 10 }}>
              Mese corrente
            </ThemedText>
          </View>
          <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 10 }}>
            Valori in EUR (sopra) e km (sotto)
          </ThemedText>
        </View>
      </Card>
    </Animated.View>
  );
}

function VehicleInfoSection({ analytics }: { analytics: FuelAnalytics }) {
  const { theme } = useTheme();

  return (
    <Animated.View entering={FadeInDown.delay(400).springify()}>
      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionIcon, { backgroundColor: theme.successLight }]}>
              <Feather name="truck" size={16} color={theme.success} />
            </View>
            <ThemedText type="h3" style={styles.sectionTitle}>
              Info Veicolo
            </ThemedText>
          </View>
        </View>

        <View style={styles.infoGrid}>
          <View style={[styles.infoRow, { borderBottomColor: theme.border }]}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>Veicolo</ThemedText>
            <ThemedText type="body" style={{ fontWeight: "600" }}>
              {analytics.vehicle.code} - {analytics.vehicle.model}
            </ThemedText>
          </View>
          <View style={[styles.infoRow, { borderBottomColor: theme.border }]}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>Contachilometri</ThemedText>
            <ThemedText type="body" style={{ fontWeight: "600" }}>
              {analytics.vehicle.currentKm.toLocaleString("it-IT")} km
            </ThemedText>
          </View>
          <View style={[styles.infoRow, { borderBottomColor: theme.border }]}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>Consumo stimato</ThemedText>
            <ThemedText type="body" style={{ fontWeight: "600" }}>
              {analytics.vehicle.consumptionRate} L/100km
            </ThemedText>
          </View>
          <View style={[styles.infoRow, { borderBottomColor: theme.border }]}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>Km medi per viaggio</ThemedText>
            <ThemedText type="body" style={{ fontWeight: "600" }}>
              {analytics.kmPerTrip} km
            </ThemedText>
          </View>
          <View style={[styles.infoRow, { borderBottomColor: theme.border }]}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>CO2 mese corrente</ThemedText>
            <ThemedText type="body" style={{ fontWeight: "600", color: theme.warning }}>
              {analytics.co2.thisMonth.toFixed(1)} kg
            </ThemedText>
          </View>
          <View style={styles.infoRow}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>CO2 anno corrente</ThemedText>
            <ThemedText type="body" style={{ fontWeight: "600", color: theme.warning }}>
              {analytics.co2.thisYear.toFixed(1)} kg
            </ThemedText>
          </View>
        </View>
      </Card>
    </Animated.View>
  );
}

function ConsumptionOverview({ analytics }: { analytics: FuelAnalytics }) {
  const { theme } = useTheme();
  const kmChange = analytics.lastMonth.km > 0
    ? Math.round(((analytics.thisMonth.km - analytics.lastMonth.km) / analytics.lastMonth.km) * 100)
    : 0;

  return (
    <Animated.View entering={FadeInDown.delay(200).springify()}>
      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionIcon, { backgroundColor: theme.primaryLight }]}>
              <Feather name="activity" size={16} color={theme.primary} />
            </View>
            <ThemedText type="h3" style={styles.sectionTitle}>
              Stime Consumo
            </ThemedText>
          </View>
          <View style={[styles.badge, { backgroundColor: theme.warningLight }]}>
            <ThemedText type="small" style={{ color: theme.warning, fontWeight: "600", fontSize: 9 }}>
              AUTOMATICO
            </ThemedText>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.sm }}>
          <PeriodSummaryCard
            title="QUESTO MESE"
            icon="calendar"
            data={analytics.thisMonth}
            color={theme.primary}
            delay={220}
          />
          <PeriodSummaryCard
            title="MESE SCORSO"
            icon="clock"
            data={analytics.lastMonth}
            color={theme.success}
            delay={240}
          />
        </View>

        {kmChange !== 0 ? (
          <View style={[styles.trendBadge, { backgroundColor: kmChange > 0 ? theme.errorLight : theme.successLight }]}>
            <Feather
              name={kmChange > 0 ? "trending-up" : "trending-down"}
              size={14}
              color={kmChange > 0 ? theme.error : theme.success}
            />
            <ThemedText type="small" style={{ 
              color: kmChange > 0 ? theme.error : theme.success, 
              fontWeight: "600",
              marginLeft: 6,
            }}>
              {kmChange > 0 ? "+" : ""}{kmChange}% rispetto al mese scorso
            </ThemedText>
          </View>
        ) : null}

        <View style={{ flexDirection: "row", gap: Spacing.sm }}>
          <PeriodSummaryCard
            title="ANNO"
            icon="trending-up"
            data={analytics.thisYear}
            color={theme.warning}
            delay={260}
          />
          <PeriodSummaryCard
            title="TOTALE"
            icon="database"
            data={analytics.allTime}
            color="#8B5CF6"
            delay={280}
          />
        </View>

        <View style={[styles.disclaimerRow, { borderTopColor: theme.border }]}>
          <Feather name="info" size={12} color={theme.textSecondary} />
          <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 10, flex: 1, marginLeft: 6 }}>
            Stime basate su {analytics.vehicle.consumptionRate} L/100km e prezzo medio {analytics.fuelPrice.toFixed(3)} EUR/L. Calcolato automaticamente dai viaggi registrati.
          </ThemedText>
        </View>
      </Card>
    </Animated.View>
  );
}

export default function FuelCardScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user } = useAuth();

  const vehicleId = user?.vehicle?.id;

  const { data: fuelCardsData } = useQuery<FuelCard[]>({
    queryKey: [`/api/fuel-cards?vehicleId=${vehicleId}`],
    enabled: !!vehicleId,
  });
  const fuelCard = fuelCardsData?.[0] ?? null;

  const { data: fuelPrices } = useQuery<FuelPriceResponse>({
    queryKey: ["/api/fuel-prices?province=VR"],
  });

  const { data: analytics, isLoading } = useQuery<FuelAnalytics>({
    queryKey: [`/api/fuel-analytics?vehicleId=${vehicleId}`],
    enabled: !!vehicleId,
  });

  if (!vehicleId) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centerEmpty}>
          <Feather name="credit-card" size={48} color={theme.textSecondary} />
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
        <FuelCardWallet card={fuelCard || null} vehicleCode={user?.vehicle?.code || ""} organizationName={user?.organization?.name?.toUpperCase() || "SOCCORSO DIGITALE"} />

        <FuelPriceSection prices={fuelPrices || null} />

        {isLoading ? (
          <Card style={styles.sectionCard}>
            <ActivityIndicator color={theme.primary} style={{ paddingVertical: Spacing.xl }} />
            <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center", paddingBottom: Spacing.md }}>
              Calcolo stime in corso...
            </ThemedText>
          </Card>
        ) : analytics ? (
          <>
            <ConsumptionOverview analytics={analytics} />
            <MonthlyTrendSection breakdown={analytics.monthlyBreakdown} fuelPrice={analytics.fuelPrice} />
            <VehicleInfoSection analytics={analytics} />
          </>
        ) : (
          <Card style={styles.sectionCard}>
            <View style={styles.emptyState}>
              <Feather name="bar-chart-2" size={32} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm, textAlign: "center" }}>
                Nessun dato disponibile per il calcolo delle stime
              </ThemedText>
            </View>
          </Card>
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
  fuelCardWrapper: {
    marginBottom: Spacing.lg,
  },
  flipContainer: {
    height: 220,
    position: "relative",
  },
  flipCard: {
    position: "absolute",
    width: "100%",
    height: "100%",
    backfaceVisibility: "hidden",
    borderRadius: BorderRadius["2xl"],
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
      default: {},
    }),
  },
  flipCardBack: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  fuelCardGradient: {
    padding: Spacing.xl,
    borderRadius: BorderRadius["2xl"],
    flex: 1,
    justifyContent: "space-between",
  },
  fuelCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 2,
  },
  brandName: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 4,
  },
  contactlessBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  chipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: Spacing.md,
    zIndex: 2,
  },
  chipOuter: {
    width: 48,
    height: 34,
    borderRadius: 7,
    overflow: "hidden",
  },
  chipGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chipLines: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  chipLineH: {
    position: "absolute",
    left: 8,
    right: 8,
    height: 1,
    backgroundColor: "rgba(180,130,0,0.5)",
  },
  chipLineV: {
    position: "absolute",
    top: 6,
    bottom: 6,
    width: 1,
    backgroundColor: "rgba(180,130,0,0.5)",
  },
  providerTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  providerTagText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
  },
  fuelCardNumber: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 2,
    marginTop: Spacing.md,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    zIndex: 2,
  },
  fuelCardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: Spacing.sm,
    zIndex: 2,
  },
  cardInfoBlock: {},
  fuelCardLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 8,
    fontWeight: "600",
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  fuelCardValue: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 13,
  },
  vehicleCodeBlock: {
    alignItems: "flex-end",
  },
  vehicleCodeText: {
    color: "#4DA6FF",
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: 1,
    textAlign: "center",
  },
  flipHint: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    zIndex: 2,
  },
  flipHintPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  flipHintText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  backMagStripe: {
    height: 38,
    backgroundColor: "rgba(0,0,0,0.7)",
    marginHorizontal: -Spacing.xl,
    marginTop: -Spacing.sm,
    marginBottom: Spacing.md,
    justifyContent: "center",
    alignItems: "center",
  },
  magStripeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 4,
  },
  backContent: {
    flex: 1,
    justifyContent: "space-between",
    zIndex: 2,
  },
  pinSection: {
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  pinLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: Spacing.sm,
  },
  pinLockIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,166,81,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  pinLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 3,
  },
  pinContainer: {
    flexDirection: "row",
    gap: 10,
  },
  pinDigitBox: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,102,204,0.4)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  pinDigit: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "800",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  backInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  backInfoItem: {},
  backInfoLabel: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  backInfoValue: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 12,
  },
  backVehicleCode: {
    color: "#00A651",
    fontWeight: "800",
    fontSize: 14,
    letterSpacing: 2,
  },
  backFooter: {
    alignItems: "center",
    gap: 3,
  },
  footerDivider: {
    width: "40%",
    height: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginBottom: 6,
  },
  backFooterText: {
    color: "rgba(255,255,255,0.25)",
    fontSize: 8,
    textAlign: "center",
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
  priceGrid: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  priceCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  periodCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    borderWidth: 1,
  },
  periodIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  periodDivider: {
    width: "60%",
    height: 1,
    marginVertical: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  disclaimerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  chartContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 140,
    paddingHorizontal: 4,
  },
  chartBarWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    height: "100%",
  },
  chartBarContainer: {
    flex: 1,
    width: "60%",
    justifyContent: "flex-end",
    maxWidth: 28,
  },
  chartBar: {
    width: "100%",
    minHeight: 4,
  },
  chartLegend: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  infoGrid: {
    gap: 0,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  emptyState: {
    paddingVertical: Spacing.xl,
    alignItems: "center",
  },
});
