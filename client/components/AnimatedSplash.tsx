import React, { useEffect, useState, useMemo } from "react";
import { View, StyleSheet, Dimensions, Platform, Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  withRepeat,
  withDelay,
  interpolate,
  Easing,
  withSequence,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import * as SplashScreen from "expo-splash-screen";
import * as Haptics from "expo-haptics";

const { width, height } = Dimensions.get("window");

interface AnimatedSplashProps {
  children: React.ReactNode;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
}

function FloatingParticle({ particle }: { particle: Particle }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const scale = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withDelay(
      particle.delay,
      withRepeat(
        withSequence(
          withTiming(0.8, { duration: particle.duration * 0.3 }),
          withTiming(0.3, { duration: particle.duration * 0.4 }),
          withTiming(0, { duration: particle.duration * 0.3 })
        ),
        -1,
        false
      )
    );

    translateY.value = withDelay(
      particle.delay,
      withRepeat(
        withTiming(-80, { duration: particle.duration, easing: Easing.linear }),
        -1,
        false
      )
    );

    translateX.value = withDelay(
      particle.delay,
      withRepeat(
        withSequence(
          withTiming(15, { duration: particle.duration * 0.5 }),
          withTiming(-15, { duration: particle.duration * 0.5 })
        ),
        -1,
        true
      )
    );

    scale.value = withDelay(
      particle.delay,
      withRepeat(
        withSequence(
          withTiming(1.2, { duration: particle.duration * 0.5 }),
          withTiming(0.5, { duration: particle.duration * 0.5 })
        ),
        -1,
        true
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          left: particle.x,
          top: particle.y,
          width: particle.size,
          height: particle.size,
          borderRadius: particle.size / 2,
        },
        animatedStyle,
      ]}
    />
  );
}

function PulseWave({ delay, index }: { delay: number; index: number }) {
  const scale = useSharedValue(0.3);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const startAnimation = () => {
      scale.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(0.3, { duration: 0 }),
            withTiming(2.5, { duration: 2500, easing: Easing.out(Easing.cubic) })
          ),
          -1,
          false
        )
      );

      opacity.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(0.6, { duration: 200 }),
            withTiming(0, { duration: 2300, easing: Easing.out(Easing.cubic) })
          ),
          -1,
          false
        )
      );
    };

    startAnimation();
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.pulseWave, animatedStyle]} />;
}

