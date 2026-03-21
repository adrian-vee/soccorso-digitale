import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  Platform,
  TextInput,
  Linking,
  Animated,
  Dimensions,
  ScrollView,
  Vibration,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { CameraView, useCameraPermissions, BarcodeScanningResult } from "expo-camera";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import DateTimePicker from "@react-native-community/datetimepicker";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest, getApiUrl, getAuthToken } from "@/lib/query-client";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SCANNER_SIZE = Math.min(SCREEN_WIDTH * 0.75, 300);

type ScanMode = "idle" | "scanning" | "processing" | "result" | "manual";

interface ScannedProduct {
  barcode: string;
  name?: string;
  description?: string;
  category?: string;
  brand?: string;
  manufacturer?: string;
  quantityPerPackage?: number;
  packageSize?: string;
  unit?: string;
  hasExpiry?: boolean;
  expiryDate?: string;
  imageUrl?: string;
  source?: string;
  batchNumber?: string;
  found: boolean;
}

interface InventoryLocation {
  id: string;
  name: string;
}

const INVENTORY_CATEGORIES = [
  { value: "presidi", label: "Presidi Sanitari" },
  { value: "farmaci", label: "Farmaci" },
  { value: "medicazione", label: "Medicazione" },
  { value: "rianimazione", label: "Rianimazione" },
  { value: "immobilizzazione", label: "Immobilizzazione" },
  { value: "protezione", label: "Protezione DPI" },
  { value: "fluidi", label: "Fluidi" },
  { value: "strumentazione", label: "Strumentazione" },
  { value: "altro", label: "Altro" },
];

const UNITS = [
  { value: "pz", label: "Pezzi (pz)" },
  { value: "conf", label: "Confezioni (conf)" },
  { value: "fl", label: "Flaconi (fl)" },
  { value: "ml", label: "Millilitri (ml)" },
  { value: "lt", label: "Litri (lt)" },
  { value: "rotoli", label: "Rotoli" },
  { value: "paia", label: "Paia" },
];

