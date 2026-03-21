import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { 
  View, 
  Modal, 
  StyleSheet, 
  Pressable, 
  FlatList,
  TextInput as RNTextInput,
  Platform,
  Alert,
  ActivityIndicator,
  Keyboard
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ExpoLocation from "expo-location";
import * as Linking from "expo-linking";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import { useFavorites, FavoriteLocation } from "@/hooks/useFavorites";

interface AddressSuggestion {
  displayName: string;
  address: {
    road?: string;
    house_number?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    postcode?: string;
  };
  lat: string;
  lon: string;
  distanceKm?: number;
}

const LOCATION_CATEGORIES = [
  { value: "ospedale", label: "Ospedale", icon: "activity", description: "Strutture ospedaliere" },
  { value: "casa_di_riposo", label: "Casa di Riposo", icon: "heart", description: "CDR e strutture assistenziali" },
  { value: "sede", label: "Sede", icon: "home", description: "Sedi Operative" },
  { value: "domicilio", label: "Domicilio", icon: "map-pin", description: "Abitazione del paziente" },
];

interface Structure {
  id: string;
  name: string;
  address: string | null;
  type: string;
  phoneNumber?: string | null;
  accessCode?: string | null;
}

interface Department {
  id: string;
  name: string;
}

interface Location {
  id: string;
  name: string;
  address: string | null;
}

interface LocationPickerModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  locationType: string;
  structureId: string;
  departmentId: string;
  address: string;
  structures: Structure[];
  departments: Department[];
  locations: Location[];
  onSelectType: (type: string) => void;
  onSelectStructure: (id: string) => void;
  onSelectDepartment: (id: string) => void;
  onChangeAddress: (address: string) => void;
  onConfirm: () => void;
  onAddCustomStructure?: (name: string, address: string, type: string) => Promise<string | null>;
  onAddCustomDepartment?: (name: string) => Promise<string | null>;
  skipCategoryStep?: boolean;
}

type Step = "category" | "hospital_list" | "hospital_department" | "nursing_home_list" | "sede_list" | "domicilio_input" | "altro_input" | "manual_hospital" | "manual_department" | "manual_nursing_home";

