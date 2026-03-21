import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
  Linking,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSpring,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const DOCUMENT_ASPECT_RATIO = 1.414;
const SCAN_AREA_WIDTH = SCREEN_WIDTH * 0.85;
const SCAN_AREA_HEIGHT = SCAN_AREA_WIDTH / DOCUMENT_ASPECT_RATIO;

type DocumentScannerRouteProp = RouteProp<{
  DocumentScanner: {
    onCapture?: (uri: string) => void;
    documentType?: "foglio_servizio" | "documento_paziente" | "altro";
  };
}>;

function ScanOverlay() {
  const { theme } = useTheme();
  const scanLinePosition = useSharedValue(0);

  useEffect(() => {
    scanLinePosition.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.linear }),
      -1,
      true
    );
  }, []);

  const scanLineStyle = useAnimatedStyle(() => ({
    top: scanLinePosition.value * (SCAN_AREA_HEIGHT - 4),
    opacity: 0.8,
  }));

  const cornerSize = 30;
  const cornerThickness = 4;
  const cornerColor = theme.primary;

  const CornerBracket = ({ position }: { position: "tl" | "tr" | "bl" | "br" }) => {
    const isTop = position === "tl" || position === "tr";
    const isLeft = position === "tl" || position === "bl";

    return (
      <View
        style={[
          styles.corner,
          {
            top: isTop ? 0 : undefined,
            bottom: !isTop ? 0 : undefined,
            left: isLeft ? 0 : undefined,
            right: !isLeft ? 0 : undefined,
          },
        ]}
      >
        <View
          style={[
            styles.cornerLine,
            {
              width: cornerSize,
              height: cornerThickness,
              backgroundColor: cornerColor,
              position: "absolute",
              top: isTop ? 0 : undefined,
              bottom: !isTop ? 0 : undefined,
              left: isLeft ? 0 : undefined,
              right: !isLeft ? 0 : undefined,
            },
          ]}
        />
        <View
          style={[
            styles.cornerLine,
            {
              width: cornerThickness,
              height: cornerSize,
              backgroundColor: cornerColor,
              position: "absolute",
              top: isTop ? 0 : undefined,
              bottom: !isTop ? 0 : undefined,
              left: isLeft ? 0 : undefined,
              right: !isLeft ? 0 : undefined,
            },
          ]}
        />
      </View>
    );
  };

  return (
    <View style={styles.overlayContainer}>
      <View style={styles.overlayTop} />
      <View style={styles.overlayMiddle}>
        <View style={styles.overlaySide} />
        <View style={styles.scanArea}>
          <CornerBracket position="tl" />
          <CornerBracket position="tr" />
          <CornerBracket position="bl" />
          <CornerBracket position="br" />
          <Animated.View style={[styles.scanLine, scanLineStyle]}>
            <LinearGradient
              colors={["transparent", cornerColor, "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.scanLineGradient}
            />
          </Animated.View>
          <View style={styles.alignmentHint}>
            <Feather name="maximize" size={16} color="rgba(255,255,255,0.7)" />
            <ThemedText type="small" style={styles.alignmentHintText}>
              Allinea il documento ai bordi
            </ThemedText>
          </View>
        </View>
        <View style={styles.overlaySide} />
      </View>
      <View style={styles.overlayBottom} />
    </View>
  );
}

async function enhanceScannedDocument(uri: string): Promise<string> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [
        { resize: { width: 1500 } },
      ],
      { 
        format: ImageManipulator.SaveFormat.JPEG, 
        compress: 0.95 
      }
    );
    return result.uri;
  } catch (error) {
    console.error("Enhancement error:", error);
    return uri;
  }
}

