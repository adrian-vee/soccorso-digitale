import React, { useState, useCallback, useMemo, useRef } from "react";
import { View, StyleSheet, Pressable, ScrollView, Alert, TextInput, ActivityIndicator, RefreshControl, Animated, LayoutAnimation, Platform, UIManager, Modal, KeyboardAvoidingView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { AmbulanceIcon } from "@/components/AmbulanceIcon";
import { OxygenSection } from "@/components/OxygenSection";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest, getApiUrl, getAuthToken } from "@/lib/query-client";

interface OxygenLevels {
  bombola1: number;
  bombola2: number;
  portatile: number;
}

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const AMBULANCE_ZONES = [
  { id: "controlli_autista", name: "Controlli Autista", icon: "user", color: "#FFA500", dbCategories: ["controlli autista", "controlli_autista"] },
  { id: "materiale_zaino", name: "Materiale Zaino", icon: "briefcase", color: "#00A651", dbCategories: ["materiale zaino", "materiale_zaino"] },
  { id: "materiale_ambulanza", name: "Materiale Ambulanza", icon: "truck", color: "#0066CC", dbCategories: ["materiale ambulanza", "materiale_ambulanza"] },
  { id: "materiale_vario", name: "Materiale Vario", icon: "package", color: "#CC0000", dbCategories: ["materiale vario", "materiale_vario"] },
] as const;

interface ChecklistTemplateItem {
  id: string;
  label: string;
  category: string;
  subZone: string | null;
  description: string | null;
  quantity: number;
  isRequired: boolean;
  sortOrder: number;
  hasExpiry: boolean;
  expiryDate: string | null;
  zoneColor: string | null;
  requiredQuantity?: number;
  templateType?: string;
}

interface VehicleChecklistData {
  source: "template" | "global";
  templateId: string | null;
  templateName: string;
  templateType: string;
  items: ChecklistTemplateItem[];
}

type IssueType = "ok" | "mancante" | "quantita" | "danneggiato";

interface ChecklistItemState {
  itemId: string;
  label: string;
  category: string;
  subZone: string | null;
  quantity: number;
  checked: boolean;
  notes?: string;
  usedLastShift?: boolean;
  needsRestock?: boolean;
  issueType?: IssueType;
  actualQuantity?: number;
}

interface VehicleChecklist {
  id: string;
  vehicleId: string;
  shiftDate: string;
  submittedByName: string;
  completedAt: string;
  items: ChecklistItemState[];
  hasAnomalies: boolean;
  anomalyDescription: string | null;
  generalNotes?: string;
}

interface ZoneState {
  zoneId: string;
  allOk: boolean;
  expanded: boolean;
  itemsChecked: number;
  totalItems: number;
}

type ViewMode = "fast" | "detailed" | "history";