export function AnimatedSplash({ children }: AnimatedSplashProps) {
  const [isReady, setIsReady] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [showButton, setShowButton] = useState(false);

  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(30);
  const subtitleOpacity = useSharedValue(0);
  const subtitleTranslateY = useSharedValue(20);
  const lineWidth = useSharedValue(0);
  const containerOpacity = useSharedValue(1);
  const buttonOpacity = useSharedValue(0);
  const buttonScale = useSharedValue(0.8);

  const particles = useMemo(() => {
    const particleList: Particle[] = [];
    for (let i = 0; i < 25; i++) {
      particleList.push({
        id: i,
        x: Math.random() * width,
        y: height * 0.3 + Math.random() * height * 0.5,
        size: 2 + Math.random() * 4,
        delay: Math.random() * 3000,
        duration: 4000 + Math.random() * 3000,
      });
    }
    return particleList;
  }, []);

  useEffect(() => {
    const prepare = async () => {
      try {
        await SplashScreen.preventAutoHideAsync();
      } catch (e) {
        // Ignore - splash screen may not be available
      }

      // Immediately show animated splash and start animations
      setIsReady(true);
      try {
        await SplashScreen.hideAsync();
      } catch (e) {
        // Ignore - splash screen may not be available
      }
      startAnimations();
    };

    prepare();
  }, []);

  const startAnimations = () => {
    // Fast, immediate animations for quick app start
    titleOpacity.value = withDelay(100, withTiming(1, { duration: 600 }));
    titleTranslateY.value = withDelay(
      100,
      withSpring(0, { damping: 15, stiffness: 100 })
    );

    subtitleOpacity.value = withDelay(400, withTiming(1, { duration: 500 }));
    subtitleTranslateY.value = withDelay(
      400,
      withSpring(0, { damping: 15, stiffness: 100 })
    );

    lineWidth.value = withDelay(
      250,
      withTiming(140, {
        duration: 700,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      })
    );

    buttonOpacity.value = withDelay(700, withTiming(1, { duration: 400 }));
    buttonScale.value = withDelay(
      700,
      withSpring(1, { damping: 12, stiffness: 120 })
    );

    setTimeout(() => setShowButton(true), 700);
  };

  const handleContinue = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    containerOpacity.value = withTiming(0, { duration: 400 });

    setTimeout(() => setShowContent(true), 400);
  };

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const subtitleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
    transform: [{ translateY: subtitleTranslateY.value }],
  }));

  const lineAnimatedStyle = useAnimatedStyle(() => ({
    width: lineWidth.value,
    opacity: interpolate(lineWidth.value, [0, 70, 140], [0, 1, 1]),
  }));

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ scale: buttonScale.value }],
  }));

  if (showContent) {
    return <>{children}</>;
  }

  if (!isReady) {
    return null;
  }

  return (
    <Animated.View style={[styles.container, containerAnimatedStyle]}>
      <LinearGradient
        colors={["#040810", "#0a1628", "#0d1f35", "#0a1628", "#040810"]}
        style={styles.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View style={styles.pulseContainer}>
        <PulseWave delay={0} index={0} />
        <PulseWave delay={800} index={1} />
        <PulseWave delay={1600} index={2} />
      </View>

      {particles.map((particle) => (
        <FloatingParticle key={particle.id} particle={particle} />
      ))}

      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Animated.Text style={[styles.title, titleAnimatedStyle]} adjustsFontSizeToFit numberOfLines={2} minimumFontScale={0.7}>
            SOCCORSO{"\n"}DIGITALE
          </Animated.Text>

          <Animated.View style={[styles.decorativeLine, lineAnimatedStyle]}>
            <LinearGradient
              colors={[
                "transparent",
                "rgba(0,150,255,0.8)",
                "rgba(255,255,255,0.9)",
                "rgba(0,150,255,0.8)",
                "transparent",
              ]}
              style={styles.lineGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </Animated.View>

        </View>

        <Animated.View
          style={[styles.taglineContainer, subtitleAnimatedStyle]}
        >
          <Animated.Text style={[styles.tagline, subtitleAnimatedStyle]} adjustsFontSizeToFit numberOfLines={1} minimumFontScale={0.7}>
            GESTIONE TRASPORTI SANITARI
          </Animated.Text>
        </Animated.View>

        {showButton ? (
          <Animated.View style={[styles.buttonContainer, buttonAnimatedStyle]}>
            <Pressable
              onPress={handleContinue}
              style={({ pressed }) => [
                styles.continueButton,
                pressed && styles.continueButtonPressed,
              ]}
            >
              <LinearGradient
                colors={["#0055AA", "#0077DD", "#0099FF"]}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Animated.Text style={styles.buttonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                  CONTINUA
                </Animated.Text>
                <Feather
                  name="arrow-right"
                  size={18}
                  color="#FFFFFF"
                  style={styles.buttonIcon}
                />
              </LinearGradient>
            </Pressable>
          </Animated.View>
        ) : null}
      </View>

      <View style={styles.footer}>
        <Animated.Text style={[styles.footerText, subtitleAnimatedStyle]}>
          v2.0.0 BETA
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#040810",
  },
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  pulseContainer: {
    position: "absolute",
    top: height * 0.35,
    alignSelf: "center",
    width: 300,
    height: 300,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseWave: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: "rgba(0,150,255,0.4)",
    backgroundColor: "transparent",
  },
  particle: {
    position: "absolute",
    backgroundColor: "rgba(100,180,255,0.8)",
    shadowColor: "#00AAFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  textContainer: {
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 2,
    textAlign: "center",
    lineHeight: 38,
  },
  decorativeLine: {
    height: 3,
    marginVertical: 25,
    overflow: "hidden",
    borderRadius: 2,
  },
  lineGradient: {
    flex: 1,
    height: 3,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "rgba(255,255,255,0.9)",
    letterSpacing: 6,
  },
  taglineContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 50,
    paddingHorizontal: 20,
  },
  taglineLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(0,200,150,0.5)",
    maxWidth: 40,
  },
  tagline: {
    fontSize: 13,
    fontWeight: "700",
    color: "#00D4AA",
    letterSpacing: 2,
    textAlign: "center",
    textShadowColor: "rgba(0,212,170,0.5)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  buttonContainer: {
    marginTop: 60,
  },
  continueButton: {
    borderRadius: 30,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#0088FF",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
      },
    }),
  },
  continueButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  buttonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 30,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 2,
    flexShrink: 1,
  },
  buttonIcon: {
    marginLeft: 12,
  },
  footer: {
    position: "absolute",
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  footerText: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(100,180,255,0.5)",
    letterSpacing: 2,
  },
});
