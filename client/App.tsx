import React, { useMemo, useEffect, useState } from "react";
import { StyleSheet, Platform, useColorScheme, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar, setStatusBarStyle } from "expo-status-bar";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";

import RootStackNavigator from "@/navigation/RootStackNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AnimatedSplash } from "@/components/AnimatedSplash";
import { PrivacyConsentModal } from "@/components/PrivacyConsentModal";
import { AuthProvider } from "@/contexts/AuthContext";
import { GpsTrackingProvider } from "@/contexts/GpsTrackingContext";
import { RealtimeSyncProvider } from "@/contexts/RealtimeSyncContext";
import ImpattoDashboardScreen from "@/screens/ImpattoDashboardScreen";
import PublicConfidentialityScreen from "@/screens/PublicConfidentialityScreen";

function isImpattoRoute(): boolean {
  if (Platform.OS !== "web") return false;
  try {
    return window.location.pathname === "/impatto" || window.location.pathname === "/impatto/";
  } catch {
    return false;
  }
}

function isConfidentialityRoute(): boolean {
  if (Platform.OS !== "web") return false;
  try {
    const path = window.location.pathname.replace(/\/$/, "");
    return path === "/impegno-riservatezza";
  } catch {
    return false;
  }
}

function PrivacyGate({ children }: { children: React.ReactNode }) {
  const [hasConsent, setHasConsent] = useState(false);

  if (!hasConsent) {
    return (
      <View style={styles.root}>
        <PrivacyConsentModal onAccept={() => setHasConsent(true)} />
      </View>
    );
  }

  return <>{children}</>;
}

export default function App() {
  const showImpatto = useMemo(() => isImpattoRoute(), []);
  const showConfidentiality = useMemo(() => isConfidentialityRoute(), []);
  const colorScheme = useColorScheme();
  const statusBarStyle = colorScheme === "dark" ? "light" : "dark";

  useEffect(() => {
    setStatusBarStyle(statusBarStyle);
  }, [statusBarStyle]);


  if (showConfidentiality) {
    return (
      <ErrorBoundary>
        <SafeAreaProvider>
          <GestureHandlerRootView style={styles.root}>
            <QueryClientProvider client={queryClient}>
              <PublicConfidentialityScreen />
            </QueryClientProvider>
            <StatusBar style="dark" />
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </ErrorBoundary>
    );
  }

  if (showImpatto) {
    return (
      <ErrorBoundary>
        <SafeAreaProvider>
          <GestureHandlerRootView style={styles.root}>
            <QueryClientProvider client={queryClient}>
              <ImpattoDashboardScreen />
            </QueryClientProvider>
            <StatusBar style="light" />
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <AnimatedSplash>
        <SafeAreaProvider>
          <GestureHandlerRootView style={styles.root}>
            <PrivacyGate>
              <QueryClientProvider client={queryClient}>
                <AuthProvider>
                  <RealtimeSyncProvider>
                    <GpsTrackingProvider>
                      <KeyboardProvider>
                        <NavigationContainer>
                          <RootStackNavigator />
                        </NavigationContainer>
                        <StatusBar style={statusBarStyle} />
                      </KeyboardProvider>
                    </GpsTrackingProvider>
                  </RealtimeSyncProvider>
                </AuthProvider>
              </QueryClientProvider>
            </PrivacyGate>
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </AnimatedSplash>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
