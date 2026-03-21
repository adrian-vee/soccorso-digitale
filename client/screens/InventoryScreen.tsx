import React, { useState, useCallback, useEffect } from "react";
import { View, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator, RefreshControl, Platform, Modal, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CameraView, useCameraPermissions } from "expo-camera";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { AmbulanceIcon } from "@/components/AmbulanceIcon";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest, getApiUrl, getAuthToken } from "@/lib/query-client";

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  barcode?: string;
  description?: string;
  hasExpiry: boolean;
  minStockLevel: number;
}

interface VehicleInventoryItem {
  inventory: {
    id: string;
    vehicleId: string;
    itemId: string;
    currentQuantity: number;
    requiredQuantity: number;
    expirationDate?: string;
    lastCheckedAt?: string;
  };
  item: InventoryItem;
}

type ViewMode = "inventory" | "usage" | "replenish" | "scanner";

export default function InventoryScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const selectedVehicle = user?.vehicle || null;
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState<ViewMode>("inventory");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [scannerActive, setScannerActive] = useState(false);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [registerModalVisible, setRegisterModalVisible] = useState(false);
  const [pendingBarcode, setPendingBarcode] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState<string>("presidi");
  const [newItemUnit, setNewItemUnit] = useState("pz");

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const canRegisterItems = user?.role === "admin" || user?.role === "director";
  const INVENTORY_CATEGORIES = ["presidi", "farmaci", "medicazione", "rianimazione", "immobilizzazione", "protezione", "fluidi", "strumentazione", "altro"];

  const { data: inventoryItems = [], isLoading: loadingInventory, refetch: refetchInventory } = useQuery<VehicleInventoryItem[]>({
    queryKey: ["/api/vehicles", selectedVehicle?.id, "inventory"],
    queryFn: async () => {
      if (!selectedVehicle) return [];
      const url = new URL(`/api/vehicles/${selectedVehicle.id}/inventory`, getApiUrl());
      const token = await getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(url.toString(), { credentials: "include", headers });
      if (!res.ok) throw new Error("Errore caricamento inventario");
      return res.json();
    },
    enabled: !!selectedVehicle,
  });

  const { data: pendingItems = [], refetch: refetchPending } = useQuery<VehicleInventoryItem[]>({
    queryKey: ["/api/vehicles", selectedVehicle?.id, "inventory/pending"],
    queryFn: async () => {
      if (!selectedVehicle) return [];
      const url = new URL(`/api/vehicles/${selectedVehicle.id}/inventory/pending`, getApiUrl());
      const token = await getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(url.toString(), { credentials: "include", headers });
      if (!res.ok) throw new Error("Errore caricamento materiali mancanti");
      return res.json();
    },
    enabled: !!selectedVehicle,
  });

  const usageMutation = useMutation({
    mutationFn: async (data: { itemId: string; quantity: number; notes?: string; tripId?: string }) => {
      if (!selectedVehicle) throw new Error("Veicolo non selezionato");
      const url = new URL(`/api/vehicles/${selectedVehicle.id}/inventory/usage`, getApiUrl());
      const token = await getAuthToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(url.toString(), {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Errore segnalazione utilizzo");
      return res.json();
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles", selectedVehicle?.id, "inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles", selectedVehicle?.id, "inventory/pending"] });
    },
    onError: (error: Error) => {
      Alert.alert("Errore", error.message);
    },
  });

  const replenishMutation = useMutation({
    mutationFn: async (data: { itemId: string; quantity: number; locationId: string; notes?: string }) => {
      if (!selectedVehicle) throw new Error("Veicolo non selezionato");
      const url = new URL(`/api/vehicles/${selectedVehicle.id}/inventory/replenish`, getApiUrl());
      const token = await getAuthToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(url.toString(), {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Errore ripristino materiale");
      return res.json();
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles", selectedVehicle?.id, "inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles", selectedVehicle?.id, "inventory/pending"] });
      Alert.alert("Successo", "Materiale ripristinato con successo");
    },
    onError: (error: Error) => {
      Alert.alert("Errore", error.message);
    },
  });

  const createItemMutation = useMutation({
    mutationFn: async (data: { name: string; category: string; unit: string; barcode: string }) => {
      const url = new URL("/api/inventory/items", getApiUrl());
      const token = await getAuthToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(url.toString(), {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Errore creazione articolo");
      return res.json();
    },
    onSuccess: (newItem) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/items"] });
      setRegisterModalVisible(false);
      setPendingBarcode(null);
      setNewItemName("");
      setNewItemCategory("presidi");
      setNewItemUnit("pz");
      Alert.alert("Successo", `Articolo "${newItem.name}" registrato con codice ${newItem.barcode}`);
    },
    onError: (error: Error) => {
      Alert.alert("Errore", error.message);
    },
  });

  const categories = React.useMemo(() => {
    const cats = new Set<string>();
    inventoryItems.forEach((inv) => cats.add(inv.item.category));
    return Array.from(cats).sort();
  }, [inventoryItems]);

  const filteredItems = React.useMemo(() => {
    if (!selectedCategory) return inventoryItems;
    return inventoryItems.filter((inv) => inv.item.category === selectedCategory);
  }, [inventoryItems, selectedCategory]);

  const handleReportUsage = useCallback((item: VehicleInventoryItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      `Utilizzo: ${item.item.name}`,
      `Quantita attuale: ${item.inventory.currentQuantity}\n\nIndicare quanti utilizzati?`,
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "1",
          onPress: () => usageMutation.mutate({ itemId: item.item.id, quantity: 1 }),
        },
        {
          text: "2",
          onPress: () => usageMutation.mutate({ itemId: item.item.id, quantity: 2 }),
        },
        {
          text: "Altro...",
          onPress: () => {
            Alert.prompt(
              "Quantita utilizzata",
              `Inserire il numero di ${item.item.unit} utilizzati`,
              (text) => {
                const qty = parseInt(text, 10);
                if (!isNaN(qty) && qty > 0) {
                  usageMutation.mutate({ itemId: item.item.id, quantity: qty });
                }
              },
              "plain-text",
              "",
              "numeric"
            );
          },
        },
      ]
    );
  }, [usageMutation]);

  const handleReplenish = useCallback((item: VehicleInventoryItem) => {
    if (!selectedVehicle?.locationId) {
      Alert.alert("Errore", "Nessuna sede associata al veicolo");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const needed = item.inventory.requiredQuantity - item.inventory.currentQuantity;
    Alert.alert(
      `Ripristino: ${item.item.name}`,
      `Mancanti: ${needed} ${item.item.unit}\n\nRipristinare dal magazzino?`,
      [
        { text: "Annulla", style: "cancel" },
        {
          text: `+${needed}`,
          onPress: () =>
            replenishMutation.mutate({
              itemId: item.item.id,
              quantity: needed,
              locationId: selectedVehicle.locationId!,
            }),
        },
      ]
    );
  }, [replenishMutation, selectedVehicle]);

  const handleBarcodeScanned = useCallback(async ({ data }: { data: string }) => {
    if (scannedCode === data) return;
    setScannedCode(data);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    try {
      const url = new URL(`/api/inventory/barcode/${encodeURIComponent(data)}`, getApiUrl());
      const token = await getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(url.toString(), { credentials: "include", headers });
      
      if (res.ok) {
        const item = await res.json();
        setScannerActive(false);
        setScannedCode(null);
        
        const vehicleInv = inventoryItems.find((inv) => inv.item.id === item.id);
        if (vehicleInv) {
          handleReplenish(vehicleInv);
        } else {
          Alert.alert("Articolo Trovato", `${item.name}\n\nQuesto articolo non e presente nell'inventario standard del veicolo.`);
        }
      } else {
        setScannerActive(false);
        if (canRegisterItems) {
          Alert.alert(
            "Codice Non Trovato",
            `Il codice ${data} non e presente nel catalogo.\n\nVuoi registrare un nuovo articolo con questo codice?`,
            [
              { 
                text: "Annulla", 
                style: "cancel",
                onPress: () => setScannedCode(null),
              },
              {
                text: "Registra",
                onPress: () => {
                  setPendingBarcode(data);
                  setRegisterModalVisible(true);
                  setScannedCode(null);
                },
              },
            ]
          );
        } else {
          Alert.alert("Non Trovato", `Codice ${data} non trovato nel catalogo.\n\nContatta un amministratore per registrare nuovi materiali.`);
          setScannedCode(null);
        }
      }
    } catch (error) {
      Alert.alert("Errore", "Errore nella ricerca del codice");
      setScannedCode(null);
    }
  }, [scannedCode, inventoryItems, handleReplenish, canRegisterItems]);

  const getQuantityColor = (current: number, required: number) => {
    const ratio = current / required;
    if (ratio >= 1) return theme.success;
    if (ratio >= 0.5) return theme.warning;
    return theme.error;
  };

  const renderCategoryChips = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.categoryContainer}
    >
      <Pressable
        style={[
          styles.categoryChip,
          { backgroundColor: !selectedCategory ? theme.primary : theme.cardBackground },
        ]}
        onPress={() => setSelectedCategory(null)}
      >
        <ThemedText style={[styles.categoryText, { color: !selectedCategory ? "#fff" : theme.text }]}>
          Tutti
        </ThemedText>
      </Pressable>
      {categories.map((cat) => (
        <Pressable
          key={cat}
          style={[
            styles.categoryChip,
            { backgroundColor: selectedCategory === cat ? theme.primary : theme.cardBackground },
          ]}
          onPress={() => setSelectedCategory(cat)}
        >
          <ThemedText style={[styles.categoryText, { color: selectedCategory === cat ? "#fff" : theme.text }]}>
            {cat}
          </ThemedText>
        </Pressable>
      ))}
    </ScrollView>
  );

  const renderInventoryList = () => (
    <ScrollView
      style={styles.list}
      contentContainerStyle={[styles.listContent, { paddingBottom: tabBarHeight + Spacing.xl }]}
      refreshControl={
        <RefreshControl
          refreshing={loadingInventory}
          onRefresh={() => {
            refetchInventory();
            refetchPending();
          }}
        />
      }
    >
      {pendingItems.length > 0 ? (
        <Card style={{ ...styles.alertCard, backgroundColor: theme.errorLight }}>
          <View style={styles.alertHeader}>
            <Feather name="alert-triangle" size={20} color={theme.error} />
            <ThemedText style={[styles.alertTitle, { color: theme.error }]}>
              Materiale da Ripristinare ({pendingItems.length})
            </ThemedText>
          </View>
          {pendingItems.map((inv) => (
            <Pressable
              key={inv.inventory.id}
              style={[styles.pendingItem, { borderColor: theme.error }]}
              onPress={() => handleReplenish(inv)}
            >
              <View style={styles.pendingItemInfo}>
                <ThemedText style={styles.pendingItemName}>{inv.item.name}</ThemedText>
                <ThemedText style={[styles.pendingItemQty, { color: theme.error }]}>
                  {inv.inventory.currentQuantity}/{inv.inventory.requiredQuantity} {inv.item.unit}
                </ThemedText>
              </View>
              <Feather name="plus-circle" size={24} color={theme.primary} />
            </Pressable>
          ))}
        </Card>
      ) : null}

      {renderCategoryChips()}

      {filteredItems.map((inv) => (
        <Card key={inv.inventory.id} style={styles.itemCard}>
          <View style={styles.itemRow}>
            <View style={styles.itemInfo}>
              {inv.item.hasExpiry ? (
                <View style={[styles.criticalBadge, { backgroundColor: theme.warning }]}>
                  <Feather name="clock" size={12} color="#fff" />
                </View>
              ) : null}
              <View>
                <ThemedText style={styles.itemName}>{inv.item.name}</ThemedText>
                <ThemedText style={[styles.itemCategory, { color: theme.textSecondary }]}>
                  {inv.item.category}
                </ThemedText>
              </View>
            </View>
            <View style={styles.quantitySection}>
              <View
                style={[
                  styles.quantityBadge,
                  { backgroundColor: getQuantityColor(inv.inventory.currentQuantity, inv.inventory.requiredQuantity) + "20" },
                ]}
              >
                <ThemedText
                  style={[
                    styles.quantityText,
                    { color: getQuantityColor(inv.inventory.currentQuantity, inv.inventory.requiredQuantity) },
                  ]}
                >
                  {inv.inventory.currentQuantity}/{inv.inventory.requiredQuantity}
                </ThemedText>
                <ThemedText style={[styles.unitText, { color: theme.textSecondary }]}>
                  {inv.item.unit}
                </ThemedText>
              </View>
            </View>
          </View>
          <View style={styles.itemActions}>
            <Pressable
              style={[styles.actionButton, { backgroundColor: theme.warning + "20" }]}
              onPress={() => handleReportUsage(inv)}
            >
              <Feather name="minus-circle" size={16} color={theme.warning} />
              <ThemedText style={[styles.actionText, { color: theme.warning }]}>Utilizzato</ThemedText>
            </Pressable>
            {inv.inventory.currentQuantity < inv.inventory.requiredQuantity ? (
              <Pressable
                style={[styles.actionButton, { backgroundColor: theme.success + "20" }]}
                onPress={() => handleReplenish(inv)}
              >
                <Feather name="plus-circle" size={16} color={theme.success} />
                <ThemedText style={[styles.actionText, { color: theme.success }]}>Ripristina</ThemedText>
              </Pressable>
            ) : null}
          </View>
          {inv.inventory.expirationDate ? (
            <View style={[styles.expirationRow, { borderTopColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" }]}>
              <Feather name="clock" size={14} color={theme.textSecondary} />
              <ThemedText style={[styles.expirationText, { color: theme.textSecondary }]}>
                Scadenza: {new Date(inv.inventory.expirationDate).toLocaleDateString("it-IT")}
              </ThemedText>
            </View>
          ) : null}
        </Card>
      ))}

      {filteredItems.length === 0 && !loadingInventory ? (
        <View style={styles.emptyState}>
          <Feather name="package" size={48} color={theme.textSecondary} />
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
            Nessun materiale in inventario
          </ThemedText>
        </View>
      ) : null}
    </ScrollView>
  );

  const renderScanner = () => {
    if (Platform.OS === "web") {
      return (
        <View style={[styles.scannerFallback, { backgroundColor: theme.cardBackground }]}>
          <Feather name="camera-off" size={48} color={theme.textSecondary} />
          <ThemedText style={[styles.scannerFallbackText, { color: theme.textSecondary }]}>
            Scanner non disponibile su web
          </ThemedText>
          <ThemedText style={[styles.scannerFallbackHint, { color: theme.textSecondary }]}>
            Usa Expo Go sul tuo dispositivo per scansionare i codici
          </ThemedText>
          <Pressable
            style={[styles.closeButton, { backgroundColor: theme.primary }]}
            onPress={() => setScannerActive(false)}
          >
            <ThemedText style={styles.closeButtonText}>Chiudi</ThemedText>
          </Pressable>
        </View>
      );
    }

    if (!cameraPermission?.granted) {
      return (
        <View style={[styles.scannerFallback, { backgroundColor: theme.cardBackground }]}>
          <Feather name="camera" size={48} color={theme.textSecondary} />
          <ThemedText style={[styles.scannerFallbackText, { color: theme.textSecondary }]}>
            Accesso alla fotocamera richiesto
          </ThemedText>
          <Pressable
            style={[styles.permissionButton, { backgroundColor: theme.primary }]}
            onPress={requestCameraPermission}
          >
            <ThemedText style={styles.permissionButtonText}>Autorizza Fotocamera</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.closeButton, { backgroundColor: theme.cardBackground, borderWidth: 1, borderColor: theme.border }]}
            onPress={() => setScannerActive(false)}
          >
            <ThemedText style={{ color: theme.text }}>Chiudi</ThemedText>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.scannerContainer}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ["qr", "ean13", "ean8", "code128", "code39", "code93", "upc_a", "upc_e"],
          }}
          onBarcodeScanned={handleBarcodeScanned}
        />
        <View style={styles.scannerOverlay}>
          <View style={styles.scannerFrame} />
        </View>
        <View style={[styles.scannerControls, { bottom: tabBarHeight + Spacing.xl }]}>
          <ThemedText style={styles.scannerHint}>
            Inquadra il codice a barre del materiale
          </ThemedText>
          <Pressable
            style={[styles.closeButton, { backgroundColor: theme.primary }]}
            onPress={() => setScannerActive(false)}
          >
            <ThemedText style={styles.closeButtonText}>Chiudi Scanner</ThemedText>
          </Pressable>
        </View>
      </View>
    );
  };

  if (!selectedVehicle) {
    return (
      <ThemedView style={[styles.container, { paddingTop: headerHeight }]}>
        <View style={styles.emptyState}>
          <AmbulanceIcon size={48} color={theme.textSecondary} />
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
            Seleziona un veicolo per gestire l'inventario
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (scannerActive) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
        {renderScanner()}
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { paddingTop: headerHeight }]}>
      <View style={styles.header}>
        <View style={styles.vehicleInfo}>
          <Feather name="package" size={20} color={theme.primary} />
          <ThemedText style={styles.vehicleName}>{selectedVehicle.code}</ThemedText>
        </View>
        <Pressable
          style={[styles.scanButton, { backgroundColor: theme.primary }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setScannerActive(true);
          }}
        >
          <Feather name="camera" size={18} color="#fff" />
          <ThemedText style={styles.scanButtonText}>Scansiona</ThemedText>
        </Pressable>
      </View>

      {loadingInventory ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText style={{ color: theme.textSecondary }}>Caricamento inventario...</ThemedText>
        </View>
      ) : (
        renderInventoryList()
      )}

      <Modal
        visible={registerModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setRegisterModalVisible(false);
          setPendingBarcode(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Registra Nuovo Articolo</ThemedText>
              <Pressable onPress={() => {
                setRegisterModalVisible(false);
                setPendingBarcode(null);
              }}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <View style={[styles.barcodePreview, { backgroundColor: theme.cardBackground }]}>
              <Feather name="tag" size={20} color={theme.primary} />
              <ThemedText style={styles.barcodeText}>{pendingBarcode}</ThemedText>
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Nome Articolo *</ThemedText>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.cardBackground, color: theme.text, borderColor: theme.border }]}
                value={newItemName}
                onChangeText={setNewItemName}
                placeholder="Es. Garze Sterili 10x10"
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Categoria *</ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                {INVENTORY_CATEGORIES.map((cat) => (
                  <Pressable
                    key={cat}
                    style={[
                      styles.categoryOption,
                      { 
                        backgroundColor: newItemCategory === cat ? theme.primary : theme.cardBackground,
                        borderColor: theme.border,
                      },
                    ]}
                    onPress={() => setNewItemCategory(cat)}
                  >
                    <ThemedText style={{ color: newItemCategory === cat ? "#fff" : theme.text, fontSize: 13 }}>
                      {cat}
                    </ThemedText>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Unita di Misura</ThemedText>
              <View style={styles.unitOptions}>
                {["pz", "conf", "ml", "flacone", "rotolo", "coppia", "set"].map((u) => (
                  <Pressable
                    key={u}
                    style={[
                      styles.unitOption,
                      { 
                        backgroundColor: newItemUnit === u ? theme.primary : theme.cardBackground,
                        borderColor: theme.border,
                      },
                    ]}
                    onPress={() => setNewItemUnit(u)}
                  >
                    <ThemedText style={{ color: newItemUnit === u ? "#fff" : theme.text, fontSize: 13 }}>
                      {u}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            <Pressable
              style={[
                styles.registerButton,
                { backgroundColor: newItemName.trim() ? theme.primary : theme.border },
              ]}
              onPress={() => {
                if (newItemName.trim() && pendingBarcode) {
                  createItemMutation.mutate({
                    name: newItemName.trim(),
                    category: newItemCategory,
                    unit: newItemUnit,
                    barcode: pendingBarcode,
                  });
                }
              }}
              disabled={!newItemName.trim() || createItemMutation.isPending}
            >
              {createItemMutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <ThemedText style={styles.registerButtonText}>Registra Articolo</ThemedText>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  vehicleInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  vehicleName: {
    fontSize: 18,
    fontWeight: "600",
  },
  scanButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  scanButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: Spacing.lg,
  },
  categoryContainer: {
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    flexDirection: "row",
  },
  categoryChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: "500",
  },
  alertCard: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  alertHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  pendingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
  },
  pendingItemInfo: {
    flex: 1,
  },
  pendingItemName: {
    fontSize: 14,
    fontWeight: "500",
  },
  pendingItemQty: {
    fontSize: 12,
  },
  itemCard: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  criticalBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  itemName: {
    fontSize: 16,
    fontWeight: "500",
  },
  itemCategory: {
    fontSize: 12,
  },
  quantitySection: {
    alignItems: "flex-end",
  },
  quantityBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  quantityText: {
    fontSize: 16,
    fontWeight: "700",
  },
  unitText: {
    fontSize: 10,
  },
  itemActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  actionText: {
    fontSize: 13,
    fontWeight: "500",
  },
  expirationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  expirationText: {
    fontSize: 12,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
    marginTop: Spacing.md,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
  scannerContainer: {
    flex: 1,
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  scannerFrame: {
    width: 280,
    height: 280,
    borderWidth: 3,
    borderColor: "#fff",
    borderRadius: 20,
    backgroundColor: "transparent",
  },
  scannerControls: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    gap: Spacing.md,
  },
  scannerHint: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
  },
  closeButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  closeButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  scannerFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  scannerFallbackText: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  scannerFallbackHint: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  permissionButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.lg,
  },
  permissionButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.lg,
    paddingBottom: 40,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  barcodePreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  barcodeText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  formGroup: {
    marginBottom: Spacing.md,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 16,
  },
  categoryScroll: {
    flexGrow: 0,
  },
  categoryOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
    borderWidth: 1,
  },
  unitOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  unitOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  registerButton: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    marginTop: Spacing.lg,
  },
  registerButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});