export default function ChecklistScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const selectedVehicle = user?.vehicle || null;
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState<ViewMode>("fast");
  const [checklistState, setChecklistState] = useState<ChecklistItemState[]>([]);
  const [zoneStates, setZoneStates] = useState<Record<string, ZoneState>>({});
  const [hasAnomalies, setHasAnomalies] = useState(false);
  const [anomalyDescription, setAnomalyDescription] = useState("");
  const [generalNotes, setGeneralNotes] = useState("");
  const [signatureName, setSignatureName] = useState("");
  const [signatureError, setSignatureError] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [expandedChecklistId, setExpandedChecklistId] = useState<string | null>(null);
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null);
  const [showRestockOnly, setShowRestockOnly] = useState(false);
  const [oxygenLevels, setOxygenLevels] = useState<OxygenLevels>({
    bombola1: 200,
    bombola2: 200,
    portatile: 200,
  });
  const [issueModalVisible, setIssueModalVisible] = useState(false);
  const [selectedItemForIssue, setSelectedItemForIssue] = useState<ChecklistItemState | null>(null);
  const [tempActualQuantity, setTempActualQuantity] = useState<string>("");

  const { data: checklistData, isLoading: loadingTemplates, error: checklistError, refetch: refetchChecklist } = useQuery<VehicleChecklistData>({
    queryKey: ["/api/vehicles", selectedVehicle?.id, "checklist-items"],
    queryFn: async () => {
      if (!selectedVehicle) throw new Error("No vehicle");
      const url = new URL(`/api/vehicles/${selectedVehicle.id}/checklist-items`, getApiUrl());
      const token = await getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(url.toString(), { credentials: "include", headers });
      if (!res.ok) {
        console.error("Checklist items API failed:", res.status);
        throw new Error("Errore caricamento checklist");
      }
      const data = await res.json();
      console.log("Checklist loaded:", data.items?.length, "items in", data.templateName);
      return data;
    },
    enabled: !!selectedVehicle,
    retry: 3,
    retryDelay: 1000,
    staleTime: 0,
  });
  
  const templateItems = checklistData?.items || [];
  const templateType = checklistData?.templateType || "MSB";
  const templateName = checklistData?.templateName || "Checklist";

  const { data: todayChecklist, isLoading: loadingToday, refetch: refetchToday } = useQuery<VehicleChecklist | null>({
    queryKey: ["/api/vehicle-checklists", selectedVehicle?.id, "today"],
    queryFn: async () => {
      if (!selectedVehicle) return null;
      const url = new URL(`/api/vehicle-checklists/${selectedVehicle.id}/today`, getApiUrl());
      const token = await getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(url.toString(), { credentials: "include", headers });
      if (!res.ok) {
        console.error("Today checklist API failed:", res.status);
        return null;
      }
      return res.json();
    },
    enabled: !!selectedVehicle,
    retry: 2,
    staleTime: 0,
  });

  const { data: yesterdayUsage } = useQuery<{ usedItems: string[] }>({
    queryKey: ["/api/vehicles", selectedVehicle?.id, "yesterday-usage"],
    queryFn: async () => {
      if (!selectedVehicle) return { usedItems: [] };
      const url = new URL(`/api/vehicles/${selectedVehicle.id}/yesterday-usage`, getApiUrl());
      const token = await getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(url.toString(), { credentials: "include", headers });
      if (!res.ok) return { usedItems: [] };
      return res.json();
    },
    enabled: !!selectedVehicle,
  });

  const { data: historyChecklists = [], isLoading: loadingHistory, refetch: refetchHistory } = useQuery<VehicleChecklist[]>({
    queryKey: ["/api/vehicle-checklists", selectedVehicle?.id],
    queryFn: async () => {
      if (!selectedVehicle) return [];
      const url = new URL(`/api/vehicle-checklists/${selectedVehicle.id}?limit=30`, getApiUrl());
      const token = await getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(url.toString(), { credentials: "include", headers });
      if (!res.ok) throw new Error("Errore caricamento storico");
      return res.json();
    },
    enabled: !!selectedVehicle && viewMode === "history",
  });

  const usedItemsSet = useMemo(() => new Set(yesterdayUsage?.usedItems || []), [yesterdayUsage]);

  React.useEffect(() => {
    if (templateItems.length > 0 && !isInitialized && !todayChecklist) {
      const initialState = templateItems.map((item) => ({
        itemId: item.id,
        label: item.label,
        category: item.category,
        subZone: item.subZone || null,
        quantity: item.quantity || 1,
        checked: false,
        usedLastShift: usedItemsSet.has(item.id),
        needsRestock: usedItemsSet.has(item.id),
      }));
      setChecklistState(initialState);
      
      const initialZoneStates: Record<string, ZoneState> = {};
      AMBULANCE_ZONES.forEach(zone => {
        const normalizedZoneCheck = (cat: string) => {
          const normCat = cat.toLowerCase().replace(/\s+/g, "_").replace(/[^\w]/g, "");
          return zone.dbCategories.some(dbCat => 
            normCat.includes(dbCat) || dbCat.includes(normCat)
          );
        };
        const zoneItems = initialState.filter(item => normalizedZoneCheck(item.category));
        initialZoneStates[zone.id] = {
          zoneId: zone.id,
          allOk: false,
          expanded: false,
          itemsChecked: 0,
          totalItems: zoneItems.length,
        };
      });
      setZoneStates(initialZoneStates);
      setIsInitialized(true);
    }
  }, [templateItems, isInitialized, todayChecklist, usedItemsSet]);

  const getZoneForCategory = (category: string): string => {
    const normalizedCategory = category.toLowerCase().replace(/\s+/g, " ").trim();
    const matchedZone = AMBULANCE_ZONES.find(zone => 
      zone.dbCategories.some(dbCat => 
        normalizedCategory.includes(dbCat) || dbCat.includes(normalizedCategory)
      )
    );
    return matchedZone?.id || "materiale_vario";
  };

  // Group items by zone and sub-zone for hierarchical display
  const itemsByZoneAndSubZone = useMemo(() => {
    const grouped: Record<string, Record<string, ChecklistItemState[]>> = {};
    AMBULANCE_ZONES.forEach(zone => {
      grouped[zone.id] = {};
    });
    
    checklistState.forEach(item => {
      const zoneId = getZoneForCategory(item.category);
      if (!grouped[zoneId]) grouped[zoneId] = {};
      
      const subZoneKey = item.subZone || "_main";
      if (!grouped[zoneId][subZoneKey]) grouped[zoneId][subZoneKey] = [];
      grouped[zoneId][subZoneKey].push(item);
    });
    
    return grouped;
  }, [checklistState]);

  // Flat items by zone for compatibility
  const itemsByZone = useMemo(() => {
    const grouped: Record<string, ChecklistItemState[]> = {};
    AMBULANCE_ZONES.forEach(zone => {
      grouped[zone.id] = [];
    });
    
    checklistState.forEach(item => {
      const zoneId = getZoneForCategory(item.category);
      if (!grouped[zoneId]) grouped[zoneId] = [];
      grouped[zoneId].push(item);
    });
    
    return grouped;
  }, [checklistState]);

  const submitMutation = useMutation({
    mutationFn: async (data: {
      vehicleId: string;
      locationId?: string;
      submittedByName: string;
      items: ChecklistItemState[];
      hasAnomalies: boolean;
      anomalyDescription?: string;
      generalNotes?: string;
    }) => {
      return apiRequest("POST", "/api/vehicle-checklists", data);
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["/api/vehicle-checklists", selectedVehicle?.id] });
      refetchToday();
      Alert.alert("Checklist Completata!", "La checklist pre-partenza e stata registrata in soli pochi secondi!");
    },
    onError: (error: Error) => {
      Alert.alert("Errore", error.message || "Impossibile inviare la checklist");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: {
      checklistId: string;
      items: ChecklistItemState[];
      hasAnomalies: boolean;
      anomalyDescription?: string;
      generalNotes?: string;
    }) => {
      return apiRequest("PUT", `/api/vehicle-checklists/${data.checklistId}`, data);
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["/api/vehicle-checklists", selectedVehicle?.id] });
      refetchToday();
      refetchHistory();
      setEditingChecklistId(null);
      setViewMode("history");
      Alert.alert("Checklist Aggiornata", "Le modifiche sono state salvate.");
    },
    onError: (error: Error) => {
      Alert.alert("Errore", error.message || "Impossibile aggiornare");
    },
  });

  const handleZoneTuttoOk = (zoneId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    
    const zoneItems = itemsByZone[zoneId] || [];
    const allChecked = zoneItems.every(item => item.checked);
    
    setChecklistState(prev => 
      prev.map(item => {
        const itemZone = getZoneForCategory(item.category);
        if (itemZone === zoneId) {
          return { ...item, checked: !allChecked };
        }
        return item;
      })
    );
    
    setZoneStates(prev => ({
      ...prev,
      [zoneId]: {
        ...prev[zoneId],
        allOk: !allChecked,
        itemsChecked: allChecked ? 0 : zoneItems.length,
      }
    }));
  };

  const handleZoneExpand = (zoneId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setZoneStates(prev => ({
      ...prev,
      [zoneId]: { ...prev[zoneId], expanded: !prev[zoneId]?.expanded }
    }));
  };

  const toggleItem = (itemId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setChecklistState(prev => {
      const updated = prev.map(item =>
        item.itemId === itemId ? { ...item, checked: !item.checked } : item
      );
      
      AMBULANCE_ZONES.forEach(zone => {
        const zoneItems = updated.filter(item => getZoneForCategory(item.category) === zone.id);
        const checkedCount = zoneItems.filter(i => i.checked).length;
        setZoneStates(zs => ({
          ...zs,
          [zone.id]: {
            ...zs[zone.id],
            allOk: checkedCount === zoneItems.length && zoneItems.length > 0,
            itemsChecked: checkedCount,
          }
        }));
      });
      
      return updated;
    });
  };

  const openIssueModal = (item: ChecklistItemState) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedItemForIssue(item);
    setTempActualQuantity(item.actualQuantity?.toString() || "");
    setIssueModalVisible(true);
  };

  const handleSetIssue = (issueType: IssueType) => {
    if (!selectedItemForIssue) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const actualQty = issueType === "quantita" ? parseInt(tempActualQuantity) || 0 : undefined;
    
    setChecklistState(prev => prev.map(item => {
      if (item.itemId === selectedItemForIssue.itemId) {
        return {
          ...item,
          issueType,
          actualQuantity: actualQty,
          checked: issueType === "ok",
        };
      }
      return item;
    }));
    
    setIssueModalVisible(false);
    setSelectedItemForIssue(null);
    setTempActualQuantity("");
  };

  const clearIssue = (itemId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setChecklistState(prev => prev.map(item => {
      if (item.itemId === itemId) {
        return {
          ...item,
          issueType: undefined,
          actualQuantity: undefined,
        };
      }
      return item;
    }));
  };

  const getIssueLabel = (issueType: IssueType | undefined): string => {
    switch (issueType) {
      case "mancante": return "Mancante";
      case "quantita": return "Quantita";
      case "danneggiato": return "Danneggiato";
      default: return "";
    }
  };

  const getIssueColor = (issueType: IssueType | undefined): string => {
    switch (issueType) {
      case "mancante": return "#EF4444";
      case "quantita": return "#F59E0B";
      case "danneggiato": return "#8B5CF6";
      default: return theme.textSecondary;
    }
  };

  const handleTuttoOkGlobal = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
    
    const allChecked = checklistState.every(item => item.checked);
    
    setChecklistState(prev => prev.map(item => ({ ...item, checked: !allChecked })));
    
    const newZoneStates: Record<string, ZoneState> = {};
    AMBULANCE_ZONES.forEach(zone => {
      const zoneItems = itemsByZone[zone.id] || [];
      newZoneStates[zone.id] = {
        zoneId: zone.id,
        allOk: !allChecked,
        expanded: zoneStates[zone.id]?.expanded || false,
        itemsChecked: allChecked ? 0 : zoneItems.length,
        totalItems: zoneItems.length,
      };
    });
    setZoneStates(newZoneStates);
  };

  const handleSubmit = () => {
    if (!selectedVehicle) return;

    if (!signatureName.trim()) {
      setSignatureError(true);
      Alert.alert("Nome Obbligatorio", "Inserisci il tuo nome per salvare la checklist.");
      return;
    }

    const uncheckedItems = checklistState.filter(item => !item.checked);
    
    if (uncheckedItems.length > 0 && !hasAnomalies) {
      Alert.alert(
        "Controlli Incompleti",
        `Ci sono ${uncheckedItems.length} elementi non confermati. Vuoi segnalare un'anomalia?`,
        [
          { text: "Rivedi", style: "cancel" },
          { 
            text: "Segnala Anomalia", 
            onPress: () => setHasAnomalies(true)
          }
        ]
      );
      return;
    }

    if (hasAnomalies && !anomalyDescription.trim()) {
      Alert.alert("Descrizione Richiesta", "Descrivi l'anomalia riscontrata.");
      return;
    }

    if (editingChecklistId) {
      updateMutation.mutate({
        checklistId: editingChecklistId,
        items: checklistState,
        hasAnomalies,
        anomalyDescription: hasAnomalies ? anomalyDescription : undefined,
        generalNotes: generalNotes.trim() || undefined,
      });
    } else {
      submitMutation.mutate({
        vehicleId: selectedVehicle.id,
        locationId: selectedVehicle.locationId || undefined,
        submittedByName: signatureName.trim(),
        items: checklistState,
        hasAnomalies,
        anomalyDescription: hasAnomalies ? anomalyDescription : undefined,
        generalNotes: generalNotes.trim() || undefined,
      });
    }
  };

  const handleCancelEdit = () => {
    Alert.alert("Annulla Modifiche", "Vuoi annullare?", [
      { text: "Continua", style: "cancel" },
      {
        text: "Annulla",
        style: "destructive",
        onPress: () => {
          setEditingChecklistId(null);
          setViewMode("history");
          if (todayChecklist) {
            setChecklistState((todayChecklist.items || []) as ChecklistItemState[]);
            setHasAnomalies(todayChecklist.hasAnomalies || false);
            setAnomalyDescription(todayChecklist.anomalyDescription || "");
          }
        },
      },
    ]);
  };

  const onRefresh = useCallback(() => {
    if (viewMode === "history") {
      refetchHistory();
    } else {
      refetchToday();
    }
  }, [viewMode, refetchToday, refetchHistory]);

  const completedCount = checklistState.filter(item => item.checked).length;
  const totalCount = checklistState.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const isComplete = completedCount === totalCount && totalCount > 0;

  const restockCount = checklistState.filter(item => item.needsRestock).length;
  // Only count zones that have items
  const zonesWithItems = AMBULANCE_ZONES.filter(zone => (itemsByZone[zone.id]?.length || 0) > 0);
  const zonesCompleted = zonesWithItems.filter(zone => zoneStates[zone.id]?.allOk).length;
  const totalZonesWithItems = zonesWithItems.length;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  };

  const isLoading = loadingTemplates || loadingToday;

  if (!selectedVehicle) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.centerContent, { paddingTop: headerHeight }]}>
          <AmbulanceIcon size={48} color={theme.textSecondary} />
          <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md, textAlign: "center" }}>
            Seleziona un veicolo per compilare la checklist
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.centerContent, { paddingTop: headerHeight }]}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
            Caricamento...
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.tabBar, { backgroundColor: theme.cardBackground, marginTop: headerHeight }]}>
        <Pressable
          style={[styles.tab, viewMode === "fast" && { backgroundColor: theme.primary }]}
          onPress={() => setViewMode("fast")}
        >
          <Feather name="zap" size={14} color={viewMode === "fast" ? "#FFFFFF" : theme.text} />
          <ThemedText type="small" style={{ marginLeft: 3, color: viewMode === "fast" ? "#FFFFFF" : theme.text, fontWeight: "600", fontSize: 12 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            Veloce
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.tab, viewMode === "detailed" && { backgroundColor: theme.primary }]}
          onPress={() => setViewMode("detailed")}
        >
          <Feather name="list" size={14} color={viewMode === "detailed" ? "#FFFFFF" : theme.text} />
          <ThemedText type="small" style={{ marginLeft: 3, color: viewMode === "detailed" ? "#FFFFFF" : theme.text, fontWeight: "600", fontSize: 12 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            Dettaglio
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.tab, viewMode === "history" && { backgroundColor: theme.primary }]}
          onPress={() => setViewMode("history")}
        >
          <Feather name="clock" size={14} color={viewMode === "history" ? "#FFFFFF" : theme.text} />
          <ThemedText type="small" style={{ marginLeft: 3, color: viewMode === "history" ? "#FFFFFF" : theme.text, fontWeight: "600", fontSize: 12 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            Storico
          </ThemedText>
        </Pressable>
      </View>

      {(viewMode === "fast" || viewMode === "detailed") && (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{
            paddingTop: Spacing.md,
            paddingBottom: tabBarHeight + Spacing.xl,
            paddingHorizontal: Spacing.md,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} />}
        >
          <Card style={styles.headerCard}>
            <View style={styles.headerRow}>
              <View style={[styles.vehicleIcon, { backgroundColor: theme.primary }]}>
                <AmbulanceIcon size={24} color="#FFFFFF" />
              </View>
              <View style={styles.headerInfo}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
                  <ThemedText type="h3">Ambulanza {selectedVehicle.code}</ThemedText>
                  <View style={[styles.templateTypeBadge, { 
                    backgroundColor: templateType === "MSI" ? theme.warning : 
                      templateType === "EVENT" ? "#8B5CF6" : theme.primary 
                  }]}>
                    <ThemedText type="small" style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 10 }}>
                      {templateType}
                    </ThemedText>
                  </View>
                </View>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {templateName}
                </ThemedText>
              </View>
            </View>

            {todayChecklist && !editingChecklistId ? (
              <View style={[styles.completeBanner, { backgroundColor: theme.successLight }]}>
                <Feather name="check-circle" size={20} color={theme.success} />
                <View style={{ marginLeft: Spacing.md, flex: 1 }}>
                  <ThemedText type="body" style={{ color: theme.success, fontWeight: "600" }}>
                    Checklist completata
                  </ThemedText>
                  <ThemedText type="small" style={{ color: theme.success }}>
                    Firmata da {todayChecklist.submittedByName} alle {formatTime(todayChecklist.completedAt)}
                  </ThemedText>
                </View>
              </View>
            ) : (
              <>
                <View style={styles.statsRow}>
                  <View style={[styles.statBox, { backgroundColor: theme.primary + "15" }]}>
                    <ThemedText type="h2" style={{ color: theme.primary }}>{zonesCompleted}/{totalZonesWithItems}</ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>Zone OK</ThemedText>
                  </View>
                  <View style={[styles.statBox, { backgroundColor: theme.success + "15" }]}>
                    <ThemedText type="h2" style={{ color: theme.success }}>{completedCount}/{totalCount}</ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>Controlli</ThemedText>
                  </View>
                  {restockCount > 0 && (
                    <View style={[styles.statBox, { backgroundColor: theme.warning + "15" }]}>
                      <ThemedText type="h2" style={{ color: theme.warning }}>{restockCount}</ThemedText>
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>Reintegro</ThemedText>
                    </View>
                  )}
                </View>

                <View style={styles.signatureContainer}>
                  <View style={[styles.signatureBox, { borderColor: signatureError && !signatureName.trim() ? theme.error : theme.border }]}>
                    <Feather name="user" size={16} color={signatureError && !signatureName.trim() ? theme.error : theme.primary} />
                    <TextInput
                      style={[styles.signatureInput, { color: theme.text }]}
                      placeholder="Il tuo nome... (obbligatorio)"
                      placeholderTextColor={signatureError && !signatureName.trim() ? theme.error : theme.textSecondary}
                      value={signatureName}
                      onChangeText={(text) => {
                        setSignatureName(text);
                        if (text.trim()) setSignatureError(false);
                      }}
                    />
                  </View>
                  {signatureError && !signatureName.trim() && (
                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: Spacing.xs }}>
                      <Feather name="alert-circle" size={12} color={theme.error} />
                      <ThemedText type="small" style={{ color: theme.error, marginLeft: Spacing.xs }}>
                        Inserisci il tuo nome per salvare la checklist
                      </ThemedText>
                    </View>
                  )}
                </View>
              </>
            )}
          </Card>

          {!todayChecklist || editingChecklistId ? (
            <>
              {viewMode === "fast" && (
                <Pressable
                  style={[styles.globalOkButton, { 
                    backgroundColor: isComplete ? theme.success : theme.primary,
                    shadowColor: isComplete ? theme.success : theme.primary,
                  }]}
                  onPress={handleTuttoOkGlobal}
                >
                  <Feather name={isComplete ? "check-circle" : "check-square"} size={28} color="#FFFFFF" />
                  <View style={{ marginLeft: Spacing.md, flex: 1 }}>
                    <ThemedText type="h3" style={{ color: "#FFFFFF" }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                      {isComplete ? "TUTTO CONFERMATO" : "TUTTO OK"}
                    </ThemedText>
                    <ThemedText type="small" style={{ color: "#FFFFFF", opacity: 0.9 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                      {isComplete ? "Premi per deselezionare" : "Conferma tutti i controlli con un tap"}
                    </ThemedText>
                  </View>
                </Pressable>
              )}

              {restockCount > 0 && viewMode === "fast" && (
                <Card style={[styles.restockCard, { backgroundColor: theme.warning + "10", borderColor: theme.warning }]}>
                  <View style={styles.restockHeader}>
                    <Feather name="alert-circle" size={20} color={theme.warning} />
                    <ThemedText type="body" style={{ color: theme.warning, fontWeight: "600", marginLeft: Spacing.sm }}>
                      Reintegro Suggerito
                    </ThemedText>
                    <Pressable 
                      onPress={() => setShowRestockOnly(!showRestockOnly)}
                      style={[styles.showRestockButton, { backgroundColor: theme.warning }]}
                    >
                      <ThemedText type="small" style={{ color: "#FFFFFF" }}>
                        {showRestockOnly ? "Mostra Tutto" : "Solo Reintegro"}
                      </ThemedText>
                    </Pressable>
                  </View>
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
                    {restockCount} materiali usati nel turno precedente da verificare
                  </ThemedText>
                </Card>
              )}

              {viewMode === "fast" ? (
                <>
                  <OxygenSection
                    levels={oxygenLevels}
                    onChange={setOxygenLevels}
                    maxBar={200}
                  />
                  
                  <View style={styles.zonesGrid}>
                    {AMBULANCE_ZONES.map(zone => {
                      const zoneItems = itemsByZone[zone.id] || [];
                      if (zoneItems.length === 0) return null;
                      
                      const checkedCount = zoneItems.filter(i => i.checked).length;
                      const isZoneComplete = checkedCount === zoneItems.length;
                      const restockInZone = zoneItems.filter(i => i.needsRestock && !i.checked).length;
                      const isExpanded = zoneStates[zone.id]?.expanded;

                      if (showRestockOnly && restockInZone === 0) return null;

                    return (
                      <Card 
                        key={zone.id} 
                        style={[
                          styles.zoneCard,
                          isZoneComplete && { borderColor: theme.success, borderWidth: 2 }
                        ]}
                      >
                        <View style={styles.zoneHeader}>
                          <Pressable 
                            style={styles.zoneInfo}
                            onPress={() => handleZoneExpand(zone.id)}
                          >
                            <View style={[styles.zoneIconWrapper, { backgroundColor: zone.color + "20" }]}>
                              <Feather name={zone.icon as any} size={20} color={zone.color} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <ThemedText type="body" style={{ fontWeight: "600" }}>{zone.name}</ThemedText>
                              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                                {checkedCount}/{zoneItems.length} verificati
                                {restockInZone > 0 && ` - ${restockInZone} da reintegrare`}
                              </ThemedText>
                            </View>
                            <Feather 
                              name={isExpanded ? "chevron-up" : "chevron-down"} 
                              size={20} 
                              color={theme.textSecondary} 
                            />
                          </Pressable>
                          <Pressable
                            style={[
                              styles.zoneOkButton,
                              { backgroundColor: isZoneComplete ? theme.success : zone.color }
                            ]}
                            onPress={() => handleZoneTuttoOk(zone.id)}
                          >
                            <Feather 
                              name={isZoneComplete ? "check-circle" : "check"} 
                              size={20} 
                              color="#FFFFFF" 
                            />
                            <ThemedText type="small" style={{ color: "#FFFFFF", fontWeight: "700", marginLeft: 4 }}>
                              {isZoneComplete ? "OK" : "TUTTO OK"}
                            </ThemedText>
                          </Pressable>
                        </View>

                        {isExpanded && (
                          <View style={styles.zoneItems}>
                            {zoneItems.map((item, idx) => (
                              <View 
                                key={item.itemId}
                                style={styles.zoneItem}
                              >
                                <Pressable 
                                  style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
                                  onPress={() => toggleItem(item.itemId)}
                                >
                                  <View style={[
                                    styles.checkbox,
                                    {
                                      backgroundColor: item.issueType && item.issueType !== "ok" ? getIssueColor(item.issueType) : 
                                        item.checked ? theme.success : "transparent",
                                      borderColor: item.issueType && item.issueType !== "ok" ? getIssueColor(item.issueType) : 
                                        item.checked ? theme.success : theme.border,
                                    }
                                  ]}>
                                    {item.issueType === "mancante" ? <Feather name="x" size={14} color="#FFFFFF" /> :
                                     item.issueType === "quantita" ? <Feather name="minus" size={14} color="#FFFFFF" /> :
                                     item.issueType === "danneggiato" ? <Feather name="alert-triangle" size={12} color="#FFFFFF" /> :
                                     item.checked ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
                                  </View>
                                  <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                                    <ThemedText 
                                      type="small" 
                                      style={[
                                        item.checked && !item.issueType && { color: theme.textSecondary, textDecorationLine: "line-through" },
                                        item.issueType && item.issueType !== "ok" && { color: getIssueColor(item.issueType) }
                                      ]}
                                    >
                                      {item.label}
                                    </ThemedText>
                                    {item.issueType && item.issueType !== "ok" && (
                                      <View style={[styles.issueBadge, { backgroundColor: getIssueColor(item.issueType) + "20" }]}>
                                        <ThemedText type="small" style={{ color: getIssueColor(item.issueType), fontSize: 9, fontWeight: "600" }}>
                                          {getIssueLabel(item.issueType)}
                                          {item.issueType === "quantita" && item.actualQuantity !== undefined && ` (${item.actualQuantity})`}
                                        </ThemedText>
                                      </View>
                                    )}
                                  </View>
                                </Pressable>
                                {item.needsRestock && !item.checked && !item.issueType && (
                                  <View style={[styles.restockBadge, { backgroundColor: theme.warning }]}>
                                    <Feather name="refresh-cw" size={10} color="#FFFFFF" />
                                  </View>
                                )}
                                <Pressable
                                  style={[styles.issueButtonVeloce, { 
                                    backgroundColor: item.issueType && item.issueType !== "ok" ? getIssueColor(item.issueType) + "20" : theme.backgroundSecondary,
                                    borderColor: item.issueType && item.issueType !== "ok" ? getIssueColor(item.issueType) : theme.border,
                                  }]}
                                  onPress={() => openIssueModal(item)}
                                >
                                  <Feather 
                                    name={item.issueType && item.issueType !== "ok" ? "alert-circle" : "flag"} 
                                    size={14} 
                                    color={item.issueType && item.issueType !== "ok" ? getIssueColor(item.issueType) : theme.textSecondary} 
                                  />
                                </Pressable>
                              </View>
                            ))}
                          </View>
                        )}
                      </Card>
                    );
                  })}
                  </View>
                </>
              ) : (
                <View style={styles.detailedList}>
                  {AMBULANCE_ZONES.map(zone => {
                    const zoneSubZones = itemsByZoneAndSubZone[zone.id] || {};
                    const subZoneKeys = Object.keys(zoneSubZones).sort((a, b) => {
                      if (a === "_main") return -1;
                      if (b === "_main") return 1;
                      return a.localeCompare(b);
                    });
                    if (subZoneKeys.length === 0) return null;
                    
                    const totalItems = subZoneKeys.reduce((sum, key) => sum + zoneSubZones[key].length, 0);
                    const checkedItems = subZoneKeys.reduce((sum, key) => 
                      sum + zoneSubZones[key].filter(i => i.checked).length, 0);
                    
                    return (
                      <View key={zone.id} style={styles.detailedSection}>
                        <View style={[styles.detailedSectionHeader, { backgroundColor: zone.color + "15", borderRadius: BorderRadius.md, padding: Spacing.sm }]}>
                          <View style={[styles.zoneIconWrapper, { backgroundColor: zone.color + "30" }]}>
                            <Feather name={zone.icon as any} size={18} color={zone.color} />
                          </View>
                          <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                            <ThemedText type="label" style={{ color: zone.color, fontWeight: "700" }}>
                              {zone.name.toUpperCase()}
                            </ThemedText>
                            <ThemedText type="small" style={{ color: theme.textSecondary }}>
                              {checkedItems}/{totalItems} verificati
                            </ThemedText>
                          </View>
                          <Pressable
                            style={[styles.zoneOkButtonSmall, { backgroundColor: checkedItems === totalItems ? theme.success : zone.color }]}
                            onPress={() => handleZoneTuttoOk(zone.id)}
                          >
                            <Feather name={checkedItems === totalItems ? "check-circle" : "check"} size={14} color="#FFFFFF" />
                            <ThemedText type="small" style={{ color: "#FFFFFF", fontWeight: "700", marginLeft: 4 }}>
                              OK
                            </ThemedText>
                          </Pressable>
                        </View>
                        
                        {subZoneKeys.map(subZoneKey => {
                          const subZoneItems = zoneSubZones[subZoneKey];
                          const subZoneName = subZoneKey === "_main" ? null : subZoneKey;
                          
                          return (
                            <View key={subZoneKey}>
                              {subZoneName && (
                                <View style={[styles.subZoneHeader, { borderLeftColor: zone.color }]}>
                                  <Feather name="folder" size={12} color={theme.textSecondary} />
                                  <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: "600", marginLeft: 6 }}>
                                    {subZoneName}
                                  </ThemedText>
                                </View>
                              )}
                              <Card style={[styles.detailedCard, subZoneName && { marginLeft: Spacing.md }]}>
                                {subZoneItems.map((item, idx) => (
                                  <React.Fragment key={item.itemId}>
                                    <View style={styles.detailedItem}>
                                      <Pressable 
                                        style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
                                        onPress={() => toggleItem(item.itemId)}
                                      >
                                        <View style={[
                                          styles.checkbox,
                                          {
                                            backgroundColor: item.issueType && item.issueType !== "ok" ? getIssueColor(item.issueType) : 
                                              item.checked ? theme.success : "transparent",
                                            borderColor: item.issueType && item.issueType !== "ok" ? getIssueColor(item.issueType) : 
                                              item.checked ? theme.success : theme.border,
                                          }
                                        ]}>
                                          {item.issueType === "mancante" ? <Feather name="x" size={14} color="#FFFFFF" /> :
                                           item.issueType === "quantita" ? <Feather name="minus" size={14} color="#FFFFFF" /> :
                                           item.issueType === "danneggiato" ? <Feather name="alert-triangle" size={12} color="#FFFFFF" /> :
                                           item.checked ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
                                        </View>
                                        <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                                          <ThemedText 
                                            type="body" 
                                            style={[
                                              styles.detailedLabel,
                                              item.checked && !item.issueType && { color: theme.textSecondary, textDecorationLine: "line-through" },
                                              item.issueType && item.issueType !== "ok" && { color: getIssueColor(item.issueType) }
                                            ]}
                                          >
                                            {item.quantity > 1 ? `${item.quantity}x ` : ""}{item.label}
                                          </ThemedText>
                                          {item.issueType && item.issueType !== "ok" && (
                                            <View style={[styles.issueBadge, { backgroundColor: getIssueColor(item.issueType) + "20" }]}>
                                              <Feather 
                                                name={item.issueType === "mancante" ? "x-circle" : item.issueType === "quantita" ? "minus-circle" : "alert-triangle"} 
                                                size={10} 
                                                color={getIssueColor(item.issueType)} 
                                              />
                                              <ThemedText type="small" style={{ color: getIssueColor(item.issueType), fontSize: 10, fontWeight: "600" }}>
                                                {getIssueLabel(item.issueType)}
                                                {item.issueType === "quantita" && item.actualQuantity !== undefined && ` (${item.actualQuantity}/${item.quantity})`}
                                              </ThemedText>
                                            </View>
                                          )}
                                        </View>
                                      </Pressable>
                                      {item.needsRestock && !item.issueType && (
                                        <View style={[styles.restockBadge, { backgroundColor: theme.warning }]}>
                                          <Feather name="refresh-cw" size={12} color="#FFFFFF" />
                                        </View>
                                      )}
                                      <Pressable
                                        style={[styles.issueButtonDetailed, { 
                                          backgroundColor: item.issueType && item.issueType !== "ok" ? getIssueColor(item.issueType) + "20" : theme.backgroundSecondary,
                                          borderColor: item.issueType && item.issueType !== "ok" ? getIssueColor(item.issueType) : theme.border,
                                        }]}
                                        onPress={() => openIssueModal(item)}
                                      >
                                        <Feather 
                                          name={item.issueType && item.issueType !== "ok" ? "alert-circle" : "flag"} 
                                          size={16} 
                                          color={item.issueType && item.issueType !== "ok" ? getIssueColor(item.issueType) : theme.primary} 
                                        />
                                      </Pressable>
                                    </View>
                                    {idx < subZoneItems.length - 1 && (
                                      <View style={[styles.divider, { backgroundColor: theme.border }]} />
                                    )}
                                  </React.Fragment>
                                ))}
                              </Card>
                            </View>
                          );
                        })}
                      </View>
                    );
                  })}
                </View>
              )}

              <Card style={styles.anomalyCard}>
                <Pressable
                  style={styles.anomalyToggle}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setHasAnomalies(!hasAnomalies);
                  }}
                >
                  <View style={[
                    styles.checkbox,
                    {
                      backgroundColor: hasAnomalies ? theme.error : "transparent",
                      borderColor: hasAnomalies ? theme.error : theme.border,
                    }
                  ]}>
                    {hasAnomalies && <Feather name="alert-triangle" size={14} color="#FFFFFF" />}
                  </View>
                  <View style={{ flex: 1, marginLeft: Spacing.md }}>
                    <ThemedText type="body" style={{ fontWeight: "600" }}>Segnala anomalia</ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      Problemi o materiale mancante
                    </ThemedText>
                  </View>
                </Pressable>

                {hasAnomalies && (
                  <TextInput
                    style={[styles.textArea, { borderColor: theme.error, color: theme.text }]}
                    placeholder="Descrivi il problema..."
                    placeholderTextColor={theme.textSecondary}
                    value={anomalyDescription}
                    onChangeText={setAnomalyDescription}
                    multiline
                    numberOfLines={3}
                  />
                )}
              </Card>

              {editingChecklistId ? (
                <View style={styles.editButtonsRow}>
                  <Pressable
                    style={[styles.cancelButton, { borderColor: theme.error }]}
                    onPress={handleCancelEdit}
                  >
                    <Feather name="x" size={18} color={theme.error} />
                    <ThemedText type="body" style={{ color: theme.error, fontWeight: "600", marginLeft: 4 }}>
                      Annulla
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    style={[styles.submitButton, { backgroundColor: theme.success, flex: 1, opacity: updateMutation.isPending ? 0.6 : 1 }]}
                    onPress={handleSubmit}
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Feather name="save" size={18} color="#FFFFFF" />
                        <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600", marginLeft: 4 }}>
                          Salva
                        </ThemedText>
                      </>
                    )}
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  style={[
                    styles.submitButton,
                    { backgroundColor: (isComplete || hasAnomalies) && signatureName.trim() ? theme.success : theme.border,
                      opacity: submitMutation.isPending ? 0.6 : 1 }
                  ]}
                  onPress={handleSubmit}
                  disabled={submitMutation.isPending || (!isComplete && !hasAnomalies) || !signatureName.trim()}
                >
                  {submitMutation.isPending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Feather name="check-circle" size={20} color="#FFFFFF" />
                      <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "700", marginLeft: Spacing.sm }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                        CONFERMA CHECKLIST
                      </ThemedText>
                    </>
                  )}
                </Pressable>
              )}
            </>
          ) : (
            <Card style={styles.summaryCard}>
              <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>
                Riepilogo Checklist Odierna
              </ThemedText>
              {todayChecklist.hasAnomalies && (
                <View style={[styles.anomalyBanner, { backgroundColor: theme.errorLight }]}>
                  <Feather name="alert-triangle" size={16} color={theme.error} />
                  <ThemedText type="body" style={{ color: theme.error, marginLeft: Spacing.sm, flex: 1 }}>
                    {todayChecklist.anomalyDescription}
                  </ThemedText>
                </View>
              )}
              <View style={styles.summaryZones}>
                {AMBULANCE_ZONES.map(zone => {
                  const items = (todayChecklist.items as ChecklistItemState[]).filter(i => 
                    getZoneForCategory(i.category) === zone.id
                  );
                  if (items.length === 0) return null;
                  const checked = items.filter(i => i.checked).length;
                  return (
                    <View key={zone.id} style={styles.summaryZoneRow}>
                      <View style={[styles.zoneIconSmall, { backgroundColor: zone.color + "20" }]}>
                        <Feather name={zone.icon as any} size={14} color={zone.color} />
                      </View>
                      <ThemedText type="small" style={{ flex: 1 }}>{zone.name}</ThemedText>
                      <ThemedText type="small" style={{ color: checked === items.length ? theme.success : theme.error }}>
                        {checked}/{items.length}
                      </ThemedText>
                    </View>
                  );
                })}
              </View>
            </Card>
          )}
        </ScrollView>
      )}

      {viewMode === "history" && (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{
            paddingTop: Spacing.lg,
            paddingBottom: tabBarHeight + Spacing.xl,
            paddingHorizontal: Spacing.lg,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={loadingHistory} onRefresh={onRefresh} />}
        >
          <ThemedText type="h3" style={{ marginBottom: Spacing.lg }}>Storico Checklist</ThemedText>

          {historyChecklists.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Feather name="inbox" size={48} color={theme.textSecondary} />
              <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
                Nessuna checklist registrata
              </ThemedText>
            </Card>
          ) : (
            historyChecklists.map(checklist => {
              const isExpanded = expandedChecklistId === checklist.id;
              const items = (checklist.items || []) as ChecklistItemState[];
              const completedAt = checklist.completedAt ? new Date(checklist.completedAt) : null;
              const now = new Date();
              const twelveHoursMs = 12 * 60 * 60 * 1000;
              const isEditable = completedAt ? (now.getTime() - completedAt.getTime()) < twelveHoursMs : false;

              return (
                <Card 
                  key={checklist.id} 
                  style={styles.historyCard}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setExpandedChecklistId(isExpanded ? null : checklist.id);
                  }}
                >
                  <View style={styles.historyHeader}>
                    <View style={{ flex: 1 }}>
                      <ThemedText type="body" style={{ fontWeight: "600" }}>
                        {formatDate(checklist.shiftDate)}
                      </ThemedText>
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>
                        Firmata da {checklist.submittedByName}
                      </ThemedText>
                    </View>
                    {checklist.hasAnomalies ? (
                      <View style={[styles.badge, { backgroundColor: theme.error }]}>
                        <Feather name="alert-triangle" size={12} color="#FFFFFF" />
                      </View>
                    ) : (
                      <View style={[styles.badge, { backgroundColor: theme.success }]}>
                        <Feather name="check" size={12} color="#FFFFFF" />
                      </View>
                    )}
                    <Feather 
                      name={isExpanded ? "chevron-up" : "chevron-down"} 
                      size={20} 
                      color={theme.textSecondary} 
                      style={{ marginLeft: Spacing.sm }}
                    />
                  </View>

                  {isExpanded && (
                    <View style={styles.expandedDetails}>
                      <View style={[styles.divider, { backgroundColor: theme.border, marginVertical: Spacing.md, marginLeft: 0 }]} />
                      
                      {isEditable && (
                        <Pressable
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            setEditingChecklistId(checklist.id);
                            setChecklistState(items);
                            setHasAnomalies(checklist.hasAnomalies || false);
                            setAnomalyDescription(checklist.anomalyDescription || "");
                            setGeneralNotes(checklist.generalNotes || "");
                            setViewMode("detailed");
                          }}
                          style={[styles.editBanner, { backgroundColor: theme.primary + "20" }]}
                        >
                          <Feather name="edit-2" size={14} color={theme.primary} />
                          <ThemedText type="small" style={{ color: theme.primary, marginLeft: Spacing.xs }}>
                            Modifica
                          </ThemedText>
                        </Pressable>
                      )}

                      {AMBULANCE_ZONES.map(zone => {
                        const zoneItems = items.filter(i => getZoneForCategory(i.category) === zone.id);
                        if (zoneItems.length === 0) return null;
                        const checkedCount = zoneItems.filter(i => i.checked).length;

                        return (
                          <View key={zone.id} style={styles.historyZone}>
                            <View style={styles.historyZoneHeader}>
                              <View style={[styles.zoneIconSmall, { backgroundColor: zone.color + "20" }]}>
                                <Feather name={zone.icon as any} size={12} color={zone.color} />
                              </View>
                              <ThemedText type="small" style={{ fontWeight: "600", color: zone.color }}>
                                {zone.name}
                              </ThemedText>
                              <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: "auto" }}>
                                {checkedCount}/{zoneItems.length}
                              </ThemedText>
                            </View>
                          </View>
                        );
                      })}

                      {checklist.hasAnomalies && checklist.anomalyDescription && (
                        <View style={[styles.anomalyBanner, { backgroundColor: theme.errorLight, marginTop: Spacing.sm }]}>
                          <Feather name="alert-triangle" size={14} color={theme.error} style={{ marginTop: 2 }} />
                          <ThemedText type="small" style={{ color: theme.error, marginLeft: Spacing.sm, flex: 1 }}>
                            {checklist.anomalyDescription}
                          </ThemedText>
                        </View>
                      )}
                    </View>
                  )}
                </Card>
              );
            })
          )}
        </ScrollView>
      )}

      <Modal
        visible={issueModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIssueModalVisible(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Pressable style={{ flex: 1 }} onPress={() => setIssueModalVisible(false)} />
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="h3">Segnala Problema</ThemedText>
              <Pressable onPress={() => setIssueModalVisible(false)}>
                <Feather name="x" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>
            
            {selectedItemForIssue && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={[styles.modalItemInfo, { backgroundColor: theme.backgroundSecondary }]}>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>
                    {selectedItemForIssue.label}
                  </ThemedText>
                  {selectedItemForIssue.quantity > 1 && (
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      Quantita prevista: {selectedItemForIssue.quantity}
                    </ThemedText>
                  )}
                </View>

                <View style={styles.issueOptions}>
                  <Pressable
                    style={[styles.issueOption, { borderColor: theme.success }]}
                    onPress={() => handleSetIssue("ok")}
                  >
                    <View style={[styles.issueOptionIcon, { backgroundColor: theme.successLight }]}>
                      <Feather name="check" size={20} color={theme.success} />
                    </View>
                    <ThemedText type="body" style={{ color: theme.success, fontWeight: "600" }}>
                      Tutto OK
                    </ThemedText>
                  </Pressable>

                  <Pressable
                    style={[styles.issueOption, { borderColor: "#EF4444" }]}
                    onPress={() => handleSetIssue("mancante")}
                  >
                    <View style={[styles.issueOptionIcon, { backgroundColor: "#EF444420" }]}>
                      <Feather name="x-circle" size={20} color="#EF4444" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText type="body" style={{ color: "#EF4444", fontWeight: "600" }}>
                        Mancante
                      </ThemedText>
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>
                        L'articolo non e presente
                      </ThemedText>
                    </View>
                  </Pressable>

                  <View style={[styles.issueOption, { borderColor: "#F59E0B" }]}>
                    <View style={[styles.issueOptionIcon, { backgroundColor: "#F59E0B20" }]}>
                      <Feather name="minus-circle" size={20} color="#F59E0B" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText type="body" style={{ color: "#F59E0B", fontWeight: "600" }}>
                        Quantita Insufficiente
                      </ThemedText>
                      <View style={styles.quantityInputRow}>
                        <ThemedText type="small" style={{ color: theme.textSecondary }}>
                          Presente:
                        </ThemedText>
                        <TextInput
                          style={[styles.quantityInput, { borderColor: "#F59E0B", color: theme.text }]}
                          value={tempActualQuantity}
                          onChangeText={setTempActualQuantity}
                          keyboardType="number-pad"
                          placeholder="0"
                          placeholderTextColor={theme.textSecondary}
                        />
                        <Pressable
                          style={[styles.quantityConfirmButton, { backgroundColor: "#F59E0B" }]}
                          onPress={() => handleSetIssue("quantita")}
                        >
                          <Feather name="check" size={16} color="#FFFFFF" />
                        </Pressable>
                      </View>
                    </View>
                  </View>

                  <Pressable
                    style={[styles.issueOption, { borderColor: "#8B5CF6" }]}
                    onPress={() => handleSetIssue("danneggiato")}
                  >
                    <View style={[styles.issueOptionIcon, { backgroundColor: "#8B5CF620" }]}>
                      <Feather name="alert-triangle" size={20} color="#8B5CF6" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText type="body" style={{ color: "#8B5CF6", fontWeight: "600" }}>
                        Danneggiato
                      </ThemedText>
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>
                        L'articolo e presente ma non utilizzabile
                      </ThemedText>
                    </View>
                  </Pressable>
                </View>
                <View style={{ height: Spacing.lg }} />
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  centerContent: { flex: 1, justifyContent: "center", alignItems: "center", padding: Spacing.xl },
  tabBar: {
    flexDirection: "row",
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xs,
    gap: Spacing.xs,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  headerCard: { marginBottom: Spacing.md },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.md },
  vehicleIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  headerInfo: { marginLeft: Spacing.md, flex: 1 },
  templateTypeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  statsRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.md },
  statBox: { flex: 1, padding: Spacing.md, borderRadius: BorderRadius.md, alignItems: "center" },
  completeBanner: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.md },
  signatureContainer: { marginTop: Spacing.xs },
  signatureBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
  },
  signatureInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: 14,
    paddingVertical: Spacing.xs,
  },
  globalOkButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  restockCard: {
    marginBottom: Spacing.md,
    borderWidth: 1,
    padding: Spacing.md,
  },
  restockHeader: { flexDirection: "row", alignItems: "center" },
  showRestockButton: { 
    paddingHorizontal: Spacing.sm, 
    paddingVertical: Spacing.xs, 
    borderRadius: BorderRadius.sm,
    marginLeft: "auto",
  },
  zonesGrid: { gap: Spacing.sm },
  zoneCard: { marginBottom: Spacing.xs, padding: Spacing.sm },
  zoneHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  zoneInfo: { flex: 1, flexDirection: "row", alignItems: "center" },
  zoneIconWrapper: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  zoneOkButton: { 
    flexDirection: "row", 
    alignItems: "center", 
    paddingHorizontal: Spacing.md, 
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  zoneOkButtonSmall: { 
    flexDirection: "row", 
    alignItems: "center", 
    paddingHorizontal: Spacing.sm, 
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  subZoneHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: Spacing.md,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.sm,
    borderLeftWidth: 3,
    marginLeft: Spacing.xs,
  },
  zoneItems: { marginTop: Spacing.sm, paddingLeft: Spacing.md },
  zoneItem: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.sm },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  restockBadge: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  detailedList: { gap: Spacing.md },
  detailedSection: { marginBottom: Spacing.sm },
  detailedSectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.sm },
  detailedCard: { padding: 0, overflow: "hidden" },
  detailedItem: { flexDirection: "row", alignItems: "center", padding: Spacing.md },
  detailedLabel: { flex: 1, marginLeft: Spacing.md },
  divider: { height: 1, marginLeft: 46 },
  anomalyCard: { marginVertical: Spacing.md },
  anomalyToggle: { flexDirection: "row", alignItems: "center" },
  textArea: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    minHeight: 80,
    textAlignVertical: "top",
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.sm,
  },
  editButtonsRow: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.md },
  cancelButton: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "center", 
    padding: Spacing.lg, 
    borderRadius: BorderRadius.lg, 
    borderWidth: 2,
  },
  summaryCard: { marginTop: Spacing.lg },
  anomalyBanner: { flexDirection: "row", alignItems: "flex-start", padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.md },
  summaryZones: { gap: Spacing.sm },
  summaryZoneRow: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.xs },
  zoneIconSmall: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", marginRight: Spacing.sm },
  emptyCard: { alignItems: "center", padding: Spacing.xl },
  historyCard: { marginBottom: Spacing.md },
  historyHeader: { flexDirection: "row", alignItems: "center" },
  badge: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  expandedDetails: { marginTop: Spacing.sm },
  editBanner: { 
    flexDirection: "row", 
    alignItems: "center", 
    padding: Spacing.sm, 
    borderRadius: BorderRadius.md, 
    marginBottom: Spacing.md,
    alignSelf: "flex-start",
  },
  historyZone: { marginBottom: Spacing.xs },
  historyZoneHeader: { flexDirection: "row", alignItems: "center" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  modalItemInfo: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  issueOptions: {
    gap: Spacing.md,
  },
  issueOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    gap: Spacing.md,
  },
  issueOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  quantityInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  quantityInput: {
    width: 60,
    height: 36,
    borderWidth: 2,
    borderRadius: BorderRadius.md,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
  },
  quantityConfirmButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  issueButtonVeloce: {
    padding: Spacing.xs,
    borderRadius: BorderRadius.md,
    marginLeft: Spacing.xs,
    borderWidth: 1,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  issueButtonDetailed: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginLeft: Spacing.sm,
    borderWidth: 1,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  issueBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
});
