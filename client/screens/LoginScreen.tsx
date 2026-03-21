import React, { useState, useMemo, useEffect } from "react";
import { 
  View, 
  StyleSheet, 
  Image, 
  Alert, 
  Platform,
  Pressable,
  useColorScheme
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
} from "react-native-reanimated";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { TextInput } from "@/components/TextInput";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";

const SAVED_CREDENTIALS_KEY = "soccorsodigitale_saved_credentials";



const GREETINGS = {
  morning: [
    { greeting: "Buongiorno!", message: "Pronti a fare la differenza oggi?" },
    { greeting: "Buongiorno squadra!", message: "Un nuovo turno, tante vite da migliorare" },
    { greeting: "Buongiorno!", message: "Il soccorso sanitario conta su di voi" },
    { greeting: "Buongiorno!", message: "Iniziamo questa giornata con energia" },
    { greeting: "Buongiorno!", message: "Ogni servizio conta, ogni paziente merita il meglio" },
    { greeting: "Buongiorno!", message: "Siete il cuore pulsante del soccorso" },
    { greeting: "Buongiorno!", message: "Professionalita e dedizione, sempre" },
    { greeting: "Buongiorno!", message: "Pronti per un'altra giornata al servizio degli altri" },
  ],
  afternoon: [
    { greeting: "Buon pomeriggio!", message: "Grazie per l'energia che ci mettete" },
    { greeting: "Buon pomeriggio!", message: "Il vostro impegno fa la differenza" },
    { greeting: "Buon pomeriggio!", message: "Forza equipaggio, il pomeriggio e' nostro" },
    { greeting: "Buon pomeriggio!", message: "Continuate cosi, siete formidabili" },
    { greeting: "Buon pomeriggio!", message: "Ogni corsa e' una missione importante" },
    { greeting: "Buon pomeriggio!", message: "La vostra dedizione non passa inosservata" },
    { greeting: "Buon pomeriggio!", message: "Avanti tutta, il meglio deve ancora venire" },
    { greeting: "Buon pomeriggio!", message: "Professionalita al servizio della comunita" },
  ],
  evening: [
    { greeting: "Buonasera!", message: "Il vostro impegno illumina la citta" },
    { greeting: "Buonasera!", message: "Siamo al vostro fianco fino alla fine del turno" },
    { greeting: "Buonasera!", message: "Grazie per il servizio instancabile" },
    { greeting: "Buonasera!", message: "La sera porta nuove sfide, voi siete pronti" },
    { greeting: "Buonasera!", message: "Ogni viaggio e' un atto di cura" },
    { greeting: "Buonasera!", message: "Il vostro lavoro fa battere il cuore della citta" },
    { greeting: "Buonasera!", message: "Eroi silenziosi al servizio di tutti" },
    { greeting: "Buonasera!", message: "Grazie per il vostro impegno quotidiano" },
  ],
  night: [
    { greeting: "Buon turno notturno!", message: "Il servizio non dorme mai grazie a voi" },
    { greeting: "Buon turno!", message: "Notte di servizio, cuore e attenzione massima" },
    { greeting: "Buon turno notturno!", message: "Siete i guardiani della notte" },
    { greeting: "Buon turno!", message: "Mentre la citta riposa, voi vegliate" },
    { greeting: "Buon turno notturno!", message: "Il vostro impegno notturno e' prezioso" },
    { greeting: "Buon turno!", message: "Professionisti sempre, anche nelle ore piu' difficili" },
    { greeting: "Buon turno notturno!", message: "La notte ha bisogno di eroi come voi" },
    { greeting: "Buon turno!", message: "Grazie per essere sempre presenti" },
  ],
};

function getMotivationalMessage(): { greeting: string; message: string } {
  const hour = new Date().getHours();
  let messages: { greeting: string; message: string }[];
  
  if (hour >= 5 && hour < 12) {
    messages = GREETINGS.morning;
  } else if (hour >= 12 && hour < 18) {
    messages = GREETINGS.afternoon;
  } else if (hour >= 18 && hour < 22) {
    messages = GREETINGS.evening;
  } else {
    messages = GREETINGS.night;
  }
  
  return messages[Math.floor(Math.random() * messages.length)];
}

