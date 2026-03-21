import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { WebView } from "react-native-webview";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { HeaderButton } from "@react-navigation/elements";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { getApiUrl } from "@/lib/query-client";
import { Spacing } from "@/constants/theme";

type TripReportRouteProp = RouteProp<{
  TripReport: { tripId: string };
}>;

export default function TripReportScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation();
  const route = useRoute<TripReportRouteProp>();
  const { theme, isDark } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const tripId = route.params?.tripId;
  const baseUrl = getApiUrl();
  const reportUrl = new URL(`api/reports/trip/${tripId}/pdf`, baseUrl).href;

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: "Scheda Viaggio",
      headerRight: () => (
        <HeaderButton
          onPress={handleShare}
          accessibilityLabel="Condividi"
        >
          <Feather name="share" size={22} color={theme.primary} />
        </HeaderButton>
      ),
    });
  }, [navigation, theme.primary]);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Scheda Viaggio\n${reportUrl}`,
        url: reportUrl,
      });
    } catch (error) {
      console.log("Share error:", error);
    }
  };

  if (Platform.OS === "web") {
    return (
      <ThemedView style={[styles.container, { paddingTop: Spacing.xl, paddingBottom: tabBarHeight }]}>
        <View style={styles.webFallback}>
          <View style={[styles.iconContainer, { backgroundColor: theme.primaryLight }]}>
            <Feather name="file-text" size={48} color={theme.primary} />
          </View>
          <ThemedText type="h2" style={styles.title}>
            Report Viaggio
          </ThemedText>
          <ThemedText type="body" style={styles.description}>
            Il report si aprira in una nuova finestra del browser.
          </ThemedText>
          <Button
            onPress={() => window.open(reportUrl, "_blank")}
            style={styles.button}
          >
            Apri Report PDF
          </Button>
          <Button
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            Indietro
          </Button>
        </View>
      </ThemedView>
    );
  }

  if (hasError) {
    return (
      <ThemedView style={[styles.container, { paddingTop: Spacing.xl, paddingBottom: tabBarHeight }]}>
        <View style={styles.webFallback}>
          <View style={[styles.iconContainer, { backgroundColor: theme.errorLight }]}>
            <Feather name="alert-circle" size={48} color={theme.error} />
          </View>
          <ThemedText type="h2" style={styles.title}>
            Errore di caricamento
          </ThemedText>
          <ThemedText type="body" style={styles.description}>
            Impossibile caricare il report. Verifica la connessione e riprova.
          </ThemedText>
          <Button
            onPress={() => {
              setHasError(false);
              setIsLoading(true);
            }}
            style={styles.button}
          >
            Riprova
          </Button>
          <Button
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            Indietro
          </Button>
        </View>
      </ThemedView>
    );
  }

  return (
    <View style={[styles.container, { marginBottom: tabBarHeight }]}>
      <WebView
        source={{ uri: reportUrl }}
        style={styles.webview}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
        scalesPageToFit
        javaScriptEnabled
      />
      {isLoading ? (
        <View style={[styles.loadingOverlay, { backgroundColor: isDark ? "rgba(15,23,42,0.9)" : "rgba(255,255,255,0.9)" }]}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText type="body" style={styles.loadingText}>
            Caricamento report...
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: Spacing.md,
  },
  webFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  description: {
    textAlign: "center",
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  button: {
    marginBottom: Spacing.md,
    minWidth: 200,
  },
  backButton: {
    minWidth: 200,
  },
});