export default function DocumentScannerScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation();
  const route = useRoute<DocumentScannerRouteProp>();
  const { theme, isDark } = useTheme();
  const cameraRef = useRef<CameraView>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [processedUri, setProcessedUri] = useState<string | null>(null);
  const [flashEnabled, setFlashEnabled] = useState(false);

  const documentType = route.params?.documentType || "foglio_servizio";
  const onCapture = route.params?.onCapture;

  const getDocumentTypeLabel = () => {
    switch (documentType) {
      case "foglio_servizio":
        return "Foglio Servizio";
      case "documento_paziente":
        return "Documento Paziente";
      default:
        return "Documento";
    }
  };

  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing) return;

    setIsCapturing(true);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.95,
        skipProcessing: false,
      });

      if (photo?.uri) {
        setCapturedUri(photo.uri);
        setIsProcessing(true);

        const finalUri = await enhanceScannedDocument(photo.uri);
        setProcessedUri(finalUri);

        setIsProcessing(false);
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch (error) {
      console.error("Camera capture error:", error);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      setIsProcessing(false);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleRetake = () => {
    setCapturedUri(null);
    setProcessedUri(null);
  };

  const handleConfirm = () => {
    const finalUri = processedUri || capturedUri;
    if (finalUri && onCapture) {
      onCapture(finalUri);
    }
    navigation.goBack();
  };

  const toggleFlash = () => {
    setFlashEnabled(!flashEnabled);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };


  if (!permission) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </ThemedView>
    );
  }

  if (!permission.granted) {
    if (permission.status === "denied" && !permission.canAskAgain) {
      return (
        <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
          <View style={styles.permissionContainer}>
            <View style={[styles.permissionIcon, { backgroundColor: theme.primaryLight }]}>
              <Feather name="camera-off" size={48} color={theme.primary} />
            </View>
            <ThemedText type="h2" style={styles.permissionTitle}>
              Accesso Fotocamera Richiesto
            </ThemedText>
            <ThemedText type="body" style={styles.permissionText}>
              Per scansionare documenti, è necessario concedere l'accesso alla fotocamera nelle impostazioni del dispositivo.
            </ThemedText>
            {Platform.OS !== "web" ? (
              <Button
                onPress={async () => {
                  try {
                    await Linking.openSettings();
                  } catch (error) {
                    console.log("Settings not available");
                  }
                }}
                style={styles.permissionButton}
              >
                Apri Impostazioni
              </Button>
            ) : null}
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
      <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.permissionContainer}>
          <View style={[styles.permissionIcon, { backgroundColor: theme.primaryLight }]}>
            <Feather name="camera" size={48} color={theme.primary} />
          </View>
          <ThemedText type="h2" style={styles.permissionTitle}>
            Scanner Documenti
          </ThemedText>
          <ThemedText type="body" style={styles.permissionText}>
            Per acquisire documenti è necessario l'accesso alla fotocamera del dispositivo.
          </ThemedText>
          <Button
            onPress={requestPermission}
            style={styles.permissionButton}
          >
            Abilita Fotocamera
          </Button>
          <Button
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            Annulla
          </Button>
        </View>
      </ThemedView>
    );
  }

  const pickDocumentFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.95,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        setCapturedUri(uri);
        setIsProcessing(true);
        
        const finalUri = await enhanceScannedDocument(uri);
        setProcessedUri(finalUri);
        
        setIsProcessing(false);
      }
    } catch (error) {
      console.error("Image picker error:", error);
      setIsProcessing(false);
    }
  };

  if (Platform.OS === "web") {
    if (capturedUri) {
      return (
        <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
          {isProcessing ? (
            <View style={styles.processingOverlay}>
              <ActivityIndicator size="large" color={theme.primary} />
              <ThemedText type="body" style={styles.processingText}>
                Elaborazione documento...
              </ThemedText>
              <ThemedText type="small" style={styles.processingSubtext}>
                Ottimizzazione qualità immagine
              </ThemedText>
            </View>
          ) : (
            <>
              <Animated.Image
                source={{ uri: processedUri || capturedUri }}
                style={styles.webPreviewImage}
                resizeMode="contain"
              />
              <View style={[styles.webEdgeIndicator, { backgroundColor: theme.successLight }]}>
                <Feather name="check-circle" size={16} color={theme.success} />
                <ThemedText type="small" style={{ color: theme.success, marginLeft: 8 }}>
                  Immagine elaborata
                </ThemedText>
              </View>
              <View style={styles.webPreviewActions}>
                <Button
                  onPress={handleRetake}
                  style={[styles.webActionButton, { backgroundColor: theme.errorLight }]}
                >
                  Seleziona un altro
                </Button>
                <Button
                  onPress={handleConfirm}
                  style={[styles.webActionButton, { backgroundColor: theme.successLight }]}
                >
                  Conferma
                </Button>
              </View>
            </>
          )}
        </ThemedView>
      );
    }

    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.permissionContainer}>
          <View style={[styles.permissionIcon, { backgroundColor: theme.primaryLight }]}>
            <Feather name="upload" size={48} color={theme.primary} />
          </View>
          <ThemedText type="h2" style={styles.permissionTitle}>
            Carica {getDocumentTypeLabel()}
          </ThemedText>
          <ThemedText type="body" style={styles.permissionText}>
            Seleziona un'immagine del documento dalla tua libreria foto.
            L'immagine verrà ottimizzata per una migliore leggibilità.
          </ThemedText>
          <Button
            onPress={pickDocumentFromGallery}
            style={styles.permissionButton}
          >
            Seleziona Immagine
          </Button>
          <ThemedText type="small" style={styles.webHintText}>
            Per la scansione con fotocamera, apri l'app su Expo Go
          </ThemedText>
          <Button
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            Annulla
          </Button>
        </View>
      </ThemedView>
    );
  }

  if (capturedUri) {
    if (isProcessing) {
      return (
        <View style={[styles.container, { backgroundColor: "#000" }]}>
          <View style={styles.processingOverlay}>
            <ActivityIndicator size="large" color={theme.primary} />
            <ThemedText type="body" style={[styles.processingText, { color: "#FFF" }]}>
              Elaborazione documento...
            </ThemedText>
            <ThemedText type="small" style={[styles.processingSubtext, { color: "rgba(255,255,255,0.7)" }]}>
              Ottimizzazione qualità immagine
            </ThemedText>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <Animated.Image
          source={{ uri: processedUri || capturedUri }}
          style={styles.previewImage}
          resizeMode="contain"
        />
        <View style={[styles.previewOverlay, { paddingTop: insets.top + Spacing.lg }]}>
          <View style={styles.previewHeader}>
            <Pressable
              onPress={handleRetake}
              style={[styles.headerButton, { backgroundColor: "rgba(0,0,0,0.5)" }]}
            >
              <Feather name="x" size={24} color="#FFFFFF" />
            </Pressable>
            <View style={styles.titleContainer}>
              <ThemedText type="h3" style={styles.previewTitle}>
                Anteprima {getDocumentTypeLabel()}
              </ThemedText>
            </View>
            <View style={styles.headerButton} />
          </View>
        </View>
        <View style={[styles.previewActions, { paddingBottom: tabBarHeight + Spacing.lg }]}>
          <Pressable
            onPress={handleRetake}
            style={[styles.actionButton, { backgroundColor: theme.errorLight }]}
          >
            <Feather name="rotate-ccw" size={24} color={theme.error} />
            <ThemedText type="body" style={{ color: theme.error, marginLeft: 8 }}>
              Riprova
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={handleConfirm}
            style={[styles.actionButton, { backgroundColor: theme.successLight }]}
          >
            <Feather name="check" size={24} color={theme.success} />
            <ThemedText type="body" style={{ color: theme.success, marginLeft: 8 }}>
              Conferma
            </ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        flash={flashEnabled ? "on" : "off"}
      >
        <ScanOverlay />
        <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={[styles.headerButton, { backgroundColor: "rgba(0,0,0,0.5)" }]}
          >
            <Feather name="x" size={24} color="#FFFFFF" />
          </Pressable>
          <View style={styles.titleContainer}>
            <ThemedText type="h3" style={styles.headerTitle}>
              {getDocumentTypeLabel()}
            </ThemedText>
            <ThemedText type="small" style={styles.headerSubtitle}>
              Posiziona il documento nell'area
            </ThemedText>
          </View>
          <Pressable
            onPress={toggleFlash}
            style={[
              styles.headerButton,
              { backgroundColor: flashEnabled ? theme.primary : "rgba(0,0,0,0.5)" },
            ]}
          >
            <Feather
              name={flashEnabled ? "zap" : "zap-off"}
              size={24}
              color="#FFFFFF"
            />
          </Pressable>
        </View>
        <View style={[styles.controls, { paddingBottom: tabBarHeight + Spacing.xl }]}>
          <View style={styles.tipContainer}>
            <Feather name="info" size={16} color="#FFFFFF" />
            <ThemedText type="small" style={styles.tipText}>
              Allinea il documento ai bordi e premi per acquisire
            </ThemedText>
          </View>
          <Pressable
            onPress={handleCapture}
            disabled={isCapturing}
            style={[
              styles.captureButton,
              { borderColor: theme.primary },
              isCapturing && { opacity: 0.5 },
            ]}
          >
            <View style={[styles.captureButtonInner, { backgroundColor: theme.primary }]}>
              {isCapturing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Feather name="camera" size={28} color="#FFFFFF" />
              )}
            </View>
          </Pressable>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  camera: {
    flex: 1,
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayTop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  overlayMiddle: {
    flexDirection: "row",
    height: SCAN_AREA_HEIGHT,
  },
  overlaySide: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  scanArea: {
    width: SCAN_AREA_WIDTH,
    height: SCAN_AREA_HEIGHT,
    position: "relative",
  },
  edgeGlow: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderRadius: 4,
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  corner: {
    position: "absolute",
    width: 30,
    height: 30,
  },
  cornerLine: {
    borderRadius: 2,
  },
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 4,
  },
  scanLineGradient: {
    flex: 1,
    height: 4,
  },
  alignmentHint: {
    position: "absolute",
    bottom: -35,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  alignmentHintText: {
    color: "rgba(255,255,255,0.7)",
  },
  detectionIndicator: {
    position: "absolute",
    bottom: -30,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  detectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  detectionText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  titleContainer: {
    alignItems: "center",
  },
  headerTitle: {
    color: "#FFFFFF",
    textAlign: "center",
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
  controls: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
  },
  controlRow: {
    flexDirection: "row",
    marginBottom: Spacing.md,
  },
  autoButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: 6,
  },
  autoButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  tipContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
    maxWidth: SCREEN_WIDTH * 0.9,
  },
  tipText: {
    color: "#FFFFFF",
    marginLeft: Spacing.sm,
    flex: 1,
    textAlign: "center",
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  previewImage: {
    flex: 1,
    width: "100%",
  },
  previewOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  previewTitle: {
    color: "#FFFFFF",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  edgeStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
    gap: 4,
  },
  edgeStatusText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  previewActions: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: Spacing.xl,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
  },
  permissionContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  permissionIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  permissionTitle: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  permissionText: {
    textAlign: "center",
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  permissionButton: {
    marginBottom: Spacing.md,
    minWidth: 200,
  },
  backButton: {
    minWidth: 200,
  },
  webHintText: {
    textAlign: "center",
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
    opacity: 0.7,
  },
  webPreviewImage: {
    flex: 1,
    width: "100%",
    marginVertical: Spacing.xl,
  },
  webEdgeIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  webPreviewActions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  webActionButton: {
    minWidth: 150,
  },
  processingOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  processingText: {
    marginTop: Spacing.lg,
    textAlign: "center",
  },
  processingSubtext: {
    marginTop: Spacing.sm,
    textAlign: "center",
  },
});