function OfficialLogo() {
  const pulseScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.5);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.02, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const animatedLogoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const animatedGlowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <View style={styles.logoContainer}>
      <Animated.View style={[styles.logoGlowContainer, animatedGlowStyle]}>
        <View style={styles.logoGlow} />
      </Animated.View>
      <Animated.View style={[styles.logoContent, animatedLogoStyle]}>
        <View style={styles.logoIconContainer}>
          <Feather name="activity" size={36} color="#FFFFFF" />
        </View>
        <View style={styles.logoTextContainer}>
          <ThemedText style={styles.logoTextMain} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>SOCCORSO</ThemedText>
          <ThemedText style={styles.logoTextAccent} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>DIGITALE</ThemedText>
        </View>
        <View style={styles.logoTagline}>
          <View style={styles.logoTaglineLine} />
          <ThemedText style={styles.logoTaglineText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>il futuro del soccorso</ThemedText>
          <View style={styles.logoTaglineLine} />
        </View>
      </Animated.View>
    </View>
  );
}

function LoadingOverlay() {
  const rotation = useSharedValue(0);
  const scale = useSharedValue(0.8);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 1000, easing: Easing.linear }),
      -1,
      false
    );
    scale.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 500 }),
        withTiming(0.8, { duration: 500 })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${rotation.value}deg` },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View style={[styles.loadingContainer]} entering={FadeIn.duration(200)}>
      <BlurView intensity={80} style={styles.loadingBlur} tint="dark">
        <Animated.View style={animatedStyle}>
          <Feather name="loader" size={32} color="#FFFFFF" />
        </Animated.View>
        <ThemedText type="body" style={styles.loadingText}>
          Accesso in corso...
        </ThemedText>
      </BlurView>
    </Animated.View>
  );
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { login } = useAuth();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const motivationalMessage = useMemo(() => getMotivationalMessage(), []);

  useEffect(() => {
    loadSavedCredentials();
  }, []);

  const loadSavedCredentials = async () => {
    if (Platform.OS === "web") return;
    try {
      const saved = await SecureStore.getItemAsync(SAVED_CREDENTIALS_KEY);
      if (saved) {
        const { email: savedEmail, password: savedPassword } = JSON.parse(saved);
        setEmail(savedEmail || "");
        setPassword(savedPassword || "");
        setRememberMe(true);
      }
    } catch (error) {
      console.log("Could not load saved credentials");
    }
  };

  const saveCredentials = async (emailToSave: string, passwordToSave: string) => {
    if (Platform.OS === "web") return;
    try {
      await SecureStore.setItemAsync(
        SAVED_CREDENTIALS_KEY,
        JSON.stringify({ email: emailToSave, password: passwordToSave })
      );
    } catch (error) {
      console.log("Could not save credentials");
    }
  };

  const clearSavedCredentials = async () => {
    if (Platform.OS === "web") return;
    try {
      await SecureStore.deleteItemAsync(SAVED_CREDENTIALS_KEY);
    } catch (error) {
      console.log("Could not clear credentials");
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Errore", "Inserisci email e password");
      return;
    }

    setIsLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      if (rememberMe) {
        await saveCredentials(email.trim().toLowerCase(), password);
      } else {
        await clearSavedCredentials();
      }
    } catch (error: any) {
      Alert.alert("Errore", error.message || "Credenziali non valide");
    } finally {
      setIsLoading(false);
    }
  };

  const gradientColors = isDark 
    ? ["#0A1628", "#0D2442", "#0A1628"] as const
    : ["#0052A3", "#0066CC", "#004488"] as const;

  return (
    <View style={styles.rootContainer}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      
      <KeyboardAwareScrollViewCompat
        style={styles.scrollView}
        contentContainerStyle={[
          styles.container,
          { 
            paddingTop: insets.top + Spacing["2xl"],
            paddingBottom: insets.bottom + Spacing["2xl"],
          }
        ]}
      >
        <Animated.View 
          style={styles.headerSection}
          entering={FadeInDown.duration(800).delay(200)}
        >
          <OfficialLogo />
        </Animated.View>

        <Animated.View 
          style={styles.greetingCard}
          entering={FadeInUp.duration(800).delay(800)}
        >
          {Platform.OS === "ios" ? (
            <BlurView 
              intensity={40} 
              tint={isDark ? "dark" : "light"}
              style={styles.greetingBlur}
            >
              <Feather name="heart" size={20} color="#FFFFFF" style={styles.greetingIcon} />
              <ThemedText type="body" style={styles.greetingText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                {motivationalMessage.greeting}
              </ThemedText>
              <ThemedText type="small" style={styles.greetingMessage} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                {motivationalMessage.message}
              </ThemedText>
            </BlurView>
          ) : (
            <View style={styles.greetingBlurAndroid}>
              <Feather name="heart" size={20} color="#FFFFFF" style={styles.greetingIcon} />
              <ThemedText type="body" style={styles.greetingText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                {motivationalMessage.greeting}
              </ThemedText>
              <ThemedText type="small" style={styles.greetingMessage} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                {motivationalMessage.message}
              </ThemedText>
            </View>
          )}
        </Animated.View>

        <Animated.View 
          style={styles.formCard}
          entering={FadeInUp.duration(800).delay(1000)}
        >
          {Platform.OS === "ios" ? (
            <BlurView 
              intensity={60} 
              tint={isDark ? "dark" : "light"}
              style={styles.formBlur}
            >
              <ThemedText type="h3" style={styles.formTitle}>
                Accedi al tuo account
              </ThemedText>

              <View style={styles.inputContainer}>
                <View>
                  <ThemedText type="label" style={styles.inputLabel}>Email</ThemedText>
                  <View style={[
                    styles.inputWrapper,
                    emailFocused && styles.inputWrapperFocused
                  ]}>
                    <Feather name="mail" size={20} color="rgba(255,255,255,0.7)" style={styles.inputIcon} />
                    <TextInput
                      placeholder="email@esempio.com"
                      placeholderTextColor="rgba(255,255,255,0.5)"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      onFocus={() => setEmailFocused(true)}
                      onBlur={() => setEmailFocused(false)}
                      style={styles.input}
                      accessibilityLabel="Email"
                    />
                  </View>
                </View>

                <View>
                  <ThemedText type="label" style={styles.inputLabel}>Password</ThemedText>
                  <View style={[
                    styles.inputWrapper,
                    passwordFocused && styles.inputWrapperFocused
                  ]}>
                    <Feather name="lock" size={20} color="rgba(255,255,255,0.7)" style={styles.inputIcon} />
                    <TextInput
                      placeholder="Inserisci password"
                      placeholderTextColor="rgba(255,255,255,0.5)"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      onFocus={() => setPasswordFocused(true)}
                      onBlur={() => setPasswordFocused(false)}
                      style={styles.input}
                      accessibilityLabel="Password"
                    />
                    <Pressable 
                      onPress={() => setShowPassword(!showPassword)} 
                      style={styles.eyeButton}
                      accessibilityLabel={showPassword ? "Nascondi password" : "Mostra password"}
                    >
                      <Feather name={showPassword ? "eye-off" : "eye"} size={20} color="rgba(255,255,255,0.7)" />
                    </Pressable>
                  </View>
                </View>
              </View>

              <View style={styles.optionsRow}>
                <Pressable 
                  style={styles.rememberMe}
                  onPress={() => setRememberMe(!rememberMe)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: rememberMe }}
                >
                  <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                    {rememberMe ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
                  </View>
                  <ThemedText type="small" style={styles.rememberMeText}>Ricordami</ThemedText>
                </Pressable>
                <Pressable onPress={() => Alert.alert("Info", "Contatta l'amministratore per reimpostare la password")}>
                  <ThemedText type="small" style={styles.forgotPassword}>Password dimenticata?</ThemedText>
                </Pressable>
              </View>

              <Pressable
                onPress={handleLogin}
                disabled={isLoading}
                style={({ pressed }) => [
                  styles.loginButton,
                  pressed && styles.loginButtonPressed,
                  isLoading && styles.loginButtonDisabled,
                ]}
              >
                <LinearGradient
                  colors={["#0066CC", "#004488"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.loginButtonGradient}
                >
                  <Feather name="log-in" size={20} color="#FFFFFF" />
                  <ThemedText type="body" style={styles.loginButtonText}>
                    Accedi
                  </ThemedText>
                </LinearGradient>
              </Pressable>
            </BlurView>
          ) : (
            <View style={styles.formBlurAndroid}>
              <ThemedText type="h3" style={styles.formTitle}>
                Accedi al tuo account
              </ThemedText>

              <View style={styles.inputContainer}>
                <View>
                  <ThemedText type="label" style={styles.inputLabel}>Email</ThemedText>
                  <View style={[
                    styles.inputWrapper,
                    emailFocused && styles.inputWrapperFocused
                  ]}>
                    <Feather name="mail" size={20} color="rgba(255,255,255,0.7)" style={styles.inputIcon} />
                    <TextInput
                      placeholder="email@esempio.com"
                      placeholderTextColor="rgba(255,255,255,0.5)"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      onFocus={() => setEmailFocused(true)}
                      onBlur={() => setEmailFocused(false)}
                      style={styles.input}
                      accessibilityLabel="Email"
                    />
                  </View>
                </View>

                <View>
                  <ThemedText type="label" style={styles.inputLabel}>Password</ThemedText>
                  <View style={[
                    styles.inputWrapper,
                    passwordFocused && styles.inputWrapperFocused
                  ]}>
                    <Feather name="lock" size={20} color="rgba(255,255,255,0.7)" style={styles.inputIcon} />
                    <TextInput
                      placeholder="Inserisci password"
                      placeholderTextColor="rgba(255,255,255,0.5)"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      onFocus={() => setPasswordFocused(true)}
                      onBlur={() => setPasswordFocused(false)}
                      style={styles.input}
                      accessibilityLabel="Password"
                    />
                    <Pressable 
                      onPress={() => setShowPassword(!showPassword)} 
                      style={styles.eyeButton}
                      accessibilityLabel={showPassword ? "Nascondi password" : "Mostra password"}
                    >
                      <Feather name={showPassword ? "eye-off" : "eye"} size={20} color="rgba(255,255,255,0.7)" />
                    </Pressable>
                  </View>
                </View>
              </View>

              <View style={styles.optionsRow}>
                <Pressable 
                  style={styles.rememberMe}
                  onPress={() => setRememberMe(!rememberMe)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: rememberMe }}
                >
                  <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                    {rememberMe ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
                  </View>
                  <ThemedText type="small" style={styles.rememberMeText}>Ricordami</ThemedText>
                </Pressable>
                <Pressable onPress={() => Alert.alert("Info", "Contatta l'amministratore per reimpostare la password")}>
                  <ThemedText type="small" style={styles.forgotPassword}>Password dimenticata?</ThemedText>
                </Pressable>
              </View>

              <Pressable
                onPress={handleLogin}
                disabled={isLoading}
                style={({ pressed }) => [
                  styles.loginButton,
                  pressed && styles.loginButtonPressed,
                  isLoading && styles.loginButtonDisabled,
                ]}
              >
                <LinearGradient
                  colors={["#0066CC", "#004488"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.loginButtonGradient}
                >
                  <Feather name="log-in" size={20} color="#FFFFFF" />
                  <ThemedText type="body" style={styles.loginButtonText}>
                    Accedi
                  </ThemedText>
                </LinearGradient>
              </Pressable>
            </View>
          )}
        </Animated.View>

        <Animated.View 
          style={styles.footer}
          entering={FadeInUp.duration(600).delay(1200)}
        >
          <ThemedText type="small" style={styles.footerText}>
            SOCCORSO DIGITALE
          </ThemedText>
        </Animated.View>
      </KeyboardAwareScrollViewCompat>

      {isLoading && <LoadingOverlay />}
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: "center",
    alignItems: "center",
  },
  headerSection: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: Spacing.lg,
    position: "relative",
  },
  logoGlowContainer: {
    position: "absolute",
    top: -20,
    left: -40,
    right: -40,
    bottom: -20,
    alignItems: "center",
    justifyContent: "center",
  },
  logoGlow: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#00D4FF",
    opacity: 0.15,
  },
  logoContent: {
    alignItems: "center",
  },
  logoIconContainer: {
    marginBottom: Spacing.md,
  },
  logoIconGradient: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#00D4FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  logoTextContainer: {
    alignItems: "center",
  },
  logoTextMain: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 1,
    textShadowColor: "rgba(0, 212, 255, 0.5)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  logoTextAccent: {
    fontSize: 20,
    fontWeight: "300",
    color: "#00D4FF",
    letterSpacing: 3,
    marginTop: -4,
  },
  logoTagline: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  logoTaglineLine: {
    width: 30,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  logoTaglineText: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.6)",
    textTransform: "uppercase",
    letterSpacing: 2,
    fontWeight: "500",
  },
  appBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,102,204,0.9)",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
  appBadgeText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 0.5,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "800",
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  statLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 2,
  },
  greetingCard: {
    width: "100%",
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
  },
  greetingBlur: {
    padding: Spacing.lg,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  greetingBlurAndroid: {
    padding: Spacing.lg,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: BorderRadius.xl,
  },
  greetingIcon: {
    marginBottom: Spacing.sm,
  },
  greetingText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
    textAlign: "center",
    flexShrink: 1,
  },
  greetingMessage: {
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    marginTop: Spacing.xs,
    fontWeight: "500",
  },
  formCard: {
    width: "100%",
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
  },
  formBlur: {
    padding: Spacing.xl,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  formBlurAndroid: {
    padding: Spacing.xl,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: BorderRadius.xl,
  },
  formTitle: {
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: Spacing.xl,
    fontWeight: "700",
    fontSize: 20,
  },
  inputLabel: {
    color: "rgba(255,255,255,0.9)",
    marginBottom: Spacing.xs,
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputContainer: {
    gap: Spacing.lg,
    marginBottom: Spacing.md,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingLeft: Spacing.md,
    paddingRight: 48,
    height: 52,
    position: "relative",
  },
  inputWrapperFocused: {
    borderColor: "rgba(255,255,255,0.5)",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  inputIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 16,
    paddingVertical: 0,
    backgroundColor: "transparent",
    borderWidth: 0,
  },
  eyeButton: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  optionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  rememberMe: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: "#0066CC",
    borderColor: "#0066CC",
  },
  rememberMeText: {
    color: "rgba(255,255,255,0.8)",
  },
  forgotPassword: {
    color: "rgba(255,255,255,0.7)",
    textDecorationLine: "underline",
  },
  loginButton: {
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  loginButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 56,
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  floatingCross: {
    position: "absolute",
    zIndex: 0,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  loadingBlur: {
    padding: Spacing["2xl"],
    borderRadius: BorderRadius.xl,
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  loadingText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  footer: {
    marginTop: Spacing["2xl"],
    alignItems: "center",
  },
  footerText: {
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    marginBottom: Spacing.sm,
    fontSize: 12,
  },
  footerLocations: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  footerLocation: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
  },
  footerDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "rgba(255,255,255,0.4)",
    marginHorizontal: Spacing.sm,
  },
});