export function LocationPickerModal({
  visible,
  onClose,
  title,
  locationType,
  structureId,
  departmentId,
  address,
  structures,
  departments,
  locations,
  onSelectType,
  onSelectStructure,
  onSelectDepartment,
  onChangeAddress,
  onConfirm,
  onAddCustomStructure,
  onAddCustomDepartment,
  skipCategoryStep = false,
}: LocationPickerModalProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { favorites, isFavorite, toggleFavorite, getFavoritesByType } = useFavorites();
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentSearchQuery, setDepartmentSearchQuery] = useState("");
  const [step, setStep] = useState<Step>("category");
  const [manualName, setManualName] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [domicilioQuery, setDomicilioQuery] = useState("");
  const autocompleteTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      if (autocompleteTimeoutRef.current) {
        clearTimeout(autocompleteTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const getUserLocation = async () => {
      try {
        const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const location = await ExpoLocation.getCurrentPositionAsync({
            accuracy: ExpoLocation.Accuracy.Balanced,
          });
          setUserLocation({
            lat: location.coords.latitude,
            lon: location.coords.longitude,
          });
        }
      } catch (error) {
        console.log("Could not get user location:", error);
      }
    };
    getUserLocation();
  }, []);

  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }, []);

  const fetchAddressSuggestions = useCallback(async (query: string) => {
    if (query.length < 3) {
      setAddressSuggestions([]);
      return;
    }

    const currentRequestId = ++requestIdRef.current;
    setIsLoadingSuggestions(true);
    
    try {
      const apiUrl = getApiUrl();
      const url = new URL("/api/address-autocomplete", apiUrl);
      url.searchParams.set("q", query);
      if (userLocation) {
        url.searchParams.set("lat", userLocation.lat.toString());
        url.searchParams.set("lon", userLocation.lon.toString());
      }

      const response = await fetch(url.toString());
      
      if (currentRequestId !== requestIdRef.current) {
        return;
      }
      
      if (response.ok) {
        const data: AddressSuggestion[] = await response.json();
        const suggestionsWithDistance = data.map((suggestion) => {
          if (userLocation && suggestion.lat && suggestion.lon) {
            const distanceKm = calculateDistance(
              userLocation.lat,
              userLocation.lon,
              parseFloat(suggestion.lat),
              parseFloat(suggestion.lon)
            );
            return { ...suggestion, distanceKm };
          }
          return suggestion;
        });
        setAddressSuggestions(suggestionsWithDistance);
      } else {
        setAddressSuggestions([]);
      }
    } catch (error) {
      if (currentRequestId === requestIdRef.current) {
        console.error("Address autocomplete error:", error);
        setAddressSuggestions([]);
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setIsLoadingSuggestions(false);
      }
    }
  }, [userLocation, calculateDistance]);

  const handleDomicilioQueryChange = useCallback((text: string) => {
    const upperText = text.toUpperCase();
    setDomicilioQuery(upperText);
    setAddressSuggestions([]);
    
    if (autocompleteTimeoutRef.current) {
      clearTimeout(autocompleteTimeoutRef.current);
    }
    
    if (upperText.length >= 3) {
      setIsLoadingSuggestions(true);
      autocompleteTimeoutRef.current = setTimeout(() => {
        fetchAddressSuggestions(upperText);
      }, 120);
    } else {
      setIsLoadingSuggestions(false);
    }
  }, [fetchAddressSuggestions]);

  const formatAddressForDisplay = useCallback((suggestion: AddressSuggestion): { street: string; city: string } => {
    const addr = suggestion.address;
    const street = addr.road || "";
    const city = addr.city || addr.town || addr.village || addr.municipality || "";
    const county = addr.county || addr.state || "";
    
    const provinceMap: Record<string, string> = {
      "agrigento": "AG", "alessandria": "AL", "ancona": "AN", "aosta": "AO", "arezzo": "AR",
      "ascoli piceno": "AP", "asti": "AT", "avellino": "AV", "bari": "BA", "barletta-andria-trani": "BT",
      "belluno": "BL", "benevento": "BN", "bergamo": "BG", "biella": "BI", "bologna": "BO",
      "bolzano": "BZ", "brescia": "BS", "brindisi": "BR", "cagliari": "CA", "caltanissetta": "CL",
      "campobasso": "CB", "caserta": "CE", "catania": "CT", "catanzaro": "CZ", "chieti": "CH",
      "como": "CO", "cosenza": "CS", "cremona": "CR", "crotone": "KR", "cuneo": "CN",
      "enna": "EN", "fermo": "FM", "ferrara": "FE", "firenze": "FI", "florence": "FI", "foggia": "FG",
      "forli-cesena": "FC", "forlì-cesena": "FC", "frosinone": "FR", "genova": "GE", "genoa": "GE",
      "gorizia": "GO", "grosseto": "GR", "imperia": "IM", "isernia": "IS", "la spezia": "SP",
      "l'aquila": "AQ", "latina": "LT", "lecce": "LE", "lecco": "LC", "livorno": "LI",
      "lodi": "LO", "lucca": "LU", "macerata": "MC", "mantova": "MN", "massa-carrara": "MS",
      "matera": "MT", "messina": "ME", "milano": "MI", "milan": "MI", "modena": "MO", "monza e brianza": "MB",
      "napoli": "NA", "naples": "NA", "novara": "NO", "nuoro": "NU", "oristano": "OR", "padova": "PD",
      "palermo": "PA", "parma": "PR", "pavia": "PV", "perugia": "PG", "pesaro e urbino": "PU",
      "pescara": "PE", "piacenza": "PC", "pisa": "PI", "pistoia": "PT", "pordenone": "PN",
      "potenza": "PZ", "prato": "PO", "ragusa": "RG", "ravenna": "RA", "reggio calabria": "RC",
      "reggio emilia": "RE", "rieti": "RI", "rimini": "RN", "roma": "RM", "rome": "RM", "rovigo": "RO",
      "salerno": "SA", "sassari": "SS", "savona": "SV", "siena": "SI", "siracusa": "SR",
      "sondrio": "SO", "sud sardegna": "SU", "taranto": "TA", "teramo": "TE", "terni": "TR",
      "torino": "TO", "turin": "TO", "trapani": "TP", "trento": "TN", "treviso": "TV", "trieste": "TS",
      "udine": "UD", "varese": "VA", "venezia": "VE", "venice": "VE", "verbano-cusio-ossola": "VB",
      "vercelli": "VC", "verona": "VR", "vibo valentia": "VV", "vicenza": "VI", "viterbo": "VT"
    };
    
    const countyLower = county.toLowerCase().trim();
    const provinceCode = provinceMap[countyLower] || "";
    
    return {
      street: street.toUpperCase(),
      city: provinceCode ? `${city.toUpperCase()}, ${provinceCode}` : city.toUpperCase(),
    };
  }, []);

  const handleSelectSuggestion = useCallback(async (suggestion: AddressSuggestion) => {
    Keyboard.dismiss();
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    const formatted = formatAddressForDisplay(suggestion);
    const fullAddress = formatted.street 
      ? `${formatted.street}, ${formatted.city}`
      : formatted.city;
    
    onChangeAddress(fullAddress);
    setDomicilioQuery(fullAddress);
    setAddressSuggestions([]);
  }, [formatAddressForDisplay, onChangeAddress]);

  useEffect(() => {
    if (visible) {
      if (locationType === "ospedale" && structureId) {
        setStep("hospital_department");
      } else if (locationType === "ospedale") {
        setStep("hospital_list");
      } else if (locationType === "casa_di_riposo" && structureId) {
        setStep("nursing_home_list");
      } else if (locationType === "casa_di_riposo") {
        setStep("nursing_home_list");
      } else if (locationType === "sede") {
        setStep("sede_list");
      } else if (locationType === "domicilio") {
        setStep("domicilio_input");
      } else if (locationType === "altro") {
        setStep("altro_input");
      } else {
        setStep("category");
      }
    } else {
      setStep("category");
      setSearchQuery("");
      setDepartmentSearchQuery("");
      setManualName("");
      setManualAddress("");
    }
  }, [visible, locationType, structureId]);

  const hospitalFavorites = useMemo(() => 
    getFavoritesByType("ospedale").filter(f => f.type === "structure"),
    [favorites, getFavoritesByType]
  );

  const nursingHomeFavorites = useMemo(() => 
    getFavoritesByType("casa_di_riposo").filter(f => f.type === "structure"),
    [favorites, getFavoritesByType]
  );

  const domicilioFavorites = useMemo(() => 
    getFavoritesByType("domicilio").filter(f => f.type === "address"),
    [favorites, getFavoritesByType]
  );

  const hospitals = useMemo(() => {
    let filtered = structures.filter(s => s.type === "ospedale");
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(query) ||
        (s.address && s.address.toLowerCase().includes(query))
      );
    }
    const favoriteIds = hospitalFavorites.map(f => f.structureId);
    filtered.sort((a, b) => {
      const aFav = favoriteIds.includes(a.id);
      const bFav = favoriteIds.includes(b.id);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return a.name.localeCompare(b.name);
    });
    return filtered;
  }, [structures, searchQuery, hospitalFavorites]);

  const nursingHomes = useMemo(() => {
    let filtered = structures.filter(s => s.type === "casa_di_riposo");
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(query) ||
        (s.address && s.address.toLowerCase().includes(query))
      );
    }
    const favoriteIds = nursingHomeFavorites.map(f => f.structureId);
    filtered.sort((a, b) => {
      const aFav = favoriteIds.includes(a.id);
      const bFav = favoriteIds.includes(b.id);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return a.name.localeCompare(b.name);
    });
    return filtered;
  }, [structures, searchQuery, nursingHomeFavorites]);

  const filteredDepartments = useMemo(() => {
    if (!departmentSearchQuery.trim()) {
      return [...departments].sort((a, b) => a.name.localeCompare(b.name));
    }
    const query = departmentSearchQuery.toLowerCase();
    return departments
      .filter(d => d.name.toLowerCase().includes(query))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [departments, departmentSearchQuery]);

  const handleToggleFavorite = useCallback(async (params: {
    type: "structure" | "address";
    locationType: string;
    structureId?: string;
    structureName?: string;
    departmentId?: string;
    departmentName?: string;
    address?: string;
    displayName: string;
  }) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    await toggleFavorite(params);
  }, [toggleFavorite]);

  const selectedStructure = structures.find(s => s.id === structureId);
  const selectedLocation = locations.find(l => l.id === structureId);

  const stripCivicNumber = (addr: string | null): string | null => {
    if (!addr) return null;
    return addr.replace(/,?\s*\d+[a-zA-Z]?\s*(,|$)/g, '$1').replace(/\s+,/g, ',').trim();
  };

  const handleCategorySelect = (category: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onSelectType(category);
    onSelectStructure("");
    onSelectDepartment("");
    onChangeAddress("");
    
    switch (category) {
      case "ospedale":
        setStep("hospital_list");
        break;
      case "casa_di_riposo":
        setStep("nursing_home_list");
        break;
      case "sede":
        setStep("sede_list");
        break;
      case "domicilio":
        setStep("domicilio_input");
        break;
      case "altro":
        setStep("altro_input");
        break;
    }
    setSearchQuery("");
  };

  const handleHospitalSelect = (id: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onSelectStructure(id);
    onSelectDepartment("");
    setStep("hospital_department");
    setSearchQuery("");
  };

  const handleNursingHomeSelect = (id: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onSelectStructure(id);
    setSearchQuery("");
  };

  const handleSedeSelect = (id: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onSelectStructure(id);
  };

  const handleDepartmentSelect = (id: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onSelectDepartment(id);
  };

  const handleConfirmAndClose = () => {
    if (locationType === "ospedale" && structureId && !departmentId) {
      Alert.alert("Errore", "La selezione del reparto è obbligatoria");
      return;
    }
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    onConfirm();
    onClose();
    setStep("category");
    setSearchQuery("");
    setManualName("");
    setManualAddress("");
  };

  const handleBack = () => {
    if (step === "manual_department") {
      setStep("hospital_department");
      setManualName("");
    } else if (step === "manual_hospital") {
      setStep("hospital_list");
      setManualName("");
      setManualAddress("");
    } else if (step === "hospital_department") {
      setStep("hospital_list");
      onSelectStructure("");
      onSelectDepartment("");
      setDepartmentSearchQuery("");
    } else if (step === "hospital_list") {
      if (skipCategoryStep) {
        onClose();
      } else {
        setStep("category");
      }
      onSelectStructure("");
      onSelectDepartment("");
    } else if (step === "manual_nursing_home") {
      setStep("nursing_home_list");
      setManualName("");
      setManualAddress("");
    } else if (step === "nursing_home_list") {
      if (skipCategoryStep) {
        onClose();
      } else {
        setStep("category");
      }
      onSelectStructure("");
    } else if (step === "sede_list") {
      if (skipCategoryStep) {
        onClose();
      } else {
        setStep("category");
      }
      onSelectStructure("");
    } else if (step === "domicilio_input" || step === "altro_input") {
      if (skipCategoryStep) {
        onClose();
      } else {
        setStep("category");
      }
      onChangeAddress("");
    } else {
      setStep("category");
    }
    setSearchQuery("");
  };

  const handleOpenManualHospital = () => {
    setManualName("");
    setManualAddress("");
    setStep("manual_hospital");
  };

  const handleOpenManualDepartment = () => {
    setManualName("");
    setStep("manual_department");
  };

  const handleSaveManualHospital = async () => {
    if (!manualName.trim()) {
      Alert.alert("Errore", "Inserisci il nome dell'ospedale");
      return;
    }
    if (onAddCustomStructure) {
      const newId = await onAddCustomStructure(manualName.trim(), manualAddress.trim(), "ospedale");
      if (newId) {
        onSelectStructure(newId);
        setStep("hospital_department");
      }
    }
    setManualName("");
    setManualAddress("");
  };

  const handleSaveManualDepartment = async () => {
    if (!manualName.trim()) {
      Alert.alert("Errore", "Inserisci il nome del reparto");
      return;
    }
    if (onAddCustomDepartment) {
      const newId = await onAddCustomDepartment(manualName.trim());
      if (newId) {
        onSelectDepartment(newId);
      }
    }
    setManualName("");
    setStep("hospital_department");
  };

  const handleOpenManualNursingHome = () => {
    setManualName("");
    setManualAddress("");
    setStep("manual_nursing_home");
  };

  const handleSaveManualNursingHome = async () => {
    if (!manualName.trim()) {
      Alert.alert("Errore", "Inserisci il nome della casa di riposo");
      return;
    }
    if (!manualAddress.trim()) {
      Alert.alert("Errore", "Inserisci l'indirizzo della casa di riposo");
      return;
    }
    if (onAddCustomStructure) {
      const newId = await onAddCustomStructure(manualName.trim(), manualAddress.trim(), "casa_di_riposo");
      if (newId) {
        onSelectStructure(newId);
        setStep("nursing_home_list");
      }
    }
    setManualName("");
    setManualAddress("");
  };

  const canConfirm = () => {
    switch (locationType) {
      case "ospedale":
        return !!structureId;
      case "casa_di_riposo":
        return !!structureId;
      case "sede":
        return !!structureId;
      case "domicilio":
      case "altro":
        return !!address.trim();
      default:
        return false;
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case "category": return title;
      case "hospital_list": return "Seleziona Ospedale";
      case "hospital_department": return "Seleziona Reparto";
      case "nursing_home_list": return "Seleziona Casa di Riposo";
      case "sede_list": return "Seleziona Sede";
      case "domicilio_input": return "Inserisci Domicilio";
      case "altro_input": return "Inserisci Indirizzo";
      case "manual_hospital": return "Aggiungi Ospedale";
      case "manual_department": return "Aggiungi Reparto";
      case "manual_nursing_home": return "Aggiungi Casa di Riposo";
      default: return title;
    }
  };

  const renderCategorySelection = () => (
    <View style={styles.categoryGrid}>
      {LOCATION_CATEGORIES.map((cat) => {
        const isSelected = locationType === cat.value;
        return (
          <Pressable
            key={cat.value}
            style={[
              styles.categoryCard,
              { 
                backgroundColor: isSelected ? theme.primaryLight : theme.cardBackground,
                borderColor: isSelected ? theme.primary : theme.border,
              }
            ]}
            onPress={() => handleCategorySelect(cat.value)}
          >
            <View style={[
              styles.categoryIcon,
              { backgroundColor: isSelected ? theme.primary : theme.backgroundSecondary }
            ]}>
              <Feather 
                name={cat.icon as any} 
                size={28} 
                color={isSelected ? "#FFFFFF" : theme.textSecondary} 
              />
            </View>
            <ThemedText 
              type="body" 
              style={{ 
                fontWeight: "600",
                color: isSelected ? theme.primary : theme.text,
                textAlign: "center",
                marginTop: Spacing.sm,
              }}
            >
              {cat.label}
            </ThemedText>
            <ThemedText 
              type="small" 
              style={{ 
                color: theme.textSecondary,
                textAlign: "center",
                marginTop: 4,
              }}
            >
              {cat.description}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );

  const renderHospitalList = () => (
    <View style={{ flex: 1 }}>
      <View style={[styles.searchContainer, { backgroundColor: theme.cardBackground }]}>
        <Feather name="search" size={18} color={theme.textSecondary} />
        <RNTextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Cerca ospedale..."
          placeholderTextColor={theme.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
        />
        {searchQuery ? (
          <Pressable onPress={() => setSearchQuery("")}>
            <Feather name="x" size={18} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      <Pressable 
        style={[styles.addManualButton, { borderColor: theme.primary }]}
        onPress={handleOpenManualHospital}
      >
        <Feather name="plus-circle" size={18} color={theme.primary} />
        <ThemedText type="body" style={{ color: theme.primary, marginLeft: Spacing.sm }}>
          Aggiungi Ospedale Manualmente
        </ThemedText>
      </Pressable>
      
      <FlatList
        data={hospitals}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: Spacing.xl }}
        renderItem={({ item }) => {
          const isSelected = item.id === structureId;
          const isFav = isFavorite({ type: "structure", locationType: "ospedale", structureId: item.id });
          return (
            <Pressable
              style={[
                styles.listItem,
                { backgroundColor: isSelected ? theme.primaryLight : "transparent" }
              ]}
              onPress={() => handleHospitalSelect(item.id)}
            >
              <Pressable
                style={styles.favoriteButton}
                onPress={(e) => {
                  e.stopPropagation();
                  handleToggleFavorite({
                    type: "structure",
                    locationType: "ospedale",
                    structureId: item.id,
                    structureName: item.name,
                    displayName: item.name,
                  });
                }}
              >
                <Feather 
                  name={isFav ? "star" : "star"} 
                  size={18} 
                  color={isFav ? "#F59E0B" : theme.textSecondary} 
                  style={{ opacity: isFav ? 1 : 0.4 }}
                />
              </Pressable>
              <View style={{ flex: 1 }}>
                <ThemedText 
                  type="body" 
                  style={{ 
                    fontWeight: "500",
                    color: isSelected ? theme.primary : theme.text 
                  }}
                >
                  {item.name}
                </ThemedText>
                {item.address ? (
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    {stripCivicNumber(item.address)}
                  </ThemedText>
                ) : null}
              </View>
              <Feather name="chevron-right" size={20} color={theme.textSecondary} />
            </Pressable>
          );
        }}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Feather name="search" size={32} color={theme.textSecondary} />
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
              Nessun ospedale trovato
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
              Puoi aggiungerne uno manualmente
            </ThemedText>
          </View>
        )}
      />
    </View>
  );

  const renderHospitalDepartment = () => (
    <View style={{ flex: 1 }}>
      {selectedStructure ? (
        <View style={[styles.selectedCard, { backgroundColor: theme.successLight }]}>
          <Feather name="check-circle" size={20} color={theme.success} />
          <View style={{ flex: 1, marginLeft: Spacing.sm }}>
            <ThemedText type="body" style={{ fontWeight: "600", color: theme.success }}>
              {selectedStructure.name}
            </ThemedText>
            {selectedStructure.address ? (
              <ThemedText type="small" style={{ color: theme.success }}>
                {selectedStructure.address}
              </ThemedText>
            ) : null}
          </View>
          <Pressable onPress={() => { setStep("hospital_list"); onSelectStructure(""); }}>
            <ThemedText type="small" style={{ color: theme.primary }}>Cambia</ThemedText>
          </Pressable>
        </View>
      ) : null}
      
      <ThemedText type="h3" style={styles.sectionTitle}>
        Seleziona Reparto
      </ThemedText>
      <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
        Se il reparto è ad esempio geriatria a, seleziona solo geriatria e non aggiungere un altro reparto
      </ThemedText>

      <View style={[styles.searchContainer, { backgroundColor: theme.cardBackground }]}>
        <Feather name="search" size={18} color={theme.textSecondary} />
        <RNTextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Cerca reparto..."
          placeholderTextColor={theme.textSecondary}
          value={departmentSearchQuery}
          onChangeText={setDepartmentSearchQuery}
          autoCapitalize="none"
        />
        {departmentSearchQuery ? (
          <Pressable onPress={() => setDepartmentSearchQuery("")}>
            <Feather name="x" size={18} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      <Pressable 
        style={[styles.addManualButton, { borderColor: theme.primary }]}
        onPress={handleOpenManualDepartment}
      >
        <Feather name="plus-circle" size={18} color={theme.primary} />
        <ThemedText type="body" style={{ color: theme.primary, marginLeft: Spacing.sm }}>
          Aggiungi Reparto Manualmente
        </ThemedText>
      </Pressable>
      
      <FlatList
        data={filteredDepartments}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        initialNumToRender={100}
        maxToRenderPerBatch={100}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: Spacing.xl }}
        renderItem={({ item }) => {
          const isSelected = item.id === departmentId;
          return (
            <Pressable
              style={[
                styles.listItem,
                { backgroundColor: isSelected ? theme.primaryLight : "transparent" }
              ]}
              onPress={() => handleDepartmentSelect(item.id)}
            >
              <ThemedText 
                type="body" 
                style={{ color: isSelected ? theme.primary : theme.text }}
              >
                {item.name}
              </ThemedText>
              {isSelected ? (
                <Feather name="check" size={20} color={theme.primary} />
              ) : null}
            </Pressable>
          );
        }}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Feather name="folder" size={32} color={theme.textSecondary} />
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
              Nessun reparto trovato
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
              Puoi aggiungerne uno manualmente
            </ThemedText>
          </View>
        )}
      />
    </View>
  );

  const formatCDRAddress = useCallback((address: string | null): string | null => {
    if (!address) return null;
    const stripped = stripCivicNumber(address);
    if (!stripped) return null;
    
    const provinceMap: Record<string, string> = {
      "agrigento": "AG", "alessandria": "AL", "ancona": "AN", "aosta": "AO", "arezzo": "AR",
      "ascoli piceno": "AP", "asti": "AT", "avellino": "AV", "bari": "BA", "barletta-andria-trani": "BT",
      "belluno": "BL", "benevento": "BN", "bergamo": "BG", "biella": "BI", "bologna": "BO",
      "bolzano": "BZ", "brescia": "BS", "brindisi": "BR", "cagliari": "CA", "caltanissetta": "CL",
      "campobasso": "CB", "caserta": "CE", "catania": "CT", "catanzaro": "CZ", "chieti": "CH",
      "como": "CO", "cosenza": "CS", "cremona": "CR", "crotone": "KR", "cuneo": "CN",
      "enna": "EN", "fermo": "FM", "ferrara": "FE", "firenze": "FI", "florence": "FI", "foggia": "FG",
      "forli-cesena": "FC", "forlì-cesena": "FC", "frosinone": "FR", "genova": "GE", "genoa": "GE",
      "gorizia": "GO", "grosseto": "GR", "imperia": "IM", "isernia": "IS", "la spezia": "SP",
      "l'aquila": "AQ", "latina": "LT", "lecce": "LE", "lecco": "LC", "livorno": "LI",
      "lodi": "LO", "lucca": "LU", "macerata": "MC", "mantova": "MN", "massa-carrara": "MS",
      "matera": "MT", "messina": "ME", "milano": "MI", "milan": "MI", "modena": "MO", "monza e brianza": "MB",
      "napoli": "NA", "naples": "NA", "novara": "NO", "nuoro": "NU", "oristano": "OR", "padova": "PD",
      "palermo": "PA", "parma": "PR", "pavia": "PV", "perugia": "PG", "pesaro e urbino": "PU",
      "pescara": "PE", "piacenza": "PC", "pisa": "PI", "pistoia": "PT", "pordenone": "PN",
      "potenza": "PZ", "prato": "PO", "ragusa": "RG", "ravenna": "RA", "reggio calabria": "RC",
      "reggio emilia": "RE", "rieti": "RI", "rimini": "RN", "roma": "RM", "rome": "RM", "rovigo": "RO",
      "salerno": "SA", "sassari": "SS", "savona": "SV", "siena": "SI", "siracusa": "SR",
      "sondrio": "SO", "sud sardegna": "SU", "taranto": "TA", "teramo": "TE", "terni": "TR",
      "torino": "TO", "turin": "TO", "trapani": "TP", "trento": "TN", "treviso": "TV", "trieste": "TS",
      "udine": "UD", "varese": "VA", "venezia": "VE", "venice": "VE", "verbano-cusio-ossola": "VB",
      "vercelli": "VC", "verona": "VR", "vibo valentia": "VV", "vicenza": "VI", "viterbo": "VT"
    };
    
    const upperAddress = stripped.toUpperCase();
    for (const [city, code] of Object.entries(provinceMap)) {
      if (upperAddress.toLowerCase().includes(city)) {
        if (!upperAddress.includes(`(${code})`)) {
          return `${upperAddress} (${code})`;
        }
        return upperAddress;
      }
    }
    return upperAddress;
  }, []);

  const renderNursingHomeList = () => (
    <View style={{ flex: 1 }}>
      <View style={[styles.searchContainer, { backgroundColor: theme.cardBackground }]}>
        <Feather name="search" size={18} color={theme.textSecondary} />
        <RNTextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Cerca casa di riposo..."
          placeholderTextColor={theme.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
        />
        {searchQuery ? (
          <Pressable onPress={() => setSearchQuery("")}>
            <Feather name="x" size={18} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      <Pressable 
        style={[styles.addManualButton, { borderColor: theme.primary }]}
        onPress={handleOpenManualNursingHome}
      >
        <Feather name="plus-circle" size={18} color={theme.primary} />
        <ThemedText type="body" style={{ color: theme.primary, marginLeft: Spacing.sm }}>
          Aggiungi CDR Manualmente
        </ThemedText>
      </Pressable>
      
      <FlatList
        data={nursingHomes}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: Spacing.xl }}
        renderItem={({ item }) => {
          const isSelected = item.id === structureId;
          const displayAddress = formatCDRAddress(item.address);
          const isFav = isFavorite({ type: "structure", locationType: "casa_di_riposo", structureId: item.id });
          return (
            <Pressable
              style={[
                styles.listItem,
                { backgroundColor: isSelected ? theme.primaryLight : "transparent" }
              ]}
              onPress={() => handleNursingHomeSelect(item.id)}
            >
              <Pressable
                style={styles.favoriteButton}
                onPress={(e) => {
                  e.stopPropagation();
                  handleToggleFavorite({
                    type: "structure",
                    locationType: "casa_di_riposo",
                    structureId: item.id,
                    structureName: item.name,
                    displayName: item.name,
                  });
                }}
              >
                <Feather 
                  name="star" 
                  size={18} 
                  color={isFav ? "#F59E0B" : theme.textSecondary} 
                  style={{ opacity: isFav ? 1 : 0.4 }}
                />
              </Pressable>
              <View style={{ flex: 1 }}>
                <ThemedText 
                  type="body" 
                  style={{ 
                    fontWeight: "500",
                    color: isSelected ? theme.primary : theme.text 
                  }}
                >
                  {item.name}
                </ThemedText>
                {displayAddress ? (
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    {displayAddress}
                  </ThemedText>
                ) : null}
                <View style={{ flexDirection: 'row', marginTop: 4, gap: 8, flexWrap: 'wrap' }}>
                  {item.phoneNumber ? (
                    <Pressable
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                      onPress={(e) => {
                        e.stopPropagation();
                        if (Platform.OS !== 'web') {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          Linking.openURL(`tel:${item.phoneNumber}`);
                        }
                      }}
                    >
                      <Feather name="phone" size={12} color={theme.primary} />
                      <ThemedText type="small" style={{ color: theme.primary }}>
                        {item.phoneNumber}
                      </ThemedText>
                    </Pressable>
                  ) : null}
                  {item.accessCode ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Feather name="key" size={12} color={theme.warning} />
                      <ThemedText type="small" style={{ color: theme.warning }}>
                        {item.accessCode}
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
              </View>
              {isSelected ? (
                <Feather name="check" size={20} color={theme.primary} />
              ) : null}
            </Pressable>
          );
        }}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Feather name="heart" size={32} color={theme.textSecondary} />
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
              Nessuna casa di riposo trovata
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
              Puoi aggiungerne una manualmente
            </ThemedText>
          </View>
        )}
      />
    </View>
  );

  const renderSedeList = () => (
    <View style={{ flex: 1 }}>
      <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg }}>
        Seleziona una delle sedi operative
      </ThemedText>
      
      <FlatList
        data={locations}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: Spacing.xl }}
        renderItem={({ item }) => {
          const isSelected = item.id === structureId;
          return (
            <Pressable
              style={[
                styles.sedeCard,
                { 
                  backgroundColor: isSelected ? theme.primaryLight : theme.cardBackground,
                  borderColor: isSelected ? theme.primary : theme.border,
                }
              ]}
              onPress={() => handleSedeSelect(item.id)}
            >
              <View style={[
                styles.sedeIcon,
                { backgroundColor: isSelected ? theme.primary : theme.backgroundSecondary }
              ]}>
                <Feather name="home" size={24} color={isSelected ? "#FFFFFF" : theme.textSecondary} />
              </View>
              <View style={{ flex: 1, marginLeft: Spacing.md }}>
                <ThemedText 
                  type="body" 
                  style={{ 
                    fontWeight: "600",
                    color: isSelected ? theme.primary : theme.text 
                  }}
                >
                  {item.name}
                </ThemedText>
                {item.address ? (
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    {item.address}
                  </ThemedText>
                ) : null}
              </View>
              {isSelected ? (
                <Feather name="check-circle" size={24} color={theme.primary} />
              ) : null}
            </Pressable>
          );
        }}
      />
    </View>
  );

  const renderDomicilioInput = () => (
    <View style={{ flex: 1 }}>
      <View style={[styles.searchContainer, { backgroundColor: theme.cardBackground }]}>
        <Feather name="search" size={18} color={theme.textSecondary} />
        <RNTextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Via Roma, Verona..."
          placeholderTextColor={theme.textSecondary}
          value={domicilioQuery || address}
          onChangeText={handleDomicilioQueryChange}
          autoCapitalize="characters"
        />
        {(domicilioQuery || address) ? (
          <Pressable onPress={() => {
            setDomicilioQuery("");
            onChangeAddress("");
            setAddressSuggestions([]);
          }}>
            <Feather name="x" size={18} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      {isLoadingSuggestions ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.primary} />
          <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.sm }}>
            Ricerca in corso...
          </ThemedText>
        </View>
      ) : null}

      {addressSuggestions.length > 0 ? (
        <FlatList
          data={addressSuggestions}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item, index) => `${item.lat}-${item.lon}-${index}`}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: Spacing.xl }}
          renderItem={({ item }) => {
            const formatted = formatAddressForDisplay(item);
            return (
              <Pressable
                style={[styles.suggestionItem, { borderBottomColor: theme.border }]}
                onPress={() => handleSelectSuggestion(item)}
              >
                <View style={styles.suggestionLeft}>
                  {item.distanceKm !== undefined ? (
                    <View style={styles.distanceBadge}>
                      <Feather name="clock" size={14} color={theme.textSecondary} />
                      <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 2 }}>
                        {item.distanceKm} km
                      </ThemedText>
                    </View>
                  ) : (
                    <View style={styles.distanceBadge}>
                      <Feather name="map-pin" size={14} color={theme.textSecondary} />
                    </View>
                  )}
                </View>
                <View style={styles.suggestionContent}>
                  <ThemedText type="body" style={{ fontWeight: "500" }}>
                    {formatted.street || formatted.city.split(",")[0]}
                  </ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    {formatted.city}
                  </ThemedText>
                </View>
                <Feather name="arrow-up-left" size={18} color={theme.textSecondary} />
              </Pressable>
            );
          }}
        />
      ) : domicilioQuery.length >= 3 && !isLoadingSuggestions && !address ? (
        <View style={styles.emptyContainer}>
          <Feather name="map-pin" size={32} color={theme.textSecondary} />
          <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
            Nessun indirizzo trovato
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
            Prova con un indirizzo diverso
          </ThemedText>
        </View>
      ) : address ? (
        <View style={styles.emptyContainer}>
          <Feather name="check-circle" size={32} color={theme.success} />
          <ThemedText type="body" style={{ color: theme.text, marginTop: Spacing.md, fontWeight: "600" }}>
            Indirizzo selezionato
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs, textAlign: "center" }}>
            Premi Conferma per continuare
          </ThemedText>
        </View>
      ) : !domicilioQuery ? (
        <View style={styles.emptyContainer}>
          <Feather name="search" size={32} color={theme.textSecondary} />
          <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
            Cerca un indirizzo
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs, textAlign: "center" }}>
            Digita via e città per vedere i suggerimenti
          </ThemedText>
        </View>
      ) : null}

      {address ? (
        <View style={[styles.selectedCard, { backgroundColor: theme.successLight, marginTop: Spacing.md }]}>
          <Feather name="check-circle" size={20} color={theme.success} />
          <View style={{ flex: 1, marginLeft: Spacing.sm }}>
            <ThemedText type="small" style={{ color: theme.success }}>Indirizzo selezionato:</ThemedText>
            <ThemedText type="body" style={{ fontWeight: "600", color: theme.success }}>
              {address}
            </ThemedText>
          </View>
        </View>
      ) : null}
    </View>
  );

  const renderAltroInput = () => (
    <View style={styles.addressContainer}>
      <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
        Inserisci l'indirizzo o la descrizione della destinazione
      </ThemedText>
      
      <View style={[styles.addressInputContainer, { backgroundColor: theme.cardBackground }]}>
        <Feather name="map" size={20} color={theme.primary} style={{ marginRight: Spacing.sm }} />
        <RNTextInput
          style={[styles.addressInput, { color: theme.text }]}
          placeholder="Indirizzo o descrizione..."
          placeholderTextColor={theme.textSecondary}
          value={address}
          onChangeText={onChangeAddress}
          multiline
        />
      </View>
    </View>
  );

  const renderManualHospitalForm = () => (
    <View style={styles.manualFormContainer}>
      <View style={[styles.manualInputContainer, { backgroundColor: theme.cardBackground }]}>
        <ThemedText type="small" style={[styles.inputLabel, { color: theme.textSecondary }]}>
          Nome Ospedale
        </ThemedText>
        <RNTextInput
          style={[styles.manualInput, { color: theme.text }]}
          placeholder="Es: Ospedale San Giovanni"
          placeholderTextColor={theme.textSecondary}
          value={manualName}
          onChangeText={setManualName}
        />
      </View>

      <View style={[styles.manualInputContainer, { backgroundColor: theme.cardBackground, marginTop: Spacing.md }]}>
        <ThemedText type="small" style={[styles.inputLabel, { color: theme.textSecondary }]}>
          Indirizzo (opzionale)
        </ThemedText>
        <RNTextInput
          style={[styles.manualInput, { color: theme.text }]}
          placeholder="Es: Via Roma 15, Verona"
          placeholderTextColor={theme.textSecondary}
          value={manualAddress}
          onChangeText={setManualAddress}
        />
      </View>

      <Pressable
        style={[styles.saveManualButton, { backgroundColor: theme.primary }]}
        onPress={handleSaveManualHospital}
      >
        <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
          Salva e Continua
        </ThemedText>
      </Pressable>
    </View>
  );

  const renderManualDepartmentForm = () => (
    <View style={styles.manualFormContainer}>
      {selectedStructure ? (
        <View style={[styles.selectedCard, { backgroundColor: theme.successLight, marginBottom: Spacing.lg }]}>
          <Feather name="check-circle" size={20} color={theme.success} />
          <View style={{ flex: 1, marginLeft: Spacing.sm }}>
            <ThemedText type="body" style={{ fontWeight: "600", color: theme.success }}>
              {selectedStructure.name}
            </ThemedText>
          </View>
        </View>
      ) : null}

      <View style={[styles.manualInputContainer, { backgroundColor: theme.cardBackground }]}>
        <ThemedText type="small" style={[styles.inputLabel, { color: theme.textSecondary }]}>
          Nome Reparto
        </ThemedText>
        <RNTextInput
          style={[styles.manualInput, { color: theme.text }]}
          placeholder="Es: Cardiologia, Pronto Soccorso"
          placeholderTextColor={theme.textSecondary}
          value={manualName}
          onChangeText={setManualName}
        />
      </View>

      <Pressable
        style={[styles.saveManualButton, { backgroundColor: theme.primary }]}
        onPress={handleSaveManualDepartment}
      >
        <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
          Salva Reparto
        </ThemedText>
      </Pressable>
    </View>
  );

  const renderManualNursingHomeForm = () => (
    <View style={styles.manualFormContainer}>
      <View style={[styles.manualInputContainer, { backgroundColor: theme.cardBackground }]}>
        <ThemedText type="small" style={[styles.inputLabel, { color: theme.textSecondary }]}>
          Nome Struttura
        </ThemedText>
        <RNTextInput
          style={[styles.manualInput, { color: theme.text }]}
          placeholder="RSA Villa Serena"
          placeholderTextColor={theme.textSecondary}
          value={manualName}
          onChangeText={setManualName}
        />
      </View>

      <View style={[styles.manualInputContainer, { backgroundColor: theme.cardBackground, marginTop: Spacing.md }]}>
        <ThemedText type="small" style={[styles.inputLabel, { color: theme.textSecondary }]}>
          Indirizzo completo
        </ThemedText>
        <RNTextInput
          style={[styles.manualInput, { color: theme.text }]}
          placeholder="VIA GARIBALDI 10, LEGNAGO (VR)"
          placeholderTextColor={theme.textSecondary}
          value={manualAddress}
          onChangeText={(text) => setManualAddress(text.toUpperCase())}
          autoCapitalize="characters"
        />
      </View>

      <Pressable
        style={[styles.saveManualButton, { backgroundColor: theme.primary }]}
        onPress={handleSaveManualNursingHome}
      >
        <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
          Salva Casa di Riposo
        </ThemedText>
      </Pressable>
    </View>
  );

  const showConfirmButton = canConfirm() && 
    step !== "manual_hospital" && 
    step !== "manual_department" &&
    step !== "manual_nursing_home" &&
    step !== "category";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
          <View style={styles.headerRow}>
            {step !== "category" ? (
              <Pressable onPress={handleBack} style={styles.backButton}>
                <Feather name="arrow-left" size={24} color={theme.text} />
              </Pressable>
            ) : null}
            <ThemedText type="h3" style={{ flex: 1 }}>{getStepTitle()}</ThemedText>
            <Pressable onPress={onClose}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>
        </View>

        <View style={{ flex: 1, paddingHorizontal: Spacing.lg }}>
          {step === "category" ? renderCategorySelection() : null}
          {step === "hospital_list" ? renderHospitalList() : null}
          {step === "hospital_department" ? renderHospitalDepartment() : null}
          {step === "nursing_home_list" ? renderNursingHomeList() : null}
          {step === "sede_list" ? renderSedeList() : null}
          {step === "domicilio_input" ? renderDomicilioInput() : null}
          {step === "altro_input" ? renderAltroInput() : null}
          {step === "manual_hospital" ? renderManualHospitalForm() : null}
          {step === "manual_department" ? renderManualDepartmentForm() : null}
          {step === "manual_nursing_home" ? renderManualNursingHomeForm() : null}
        </View>

        {showConfirmButton ? (
          <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
            <Pressable
              style={[styles.confirmButton, { backgroundColor: theme.primary }]}
              onPress={handleConfirmAndClose}
            >
              <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                Conferma
              </ThemedText>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    marginRight: Spacing.md,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingTop: Spacing.lg,
  },
  categoryCard: {
    width: "48%",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    marginBottom: Spacing.md,
    borderWidth: 2,
  },
  categoryIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: 16,
  },
  addManualButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    marginBottom: Spacing.md,
  },
  listItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
  },
  favoriteButton: {
    padding: Spacing.xs,
    marginRight: Spacing.sm,
  },
  selectedCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  sedeCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    borderWidth: 2,
  },
  sedeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  addressContainer: {
    flex: 1,
    paddingTop: Spacing.lg,
  },
  addressInputContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  addressInput: {
    flex: 1,
    fontSize: 16,
    minHeight: 60,
    textAlignVertical: "top",
  },
  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: Spacing.sm,
  },
  manualFormContainer: {
    flex: 1,
    paddingTop: Spacing.lg,
  },
  manualInputContainer: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  inputLabel: {
    marginBottom: Spacing.xs,
  },
  manualInput: {
    fontSize: 16,
    paddingVertical: Spacing.sm,
  },
  saveManualButton: {
    height: 48,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.xl,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["3xl"],
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  confirmButton: {
    height: 48,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  suggestionLeft: {
    width: 60,
    alignItems: "center",
  },
  distanceBadge: {
    alignItems: "center",
  },
  suggestionContent: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
});