export default function InventoryScannerScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [scanMode, setScanMode] = useState<ScanMode>("idle");
  const [scannedProduct, setScannedProduct] = useState<ScannedProduct | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState(0);
  const [selectedUnitIndex, setSelectedUnitIndex] = useState(0);
  
  // Professional scanner features
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  // Use ref for lastScannedBarcode to avoid stale closure issues in useCallback
  const lastScannedBarcodeRef = useRef<string | null>(null);

  const [formData, setFormData] = useState({
    barcode: "",
    name: "",
    description: "",
    category: "presidi",
    unit: "pz",
    quantity: "1",
    expiryDate: null as Date | null,
    minStockLevel: "5",
    hasExpiry: true,
    locationId: "",
    sku: "",
    notes: "",
    batchNumber: "",
  });
  
  const [manualBarcodeInput, setManualBarcodeInput] = useState("");

  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const successAnim = useRef(new Animated.Value(0)).current;

  const { data: locations = [] } = useQuery<InventoryLocation[]>({
    queryKey: ["/api/locations"],
    queryFn: async () => {
      const url = new URL("/api/locations", getApiUrl());
      const token = await getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(url.toString(), { credentials: "include", headers });
      if (!res.ok) return [];
      return res.json();
    },
  });

  useEffect(() => {
    if (locations.length > 0 && !formData.locationId) {
      setFormData(prev => ({ ...prev, locationId: user?.location?.id || locations[0].id }));
    }
  }, [locations, user]);

  useEffect(() => {
    if (scanMode === "scanning") {
      startScanAnimation();
    }
  }, [scanMode]);

  const startScanAnimation = () => {
    scanLineAnim.setValue(0);
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const triggerSuccessAnimation = () => {
    Animated.sequence([
      Animated.spring(successAnim, {
        toValue: 1,
        tension: 100,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.delay(1000),
      Animated.timing(successAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const createItemMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const url = new URL("/api/inventory/items", getApiUrl());
      const token = await getAuthToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      
      const res = await fetch(url.toString(), {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          category: data.category,
          barcode: data.barcode,
          sku: data.sku || data.barcode,
          unit: data.unit,
          minStockLevel: parseInt(data.minStockLevel) || 5,
          hasExpiry: data.hasExpiry,
          expiryAlertDays: 30,
          notes: data.notes,
        }),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Errore nella creazione articolo");
      }
      return res.json();
    },
    onSuccess: async (item) => {
      if (formData.locationId && parseInt(formData.quantity) > 0) {
        await addWarehouseStock(item.id);
      }
      
      // Save barcode-product mapping for future lookups
      if (formData.barcode && formData.name) {
        try {
          const learnUrl = new URL("/api/inventory/barcode/learn", getApiUrl());
          const token = await getAuthToken();
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (token) headers["Authorization"] = `Bearer ${token}`;
          
          await fetch(learnUrl.toString(), {
            method: "POST",
            credentials: "include",
            headers,
            body: JSON.stringify({
              barcode: formData.barcode,
              productName: formData.name,
              description: formData.description,
              category: formData.category,
              unit: formData.unit,
              hasExpiry: formData.hasExpiry
            }),
          });
        } catch {
          // Don't fail if learning fails
        }
      }
      
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      triggerSuccessAnimation();
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/dashboard"] });
      
      setTimeout(() => {
        Alert.alert(
          "Articolo Aggiunto",
          `"${formData.name}" è stato aggiunto al catalogo inventario con ${formData.quantity} unità.`,
          [
            { text: "Scansiona Altro", onPress: resetForm },
            { text: "Chiudi", onPress: () => navigation.goBack() },
          ]
        );
      }, 500);
    },
    onError: (error: Error) => {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      Alert.alert("Errore", error.message);
    },
  });

  const addWarehouseStock = async (itemId: string) => {
    const url = new URL(`/api/locations/${formData.locationId}/stock`, getApiUrl());
    const token = await getAuthToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    
    await fetch(url.toString(), {
      method: "PUT",
      credentials: "include",
      headers,
      body: JSON.stringify({
        itemId,
        quantity: parseInt(formData.quantity),
        minStockLevel: parseInt(formData.minStockLevel),
        expiryDate: formData.expiryDate?.toISOString().split("T")[0],
      }),
    });
  };

  const handleBarCodeScanned = useCallback(async (result: BarcodeScanningResult) => {
    if (isScanning) return;
    
    const barcode = result.data;
    
    // Prevent duplicate scans of the same barcode in rapid succession
    if (barcode === lastScannedBarcodeRef.current) {
      return;
    }
    
    setIsScanning(true);
    lastScannedBarcodeRef.current = barcode;
    setScanCount(prev => prev + 1);
    
    // Professional haptic feedback pattern: quick double tap
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Short vibration pulse for scanning confirmation
      Vibration.vibrate([0, 50, 30, 50]);
    }

    setScanMode("processing");

    try {
      const url = new URL(`/api/inventory/barcode/${encodeURIComponent(barcode)}`, getApiUrl());
      const token = await getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      
      const res = await fetch(url.toString(), { credentials: "include", headers });
      const data = await res.json();
      
      if (res.ok && data.found) {
        const product = data.product;
        const source = data.source;
        
        // Find category and unit indices for pickers
        const categoryIdx = INVENTORY_CATEGORIES.findIndex(c => c.value === product.category);
        const unitIdx = UNITS.findIndex(u => u.value === product.unit);
        if (categoryIdx >= 0) setSelectedCategoryIndex(categoryIdx);
        if (unitIdx >= 0) setSelectedUnitIndex(unitIdx);
        
        // Parse expiry date if provided
        let expiryDate: Date | null = null;
        if (product.expiryDate) {
          expiryDate = new Date(product.expiryDate);
        }
        
        // Construct description with brand/manufacturer if available
        let description = product.description || "";
        if (product.brand && !description.includes(product.brand)) {
          description = product.brand + (description ? " - " + description : "");
        }
        if (product.packageSize && !description.includes(product.packageSize)) {
          description += (description ? " | " : "") + product.packageSize;
        }
        
        // If internal item exists, prompt to add quantity
        if (source === "internal" && data.inventoryItem) {
          Alert.alert(
            "Articolo Esistente",
            `"${product.name}" e gia nel catalogo.\n\nVuoi aggiungere quantita a magazzino?`,
            [
              { text: "Annulla", onPress: () => { setScanMode("idle"); setIsScanning(false); } },
              { 
                text: "Aggiungi Quantita", 
                onPress: () => {
                  setFormData(prev => ({
                    ...prev,
                    barcode: product.barcode,
                    name: product.name || "",
                    description,
                    category: product.category || "altro",
                    unit: product.unit || "pz",
                    hasExpiry: product.hasExpiry ?? true,
                    expiryDate,
                    quantity: product.quantityPerPackage?.toString() || "1",
                  }));
                  setScannedProduct({ 
                    barcode, 
                    name: product.name, 
                    source,
                    found: true 
                  });
                  setScanMode("result");
                  setIsScanning(false);
                }
              },
            ]
          );
        } else {
          // External lookup found - auto-populate form with product data
          const sourceLabel = source === "openfoodfacts" ? "OpenFoodFacts" 
                           : source === "qr_embedded" ? "QR Code"
                           : source === "gs1_datamatrix" ? "GS1 Medicale"
                           : source === "gs1_datamatrix_cached" ? "GS1 (Catalogo)"
                           : source === "fda_gudid" ? "FDA GUDID"
                           : source === "upcitemdb" ? "Database UPC"
                           : source === "crew_scan" ? "Catalogo Crew"
                           : source;
          
          if (Platform.OS !== "web") {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          
          setFormData(prev => ({
            ...prev,
            barcode: product.barcode,
            name: product.name || "",
            description,
            category: product.category || "altro",
            unit: product.unit || "pz",
            hasExpiry: product.hasExpiry ?? true,
            expiryDate,
            quantity: product.quantityPerPackage?.toString() || "1",
            sku: product.barcode,
            batchNumber: product.batchNumber || "",
          }));
          
          setScannedProduct({ 
            barcode, 
            name: product.name,
            description,
            category: product.category,
            brand: product.brand,
            manufacturer: product.manufacturer,
            quantityPerPackage: product.quantityPerPackage,
            packageSize: product.packageSize,
            unit: product.unit,
            hasExpiry: product.hasExpiry,
            imageUrl: product.imageUrl,
            source: sourceLabel,
            batchNumber: product.batchNumber,
            found: true 
          });
          
          setScanMode("result");
          setIsScanning(false);
        }
      } else if (res.ok && data.needsName) {
        // GS1 code recognized but needs name - show form with pre-filled data
        const product = data.product;
        
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
        
        // Parse expiry date if provided
        let expiryDate: Date | null = null;
        if (product.expiryDate) {
          expiryDate = new Date(product.expiryDate);
        }
        
        setFormData(prev => ({
          ...prev,
          barcode: product.barcode,
          name: "", // User needs to fill this
          description: product.description || "",
          category: product.category || "presidi",
          unit: product.unit || "pz",
          hasExpiry: product.hasExpiry ?? true,
          expiryDate,
          quantity: product.quantityPerPackage?.toString() || "1",
          sku: product.barcode,
          batchNumber: product.batchNumber || "",
        }));
        
        setScannedProduct({ 
          barcode: product.barcode, 
          name: "",
          description: product.description,
          batchNumber: product.batchNumber,
          hasExpiry: product.hasExpiry,
          expiryDate: product.expiryDate,
          source: "GS1 Medicale (Nuovo)",
          found: true 
        });
        
        Alert.alert(
          "Prodotto GS1 Riconosciuto",
          data.message || "Inserire il nome del prodotto per salvarlo nel catalogo.",
          [{ text: "OK" }]
        );
        
        setScanMode("result");
        setIsScanning(false);
      } else {
        // Product not found - allow manual entry with barcode pre-filled
        setScannedProduct({ barcode, found: false });
        setFormData(prev => ({ ...prev, barcode, sku: barcode }));
        setScanMode("result");
        setIsScanning(false);
      }
    } catch (error) {
      console.error("Barcode lookup error:", error);
      setScannedProduct({ barcode, found: false });
      setFormData(prev => ({ ...prev, barcode, sku: barcode }));
      setScanMode("result");
      setIsScanning(false);
    }
  }, [isScanning]);

  const resetForm = () => {
    setFormData({
      barcode: "",
      name: "",
      description: "",
      category: "presidi",
      unit: "pz",
      quantity: "1",
      expiryDate: null,
      minStockLevel: "5",
      hasExpiry: true,
      locationId: user?.location?.id || locations[0]?.id || "",
      sku: "",
      notes: "",
      batchNumber: "",
    });
    setScannedProduct(null);
    setScanMode("idle");
    setIsScanning(false);
    setSelectedCategoryIndex(0);
    setSelectedUnitIndex(0);
    setManualBarcodeInput("");
    lastScannedBarcodeRef.current = null; // Reset to allow re-scanning same barcode if needed
  };
  
  const handleManualBarcodeSubmit = () => {
    if (!manualBarcodeInput.trim()) {
      Alert.alert("Errore", "Inserisci un codice a barre");
      return;
    }
    handleBarCodeScanned({ data: manualBarcodeInput.trim() } as BarcodeScanningResult);
    setManualBarcodeInput("");
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      Alert.alert("Errore", "Inserisci un nome per l'articolo");
      return;
    }
    if (!formData.barcode.trim()) {
      Alert.alert("Errore", "Codice a barre richiesto");
      return;
    }
    createItemMutation.mutate(formData);
  };

  if (!cameraPermission) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!cameraPermission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: insets.top }]}>
        <View style={styles.permissionContainer}>
          <View style={[styles.permissionIcon, { backgroundColor: theme.primaryLight }]}>
            <Feather name="camera-off" size={48} color={theme.primary} />
          </View>
          <ThemedText type="h2" style={styles.permissionTitle}>
            Accesso Fotocamera Richiesto
          </ThemedText>
          <ThemedText type="body" style={[styles.permissionText, { color: theme.textSecondary }]}>
            Per scansionare codici a barre e QR code degli articoli, è necessario l'accesso alla fotocamera.
          </ThemedText>
          
          {cameraPermission.status === "denied" && !cameraPermission.canAskAgain ? (
            Platform.OS !== "web" ? (
              <Pressable
                style={[styles.permissionButton, { backgroundColor: theme.primary }]}
                onPress={async () => {
                  try {
                    await Linking.openSettings();
                  } catch (error) {}
                }}
              >
                <Feather name="settings" size={20} color="#fff" />
                <ThemedText type="body" style={{ color: "#fff", marginLeft: 8, fontWeight: "600" }}>
                  Apri Impostazioni
                </ThemedText>
              </Pressable>
            ) : null
          ) : (
            <Pressable
              style={[styles.permissionButton, { backgroundColor: theme.primary }]}
              onPress={requestCameraPermission}
            >
              <Feather name="camera" size={20} color="#fff" />
              <ThemedText type="body" style={{ color: "#fff", marginLeft: 8, fontWeight: "600" }}>
                Abilita Fotocamera
              </ThemedText>
            </Pressable>
          )}
          
          <Pressable
            style={[styles.manualButton, { borderColor: theme.border }]}
            onPress={() => setScanMode("manual")}
          >
            <Feather name="edit-3" size={18} color={theme.primary} />
            <ThemedText type="body" style={{ color: theme.primary, marginLeft: 8 }}>
              Inserimento Manuale
            </ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  const scanLineTranslate = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCANNER_SIZE - 4],
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {scanMode === "idle" || scanMode === "scanning" || scanMode === "processing" ? (
        <View style={StyleSheet.absoluteFill}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torchEnabled}
            autofocus="on"
            barcodeScannerSettings={{
              barcodeTypes: ["qr", "ean13", "ean8", "code128", "code39", "upc_a", "upc_e", "codabar", "itf14", "datamatrix", "pdf417", "aztec"],
            }}
            onBarcodeScanned={scanMode === "scanning" ? handleBarCodeScanned : undefined}
          />
          
          <LinearGradient
            colors={["rgba(0,0,0,0.7)", "transparent", "transparent", "rgba(0,0,0,0.7)"]}
            style={StyleSheet.absoluteFill}
          />

          <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
            <Pressable
              style={styles.closeButton}
              onPress={() => navigation.goBack()}
            >
              <BlurView intensity={80} tint="dark" style={styles.blurButton}>
                <Feather name="x" size={24} color="#fff" />
              </BlurView>
            </Pressable>
            
            <View style={styles.headerCenter}>
              <BlurView intensity={80} tint="dark" style={styles.headerBadge}>
                <Feather name="package" size={16} color="#fff" />
                <ThemedText type="body" style={[styles.headerText, { fontWeight: "600" }]}>
                  Scanner Inventario
                </ThemedText>
                {scanCount > 0 && (
                  <View style={styles.scanCountBadge}>
                    <ThemedText type="caption" style={styles.scanCountText}>
                      {scanCount}
                    </ThemedText>
                  </View>
                )}
              </BlurView>
            </View>

            <Pressable
              style={styles.torchButton}
              onPress={() => {
                if (Platform.OS !== "web") {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                setTorchEnabled(!torchEnabled);
              }}
            >
              <BlurView intensity={80} tint="dark" style={styles.blurButton}>
                <Feather 
                  name={torchEnabled ? "zap" : "zap-off"} 
                  size={22} 
                  color={torchEnabled ? "#FFD700" : "#fff"} 
                />
              </BlurView>
            </Pressable>
          </View>

          <View style={styles.scannerArea}>
            <View style={[styles.scannerFrame, { width: SCANNER_SIZE, height: SCANNER_SIZE }]}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
              
              {scanMode === "scanning" && (
                <Animated.View
                  style={[
                    styles.scanLine,
                    { transform: [{ translateY: scanLineTranslate }] },
                  ]}
                >
                  <LinearGradient
                    colors={["transparent", "#00A651", "transparent"]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={styles.scanLineGradient}
                  />
                </Animated.View>
              )}
              
              {scanMode === "processing" && (
                <View style={styles.processingOverlay}>
                  <ActivityIndicator size="large" color="#00A651" />
                  <ThemedText type="body" style={styles.processingText}>
                    Elaborazione...
                  </ThemedText>
                </View>
              )}
            </View>

            <ThemedText type="body" style={styles.scannerHint}>
              {scanMode === "idle" 
                ? "Premi START per iniziare la scansione"
                : scanMode === "scanning"
                ? "Inquadra il codice a barre o QR code"
                : "Elaborazione in corso..."}
            </ThemedText>
            
            <View style={styles.manualInputContainer}>
              <BlurView intensity={80} tint="dark" style={styles.manualInputBlur}>
                <TextInput
                  style={styles.manualBarcodeInput}
                  value={manualBarcodeInput}
                  onChangeText={setManualBarcodeInput}
                  placeholder="Inserisci codice manualmente..."
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  returnKeyType="search"
                  onSubmitEditing={handleManualBarcodeSubmit}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable
                  style={[
                    styles.manualSubmitButton,
                    !manualBarcodeInput.trim() && styles.manualSubmitDisabled
                  ]}
                  onPress={handleManualBarcodeSubmit}
                  disabled={!manualBarcodeInput.trim()}
                >
                  <Feather 
                    name="arrow-right" 
                    size={20} 
                    color={manualBarcodeInput.trim() ? "#fff" : "rgba(255,255,255,0.4)"} 
                  />
                </Pressable>
              </BlurView>
            </View>
          </View>

          <View style={[styles.bottomControls, { paddingBottom: tabBarHeight + Spacing.lg }]}>
            {scanMode === "idle" ? (
              <Pressable
                style={styles.startButton}
                onPress={() => {
                  if (Platform.OS !== "web") {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  }
                  setScanMode("scanning");
                }}
              >
                <LinearGradient
                  colors={["#00A651", "#00823F"]}
                  style={styles.startButtonGradient}
                >
                  <Feather name="zap" size={24} color="#fff" />
                  <ThemedText type="h3" style={styles.startButtonText}>
                    AVVIA SCANSIONE
                  </ThemedText>
                </LinearGradient>
              </Pressable>
            ) : (
              <Pressable
                style={styles.stopButton}
                onPress={() => {
                  if (Platform.OS !== "web") {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  setScanMode("idle");
                }}
              >
                <BlurView intensity={90} tint="dark" style={styles.stopButtonBlur}>
                  <Feather name="pause" size={20} color="#fff" />
                  <ThemedText type="body" style={[styles.stopButtonText, { fontWeight: "600" }]}>
                    PAUSA
                  </ThemedText>
                </BlurView>
              </Pressable>
            )}

            <Pressable
              style={styles.manualEntryButton}
              onPress={() => {
                if (Platform.OS !== "web") {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                setScanMode("manual");
              }}
            >
              <BlurView intensity={80} tint="dark" style={styles.manualEntryBlur}>
                <Feather name="edit-3" size={18} color="#fff" />
                <ThemedText type="body" style={styles.manualEntryText}>
                  Inserimento Manuale
                </ThemedText>
              </BlurView>
            </Pressable>
          </View>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.formContainer,
            { paddingTop: insets.top + Spacing.lg, paddingBottom: tabBarHeight + Spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formHeader}>
            <Pressable
              style={[styles.formCloseButton, { backgroundColor: theme.cardBackground }]}
              onPress={resetForm}
            >
              <Feather name="arrow-left" size={20} color={theme.text} />
            </Pressable>
            
            <ThemedText type="h2" style={styles.formTitle}>
              {scannedProduct?.found ? "Aggiungi Quantità" : "Nuovo Articolo"}
            </ThemedText>
          </View>

          {scannedProduct && (
            <Card style={styles.barcodeCard}>
              <LinearGradient
                colors={scannedProduct.found ? ["#00A651", "#00823F"] : ["#0066CC", "#004499"]}
                style={styles.barcodeGradient}
              >
                <View style={styles.barcodeIconContainer}>
                  <Feather 
                    name={scannedProduct.found ? "check-circle" : "package"} 
                    size={28} 
                    color="#fff" 
                  />
                </View>
                <View style={styles.barcodeInfo}>
                  <ThemedText type="label" style={styles.barcodeLabel}>
                    {scannedProduct.found ? "ARTICOLO TROVATO" : "NUOVO CODICE"}
                  </ThemedText>
                  <ThemedText type="h3" style={styles.barcodeValue}>
                    {scannedProduct.barcode}
                  </ThemedText>
                  {scannedProduct.source && scannedProduct.found && (
                    <View style={styles.sourceTag}>
                      <Feather name="database" size={12} color="rgba(255,255,255,0.9)" />
                      <ThemedText type="label" style={styles.sourceTagText}>
                        {scannedProduct.source}
                      </ThemedText>
                    </View>
                  )}
                </View>
                <Pressable
                  style={styles.rescanButton}
                  onPress={() => {
                    if (Platform.OS !== "web") {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                    resetForm();
                  }}
                >
                  <Feather name="refresh-cw" size={18} color="#fff" />
                </Pressable>
              </LinearGradient>
              {scannedProduct.found && (
                <View style={styles.autoFilledBanner}>
                  <Feather name="zap" size={16} color="#00A651" />
                  <ThemedText type="body" style={styles.autoFilledText}>
                    {scannedProduct.source === "GS1 Medicale" 
                      ? "Dati lotto/scadenza estratti - inserisci nome prodotto"
                      : "Dati compilati automaticamente dal codice a barre"}
                  </ThemedText>
                </View>
              )}
            </Card>
          )}

          <View style={styles.formSection}>
            <ThemedText type="label" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              INFORMAZIONI ARTICOLO
            </ThemedText>

            <View style={styles.inputGroup}>
              <ThemedText type="label" style={[styles.inputLabel, { color: theme.textSecondary }]}>
                Nome Articolo *
              </ThemedText>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.cardBackground, color: theme.text, borderColor: theme.border }]}
                value={formData.name}
                onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                placeholder="Es. Garza sterile 10x10"
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText type="label" style={[styles.inputLabel, { color: theme.textSecondary }]}>
                Descrizione
              </ThemedText>
              <TextInput
                style={[styles.textInput, styles.textAreaInput, { backgroundColor: theme.cardBackground, color: theme.text, borderColor: theme.border }]}
                value={formData.description}
                onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                placeholder="Descrizione dettagliata dell'articolo..."
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={3}
              />
            </View>

            {formData.batchNumber ? (
              <View style={styles.inputGroup}>
                <ThemedText type="label" style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  Numero Lotto
                </ThemedText>
                <View style={[styles.readOnlyInput, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                  <Feather name="hash" size={16} color={theme.primary} />
                  <ThemedText type="body" style={[styles.readOnlyText, { color: theme.text }]}>
                    {formData.batchNumber}
                  </ThemedText>
                </View>
              </View>
            ) : null}

            {scanMode === "manual" && (
              <View style={styles.inputGroup}>
                <ThemedText type="label" style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  Codice a Barre / QR *
                </ThemedText>
                <TextInput
                  style={[styles.textInput, { backgroundColor: theme.cardBackground, color: theme.text, borderColor: theme.border }]}
                  value={formData.barcode}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, barcode: text }))}
                  placeholder="Inserisci o scansiona codice"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
            )}

            <View style={styles.rowInputs}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: Spacing.sm }]}>
                <ThemedText type="label" style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  Categoria
                </ThemedText>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.chipScroll}
                >
                  {INVENTORY_CATEGORIES.map((cat, index) => (
                    <Pressable
                      key={cat.value}
                      style={[
                        styles.chip,
                        { borderColor: theme.border },
                        formData.category === cat.value && { backgroundColor: theme.primary, borderColor: theme.primary },
                      ]}
                      onPress={() => setFormData(prev => ({ ...prev, category: cat.value }))}
                    >
                      <ThemedText
                        type="small"
                        style={[
                          styles.chipText,
                          { color: formData.category === cat.value ? "#fff" : theme.text },
                        ]}
                      >
                        {cat.label}
                      </ThemedText>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>

            <View style={styles.rowInputs}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: Spacing.sm }]}>
                <ThemedText type="label" style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  Unità di Misura
                </ThemedText>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.chipScroll}
                >
                  {UNITS.map((unit) => (
                    <Pressable
                      key={unit.value}
                      style={[
                        styles.chip,
                        { borderColor: theme.border },
                        formData.unit === unit.value && { backgroundColor: theme.primary, borderColor: theme.primary },
                      ]}
                      onPress={() => setFormData(prev => ({ ...prev, unit: unit.value }))}
                    >
                      <ThemedText
                        type="small"
                        style={[
                          styles.chipText,
                          { color: formData.unit === unit.value ? "#fff" : theme.text },
                        ]}
                      >
                        {unit.label}
                      </ThemedText>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>
          </View>

          <View style={styles.formSection}>
            <ThemedText type="label" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              QUANTITA E MAGAZZINO
            </ThemedText>

            <View style={styles.rowInputs}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: Spacing.sm }]}>
                <ThemedText type="label" style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  Quantità da Aggiungere
                </ThemedText>
                <View style={styles.quantityContainer}>
                  <Pressable
                    style={[styles.quantityButton, { backgroundColor: theme.cardBackground }]}
                    onPress={() => {
                      const qty = Math.max(1, parseInt(formData.quantity) - 1);
                      setFormData(prev => ({ ...prev, quantity: qty.toString() }));
                    }}
                  >
                    <Feather name="minus" size={20} color={theme.text} />
                  </Pressable>
                  <TextInput
                    style={[styles.quantityInput, { backgroundColor: theme.cardBackground, color: theme.text, borderColor: theme.border }]}
                    value={formData.quantity}
                    onChangeText={(text) => {
                      const num = text.replace(/[^0-9]/g, "");
                      setFormData(prev => ({ ...prev, quantity: num || "1" }));
                    }}
                    keyboardType="number-pad"
                    textAlign="center"
                  />
                  <Pressable
                    style={[styles.quantityButton, { backgroundColor: theme.cardBackground }]}
                    onPress={() => {
                      const qty = parseInt(formData.quantity) + 1;
                      setFormData(prev => ({ ...prev, quantity: qty.toString() }));
                    }}
                  >
                    <Feather name="plus" size={20} color={theme.text} />
                  </Pressable>
                </View>
              </View>

              <View style={[styles.inputGroup, { flex: 1, marginLeft: Spacing.sm }]}>
                <ThemedText type="label" style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  Scorta Minima
                </ThemedText>
                <TextInput
                  style={[styles.textInput, { backgroundColor: theme.cardBackground, color: theme.text, borderColor: theme.border }]}
                  value={formData.minStockLevel}
                  onChangeText={(text) => {
                    const num = text.replace(/[^0-9]/g, "");
                    setFormData(prev => ({ ...prev, minStockLevel: num || "5" }));
                  }}
                  keyboardType="number-pad"
                  placeholder="5"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <ThemedText type="label" style={[styles.inputLabel, { color: theme.textSecondary }]}>
                Sede Magazzino
              </ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipScroll}
              >
                {locations.map((loc) => (
                  <Pressable
                    key={loc.id}
                    style={[
                      styles.chip,
                      styles.locationChip,
                      { borderColor: theme.border },
                      formData.locationId === loc.id && { backgroundColor: theme.primary, borderColor: theme.primary },
                    ]}
                    onPress={() => setFormData(prev => ({ ...prev, locationId: loc.id }))}
                  >
                    <Feather 
                      name="map-pin" 
                      size={14} 
                      color={formData.locationId === loc.id ? "#fff" : theme.textSecondary} 
                    />
                    <ThemedText
                      type="small"
                      style={[
                        styles.chipText,
                        { marginLeft: 4, color: formData.locationId === loc.id ? "#fff" : theme.text },
                      ]}
                    >
                      {loc.name}
                    </ThemedText>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>

          <View style={styles.formSection}>
            <ThemedText type="label" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              SCADENZA
            </ThemedText>

            <Pressable
              style={[styles.expiryToggle, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
              onPress={() => setFormData(prev => ({ ...prev, hasExpiry: !prev.hasExpiry }))}
            >
              <View style={styles.expiryToggleContent}>
                <Feather name="calendar" size={20} color={formData.hasExpiry ? theme.primary : theme.textSecondary} />
                <ThemedText type="body" style={{ marginLeft: Spacing.sm, color: theme.text }}>
                  Articolo con scadenza
                </ThemedText>
              </View>
              <View style={[
                styles.toggleSwitch,
                { backgroundColor: formData.hasExpiry ? theme.primary : theme.border }
              ]}>
                <View style={[
                  styles.toggleKnob,
                  { transform: [{ translateX: formData.hasExpiry ? 20 : 0 }] }
                ]} />
              </View>
            </Pressable>

            {formData.hasExpiry && (
              <Pressable
                style={[styles.dateButton, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
                onPress={() => setShowDatePicker(true)}
              >
                <Feather name="calendar" size={18} color={theme.primary} />
                <ThemedText type="body" style={{ marginLeft: Spacing.sm, color: theme.text }}>
                  {formData.expiryDate 
                    ? formData.expiryDate.toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })
                    : "Seleziona data scadenza"}
                </ThemedText>
              </Pressable>
            )}

            {showDatePicker && (
              <DateTimePicker
                value={formData.expiryDate || new Date()}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                minimumDate={new Date()}
                onChange={(event, date) => {
                  setShowDatePicker(Platform.OS === "ios");
                  if (date) {
                    setFormData(prev => ({ ...prev, expiryDate: date }));
                  }
                }}
              />
            )}
          </View>

          <View style={[styles.submitContainer, { marginTop: Spacing.xl }]}>
            <Pressable
              style={[
                styles.submitButton,
                { opacity: createItemMutation.isPending ? 0.7 : 1 },
              ]}
              onPress={handleSubmit}
              disabled={createItemMutation.isPending}
            >
              <LinearGradient
                colors={["#00A651", "#00823F"]}
                style={styles.submitGradient}
              >
                {createItemMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Feather name="check-circle" size={22} color="#fff" />
                    <ThemedText type="h3" style={styles.submitText}>
                      Salva Articolo
                    </ThemedText>
                  </>
                )}
              </LinearGradient>
            </Pressable>

            <Pressable
              style={[styles.cancelButton, { borderColor: theme.border }]}
              onPress={resetForm}
            >
              <ThemedText type="body" style={{ color: theme.text }}>
                Annulla
              </ThemedText>
            </Pressable>
          </View>
        </ScrollView>
      )}

      <Animated.View
        style={[
          styles.successOverlay,
          {
            opacity: successAnim,
            transform: [{ scale: successAnim }],
          },
        ]}
        pointerEvents="none"
      >
        <View style={styles.successIcon}>
          <Feather name="check" size={48} color="#fff" />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  permissionIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  manualButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    zIndex: 10,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
  },
  torchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
  },
  blurButton: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 22,
  },
  scanCountBadge: {
    backgroundColor: "#00A651",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: Spacing.xs,
    paddingHorizontal: 6,
  },
  scanCountText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  headerText: {
    color: "#fff",
    marginLeft: Spacing.xs,
  },
  scannerArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scannerFrame: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderColor: "#00A651",
    borderWidth: 3,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: BorderRadius.md,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: BorderRadius.md,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: BorderRadius.md,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: BorderRadius.md,
  },
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 3,
  },
  scanLineGradient: {
    flex: 1,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  processingText: {
    color: "#fff",
    marginTop: Spacing.md,
  },
  scannerHint: {
    color: "#fff",
    marginTop: Spacing.xl,
    textAlign: "center",
    opacity: 0.8,
  },
  manualInputContainer: {
    marginTop: Spacing.lg,
    width: "100%",
    paddingHorizontal: Spacing.lg,
  },
  manualInputBlur: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  manualBarcodeInput: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    paddingVertical: 8,
  },
  manualSubmitButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#00A651",
    justifyContent: "center",
    alignItems: "center",
  },
  manualSubmitDisabled: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  bottomControls: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
  },
  startButton: {
    width: "100%",
    maxWidth: 300,
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
    marginBottom: Spacing.md,
  },
  startButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
  },
  startButtonText: {
    color: "#fff",
    marginLeft: Spacing.sm,
  },
  stopButton: {
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
    marginBottom: Spacing.md,
  },
  stopButtonBlur: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.xl,
  },
  stopButtonText: {
    color: "#fff",
    marginLeft: Spacing.xs,
  },
  manualEntryButton: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  manualEntryBlur: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  manualEntryText: {
    color: "#fff",
    marginLeft: Spacing.xs,
  },
  formContainer: {
    paddingHorizontal: Spacing.lg,
  },
  formHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  formCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  formTitle: {
    flex: 1,
  },
  barcodeCard: {
    marginBottom: Spacing.xl,
    overflow: "hidden",
  },
  barcodeGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
  },
  barcodeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  barcodeInfo: {
    flex: 1,
  },
  barcodeLabel: {
    color: "rgba(255,255,255,0.8)",
    marginBottom: 2,
  },
  barcodeValue: {
    color: "#fff",
  },
  rescanButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  sourceTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
    alignSelf: "flex-start",
    gap: 4,
  },
  sourceTagText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 11,
    fontWeight: "600",
  },
  autoFilledBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 166, 81, 0.1)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(0, 166, 81, 0.2)",
  },
  autoFilledText: {
    color: "#00A651",
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  formSection: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
    letterSpacing: 1,
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    marginBottom: Spacing.xs,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: 16,
  },
  textAreaInput: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  readOnlyInput: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  readOnlyText: {
    fontSize: 16,
  },
  rowInputs: {
    flexDirection: "row",
  },
  chipScroll: {
    marginHorizontal: -Spacing.xs,
  },
  chip: {
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginHorizontal: Spacing.xs,
  },
  locationChip: {
    flexDirection: "row",
    alignItems: "center",
  },
  chipText: {
    fontSize: 13,
  },
  quantityContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  quantityButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  quantityInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.xs,
    fontSize: 18,
    fontWeight: "600",
  },
  expiryToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  expiryToggleContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  toggleSwitch: {
    width: 48,
    height: 28,
    borderRadius: 14,
    padding: 4,
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#fff",
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  submitContainer: {
    alignItems: "center",
  },
  submitButton: {
    width: "100%",
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
    marginBottom: Spacing.md,
  },
  submitGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
  },
  submitText: {
    color: "#fff",
    marginLeft: Spacing.sm,
  },
  cancelButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
    zIndex: 100,
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#00A651",
    justifyContent: "center",
    alignItems: "center",
  },
});
