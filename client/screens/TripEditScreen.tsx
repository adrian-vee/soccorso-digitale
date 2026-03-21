import React, { useState, useEffect } from "react";
import { 
  View, 
  StyleSheet, 
  Alert, 
  ActivityIndicator, 
  Pressable,
  Modal,
  Switch,
  Platform
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { TextInput } from "@/components/TextInput";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/query-client";
import { Spacing, BorderRadius } from "@/constants/theme";
import { LocationPickerModal } from "@/components/LocationPickerModal";
import type { TripsStackParamList } from "@/navigation/TripsStackNavigator";

const LOCATION_TYPES = [
  { value: "ospedale", label: "Ospedale" },
  { value: "domicilio", label: "Domicilio" },
  { value: "casa_di_riposo", label: "Casa di Riposo" },
  { value: "sede", label: "Sede" },
  { value: "altro", label: "Altro" },
];

const LOCATION_TABS = [
  { value: "ospedale", label: "Ospedale", icon: "activity" },
  { value: "casa_di_riposo", label: "CDR", icon: "heart" },
  { value: "sede", label: "Sede", icon: "home" },
  { value: "domicilio", label: "Domicilio", icon: "map-pin" },
];

function LocationTypeTabs({ 
  selectedType, 
  onSelectType 
}: { 
  selectedType: string; 
  onSelectType: (type: string) => void;
}) {
  const { theme } = useTheme();
  
  return (
    <View style={styles.locationTabs}>
      {LOCATION_TABS.map((tab) => {
        const isSelected = selectedType === tab.value;
        return (
          <Pressable
            key={tab.value}
            style={[
              styles.locationTab,
              { 
                backgroundColor: isSelected ? theme.primary : theme.cardBackground,
                borderColor: isSelected ? theme.primary : theme.border,
              }
            ]}
            onPress={() => {
              if (Platform.OS !== "web") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              onSelectType(tab.value);
            }}
          >
            <Feather 
              name={tab.icon as any} 
              size={14} 
              color={isSelected ? "#FFFFFF" : theme.textSecondary} 
            />
            <ThemedText 
              type="small" 
              style={{ 
                color: isSelected ? "#FFFFFF" : theme.textSecondary,
                marginLeft: 4,
                fontWeight: isSelected ? "600" : "400",
              }}
            >
              {tab.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

interface Structure {
  id: string;
  name: string;
  address: string | null;
  type: string;
}

interface Location {
  id: string;
  name: string;
  address: string | null;
}

interface Department {
  id: string;
  name: string;
}

interface TripWaypoint {
  id: string;
  waypointOrder: number;
  waypointType: string;
  locationType: string;
  structureName: string | null;
  structureAddress: string | null;
  departmentName: string | null;
  address: string | null;
}

interface TripData {
  id: string;
  progressiveNumber: string;
  vehicleId: string;
  userId: string;
  serviceDate: string;
  departureTime: string | null;
  returnTime: string | null;
  patientBirthYear: number | null;
  patientGender: string | null;
  originType: string;
  originStructureId: string | null;
  originDepartmentId: string | null;
  originAddress: string | null;
  destinationType: string;
  destinationStructureId: string | null;
  destinationDepartmentId: string | null;
  destinationAddress: string | null;
  kmInitial: number;
  kmFinal: number;
  kmTraveled: number;
  durationMinutes: number | null;
  isReturnTrip: boolean;
  notes: string | null;
  isEmergencyService?: boolean;
  locationName?: string | null;
  waypoints?: TripWaypoint[];
}

function SectionHeader({ icon, title }: { icon: string; title: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionIcon, { backgroundColor: theme.primaryLight }]}>
        <Feather name={icon as any} size={16} color={theme.primary} />
      </View>
      <ThemedText type="h3" style={styles.sectionTitle}>{title}</ThemedText>
    </View>
  );
}

function SelectButton({ 
  label, 
  value, 
  placeholder, 
  onPress, 
  icon 
}: { 
  label: string;
  value: string | null;
  placeholder: string;
  onPress: () => void;
  icon: string;
}) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={() => {
        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPress();
      }}
    >
      <View style={[styles.selectButtonCard, { backgroundColor: theme.cardBackground }]}>
        <View style={[styles.selectButtonIcon, { backgroundColor: theme.primaryLight }]}>
          <Feather name={icon as any} size={18} color={theme.primary} />
        </View>
        <View style={styles.selectButtonContent}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>{label}</ThemedText>
          <ThemedText type="body" style={{ fontWeight: "500" }} numberOfLines={1}>
            {value || placeholder}
          </ThemedText>
        </View>
        <Feather name="chevron-right" size={20} color={theme.textSecondary} />
      </View>
    </Pressable>
  );
}

type TripEditRouteProp = RouteProp<TripsStackParamList, "TripEdit">;
type TripEditNavigationProp = NativeStackNavigationProp<TripsStackParamList, "TripEdit">;

export default function TripEditScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const selectedVehicle = user?.vehicle || null;
  const queryClient = useQueryClient();
  const navigation = useNavigation<TripEditNavigationProp>();
  const route = useRoute<TripEditRouteProp>();
  const { tripId } = route.params;

  const [isLoading, setIsLoading] = useState(true);
  const [serviceNumber, setServiceNumber] = useState("");
  const [isReturnTrip, setIsReturnTrip] = useState(false);
  const [crewType, setCrewType] = useState("autista_soccorritore");
  const [serviceDate, setServiceDate] = useState(new Date());
  const [departureTime, setDepartureTime] = useState<Date | null>(null);
  const [returnTime, setReturnTime] = useState<Date | null>(null);
  const [patientBirthYear, setPatientBirthYear] = useState("");
  const [patientGender, setPatientGender] = useState("");
  
  const [originType, setOriginType] = useState("ospedale");
  const [originStructureId, setOriginStructureId] = useState("");
  const [originDepartmentId, setOriginDepartmentId] = useState("");
  const [originAddress, setOriginAddress] = useState("");
  
  const [destinationType, setDestinationType] = useState("ospedale");
  const [destinationStructureId, setDestinationStructureId] = useState("");
  const [destinationDepartmentId, setDestinationDepartmentId] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");
  
  const [kmInitial, setKmInitial] = useState("");
  const [kmFinal, setKmFinal] = useState("");
  const [notes, setNotes] = useState("");

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDepartureTimePicker, setShowDepartureTimePicker] = useState(false);
  const [showReturnTimePicker, setShowReturnTimePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());
  const [tempDepartureTime, setTempDepartureTime] = useState(new Date());
  const [tempReturnTime, setTempReturnTime] = useState(new Date());
  const [showOriginPicker, setShowOriginPicker] = useState(false);
  const [showDestPicker, setShowDestPicker] = useState(false);
  const [showGenderPicker, setShowGenderPicker] = useState(false);

  const { data: trip } = useQuery<TripData>({
    queryKey: [`/api/trips/${tripId}`],
  });

  const { data: structures } = useQuery<Structure[]>({
    queryKey: ["/api/structures"],
  });

  const { data: departments } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const { data: locations } = useQuery<Location[]>({
    queryKey: ["/api/locations"],
  });

  useEffect(() => {
    if (trip) {
      setServiceNumber(trip.progressiveNumber);
      setIsReturnTrip(trip.isReturnTrip);
      setCrewType((trip as any).crewType || "autista_soccorritore");
      setServiceDate(new Date(trip.serviceDate));
      if (trip.departureTime) {
        const [h, m] = trip.departureTime.split(":");
        const dt = new Date();
        dt.setHours(parseInt(h), parseInt(m));
        setDepartureTime(dt);
      }
      if (trip.returnTime) {
        const [h, m] = trip.returnTime.split(":");
        const rt = new Date();
        rt.setHours(parseInt(h), parseInt(m));
        setReturnTime(rt);
      }
      setPatientBirthYear(trip.patientBirthYear?.toString() || "");
      setPatientGender(trip.patientGender || "");
      setOriginType(trip.originType);
      setOriginStructureId(trip.originStructureId || "");
      setOriginDepartmentId(trip.originDepartmentId || "");
      setOriginAddress(trip.originAddress || "");
      setDestinationType(trip.destinationType);
      setDestinationStructureId(trip.destinationStructureId || "");
      setDestinationDepartmentId(trip.destinationDepartmentId || "");
      setDestinationAddress(trip.destinationAddress || "");
      setKmInitial(trip.kmInitial.toString());
      setKmFinal(trip.kmFinal.toString());
      setNotes(trip.notes || "");
      setIsLoading(false);
    }
  }, [trip]);

  const kmTraveled = kmFinal && kmInitial 
    ? Math.max(0, parseInt(kmFinal) - parseInt(kmInitial))
    : 0;

  const formatDateItalian = (date: Date) => {
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatTimeItalian = (date: Date) => {
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const calculateDuration = () => {
    if (!departureTime || !returnTime) return null;
    const depMinutes = departureTime.getHours() * 60 + departureTime.getMinutes();
    let retMinutes = returnTime.getHours() * 60 + returnTime.getMinutes();
    
    // Handle midnight crossover: if return time appears earlier than departure,
    // it means the service crossed midnight (e.g., 23:30 -> 00:25)
    if (retMinutes < depMinutes) {
      retMinutes += 24 * 60; // Add 24 hours (1440 minutes)
    }
    
    return Math.max(0, retMinutes - depMinutes);
  };

  const duration = calculateDuration();

  const updateTripMutation = useMutation({
    mutationFn: async (tripData: any) => {
      const response = await apiRequest("PUT", `/api/trips/${tripId}`, tripData);
      return response.json();
    },
    onSuccess: () => {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && (
            key.startsWith("/api/trips") || 
            key.startsWith("/api/heartbeat") ||
            key.startsWith("/api/dashboard")
          );
        }
      });
      Alert.alert("Successo", "Viaggio aggiornato con successo!", [
        { text: "OK", onPress: () => navigation.goBack() }
      ]);
    },
    onError: (error: any) => {
      Alert.alert("Errore", error.message || "Errore durante l'aggiornamento");
    },
  });

  const handleSubmit = () => {
    if (!isReturnTrip && !serviceNumber.trim()) {
      Alert.alert("Errore", "Inserisci il numero del servizio");
      return;
    }

    if (!kmInitial || !kmFinal) {
      Alert.alert("Errore", "Inserisci i chilometri iniziali e finali");
      return;
    }

    if (parseInt(kmFinal) < parseInt(kmInitial)) {
      Alert.alert("Errore", "I km finali devono essere maggiori dei km iniziali");
      return;
    }

    const tripData = {
      progressiveNumber: serviceNumber.trim(),
      serviceDate: serviceDate.toISOString().split("T")[0],
      departureTime: departureTime ? formatTimeItalian(departureTime) : null,
      returnTime: returnTime ? formatTimeItalian(returnTime) : null,
      patientBirthYear: patientBirthYear ? parseInt(patientBirthYear) : null,
      patientGender: patientGender || null,
      originType,
      originStructureId: originStructureId || null,
      originDepartmentId: originDepartmentId || null,
      originAddress: originType === "sede"
        ? (locations?.find(l => l.id === originStructureId)?.address || originAddress || null)
        : (originAddress || null),
      destinationType,
      destinationStructureId: destinationStructureId || null,
      destinationDepartmentId: destinationDepartmentId || null,
      destinationAddress: destinationType === "sede"
        ? (locations?.find(l => l.id === destinationStructureId)?.address || destinationAddress || null)
        : (destinationAddress || null),
      kmInitial: parseInt(kmInitial),
      kmFinal: parseInt(kmFinal),
      kmTraveled,
      durationMinutes: duration,
      isReturnTrip,
      crewType,
      notes: notes || null,
    };

    updateTripMutation.mutate(tripData);
  };

  const getStructureName = (id: string) => {
    const structure = structures?.find(s => s.id === id);
    return structure?.name || null;
  };

  const getDepartmentName = (id: string) => {
    const dept = departments?.find(d => d.id === id);
    return dept?.name || null;
  };

  const getTypeName = (type: string) => {
    return LOCATION_TYPES.find(t => t.value === type)?.label || type;
  };

  const getLocationDisplayText = (type: string, structureId: string, departmentId: string, address: string) => {
    const typeName = getTypeName(type);
    if (type === "ospedale" || type === "casa_di_riposo") {
      const structureName = getStructureName(structureId);
      const deptName = getDepartmentName(departmentId);
      if (structureName) {
        return deptName ? `${structureName} - ${deptName}` : structureName;
      }
      return `${typeName}: Seleziona...`;
    } else if (type === "domicilio" || type === "altro") {
      return address ? `${typeName}: ${address}` : `${typeName}: Inserisci indirizzo...`;
    } else if (type === "sede") {
      return "Sede Operativa";
    }
    return "Seleziona...";
  };

  const getOriginDisplayText = () => {
    if (!originType) return null;
    const typeName = getTypeName(originType);
    if (originType === "ospedale" || originType === "casa_di_riposo") {
      const structName = getStructureName(originStructureId);
      const deptName = getDepartmentName(originDepartmentId);
      if (structName && deptName) return `${structName} - ${deptName}`;
      if (structName) return structName;
      return typeName;
    }
    if (originType === "sede") {
      // For sede, the location ID is stored in originStructureId (from handleSedeSelect)
      // or fall back to trip.locationName from the vehicle's location
      const sedeName = locations?.find(l => l.id === originStructureId)?.name 
        || trip?.locationName;
      return sedeName ? `Sede ${sedeName}` : typeName;
    }
    if (originAddress) return originAddress;
    return typeName;
  };

  const getDestDisplayText = () => {
    if (!destinationType) return null;
    const typeName = getTypeName(destinationType);
    if (destinationType === "ospedale" || destinationType === "casa_di_riposo") {
      const structName = getStructureName(destinationStructureId);
      const deptName = getDepartmentName(destinationDepartmentId);
      if (structName && deptName) return `${structName} - ${deptName}`;
      if (structName) return structName;
      return typeName;
    }
    if (destinationType === "sede") {
      // For sede, the location ID is stored in destinationStructureId (from handleSedeSelect)
      // or fall back to trip.locationName from the vehicle's location
      const sedeName = locations?.find(l => l.id === destinationStructureId)?.name
        || trip?.locationName;
      return sedeName ? `Sede ${sedeName}` : typeName;
    }
    if (destinationAddress) return destinationAddress;
    return typeName;
  };

  const handleAddCustomStructure = async (name: string, address: string, type: string): Promise<string | null> => {
    try {
      const response = await apiRequest("POST", "/api/structures", { name, address, type });
      if (response.status === 401 || response.status === 403) {
        Alert.alert("Errore", "Non sei autorizzato. Effettua il login.");
        return null;
      }
      const result = await response.json();
      if (!response.ok) {
        Alert.alert("Errore", result.error || "Errore durante il salvataggio");
        return null;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/structures"] });
      return result.id;
    } catch (error: any) {
      Alert.alert("Errore", error.message || "Errore durante il salvataggio");
      return null;
    }
  };

  const handleAddCustomDepartment = async (name: string): Promise<string | null> => {
    try {
      const response = await apiRequest("POST", "/api/departments", { name });
      if (response.status === 401 || response.status === 403) {
        Alert.alert("Errore", "Non sei autorizzato. Effettua il login.");
        return null;
      }
      const result = await response.json();
      if (!response.ok) {
        Alert.alert("Errore", result.error || "Errore durante il salvataggio");
        return null;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      return result.id;
    } catch (error: any) {
      Alert.alert("Errore", error.message || "Errore durante il salvataggio");
      return null;
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      <Pressable
        style={[styles.returnTripCard, { 
          backgroundColor: isReturnTrip ? theme.primaryLight : theme.cardBackground,
          borderColor: isReturnTrip ? theme.primary : "transparent"
        }]}
        onPress={() => {
          if (Platform.OS !== "web") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          setIsReturnTrip(!isReturnTrip);
        }}
      >
        <View style={styles.returnTripContent}>
          <View style={[styles.returnTripIcon, { backgroundColor: isReturnTrip ? theme.primary : theme.backgroundSecondary }]}>
            <Feather name="rotate-ccw" size={18} color={isReturnTrip ? "#FFFFFF" : theme.textSecondary} />
          </View>
          <View style={styles.returnTripText}>
            <ThemedText type="body" style={{ fontWeight: "600" }}>Viaggio di Rientro</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Senza paziente a bordo
            </ThemedText>
          </View>
        </View>
        <Switch
          value={isReturnTrip}
          onValueChange={(value) => {
            if (Platform.OS !== "web") {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            setIsReturnTrip(value);
          }}
          trackColor={{ false: theme.border, true: theme.primary }}
          thumbColor="#FFFFFF"
        />
      </Pressable>

      {!isReturnTrip ? (
        <View style={styles.section}>
          <SectionHeader icon="hash" title="Numero Servizio" />
          <TextInput
            label="Numero del Servizio"
            placeholder="Es. ABC123"
            value={serviceNumber}
            onChangeText={setServiceNumber}
            autoCapitalize="characters"
          />
        </View>
      ) : null}

      {/* Crew Type Selector */}
      <View style={styles.section}>
        <SectionHeader icon="users" title="Equipaggio" />
        <View style={styles.crewTypeContainer}>
          <Pressable
            style={[
              styles.crewTypeButton,
              { 
                backgroundColor: crewType === "autista_soccorritore" ? theme.primaryLight : theme.cardBackground,
                borderColor: crewType === "autista_soccorritore" ? theme.primary : theme.border,
              }
            ]}
            onPress={() => {
              if (Platform.OS !== "web") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              setCrewType("autista_soccorritore");
            }}
          >
            <Feather 
              name="user" 
              size={18} 
              color={crewType === "autista_soccorritore" ? theme.primary : theme.textSecondary} 
            />
            <ThemedText 
              style={{ 
                marginLeft: 8,
                color: crewType === "autista_soccorritore" ? theme.primary : theme.text,
                fontWeight: crewType === "autista_soccorritore" ? "600" : "400",
              }}
            >
              Autista + Soccorritore
            </ThemedText>
            {crewType === "autista_soccorritore" && (
              <Feather name="check" size={16} color={theme.primary} style={{ marginLeft: "auto" }} />
            )}
          </Pressable>
          
          <Pressable
            style={[
              styles.crewTypeButton,
              { 
                backgroundColor: crewType === "autista_infermiere" ? theme.primaryLight : theme.cardBackground,
                borderColor: crewType === "autista_infermiere" ? theme.primary : theme.border,
              }
            ]}
            onPress={() => {
              if (Platform.OS !== "web") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              setCrewType("autista_infermiere");
            }}
          >
            <Feather 
              name="heart" 
              size={18} 
              color={crewType === "autista_infermiere" ? theme.primary : theme.textSecondary} 
            />
            <ThemedText 
              style={{ 
                marginLeft: 8,
                color: crewType === "autista_infermiere" ? theme.primary : theme.text,
                fontWeight: crewType === "autista_infermiere" ? "600" : "400",
              }}
            >
              Autista + Infermiere
            </ThemedText>
            {crewType === "autista_infermiere" && (
              <Feather name="check" size={16} color={theme.primary} style={{ marginLeft: "auto" }} />
            )}
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader icon="calendar" title="Data e Ora" />
        
        {Platform.OS === "web" ? (
          <TextInput
            label="Data Servizio"
            placeholder="gg/mm/aaaa"
            value={formatDateItalian(serviceDate)}
            onChangeText={(text) => {
              const parts = text.split("/");
              if (parts.length === 3) {
                const day = parseInt(parts[0]);
                const month = parseInt(parts[1]) - 1;
                const year = parseInt(parts[2]);
                if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                  setServiceDate(new Date(year, month, day));
                }
              }
            }}
          />
        ) : Platform.OS === "ios" ? (
          <>
            <Pressable 
              style={[styles.pickerCard, { backgroundColor: theme.cardBackground }]}
              onPress={() => {
                setTempDate(serviceDate);
                setShowDatePicker(true);
              }}
            >
              <View style={[styles.pickerIcon, { backgroundColor: theme.primaryLight }]}>
                <Feather name="calendar" size={18} color={theme.primary} />
              </View>
              <View style={styles.pickerContent}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Data Servizio</ThemedText>
                <ThemedText type="body" style={{ fontWeight: "500" }}>{formatDateItalian(serviceDate)}</ThemedText>
              </View>
              <Feather name="chevron-right" size={20} color={theme.textSecondary} />
            </Pressable>
            <Modal
              visible={showDatePicker}
              transparent={true}
              animationType="slide"
              onRequestClose={() => setShowDatePicker(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
                  <View style={styles.modalHeader}>
                    <ThemedText type="h3">Seleziona Data</ThemedText>
                    <Pressable onPress={() => setShowDatePicker(false)}>
                      <Feather name="x" size={24} color={theme.text} />
                    </Pressable>
                  </View>
                  <DateTimePicker
                    value={tempDate}
                    mode="date"
                    display="spinner"
                    onChange={(event, date) => {
                      if (date) setTempDate(date);
                    }}
                    locale="it-IT"
                  />
                  <Button 
                    onPress={() => {
                      setServiceDate(tempDate);
                      setShowDatePicker(false);
                    }}
                    style={{ marginTop: Spacing.md }}
                  >
                    Conferma
                  </Button>
                </View>
              </View>
            </Modal>
          </>
        ) : (
          <>
            <Pressable 
              style={[styles.pickerCard, { backgroundColor: theme.cardBackground }]}
              onPress={() => setShowDatePicker(true)}
            >
              <View style={[styles.pickerIcon, { backgroundColor: theme.primaryLight }]}>
                <Feather name="calendar" size={18} color={theme.primary} />
              </View>
              <View style={styles.pickerContent}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Data Servizio</ThemedText>
                <ThemedText type="body" style={{ fontWeight: "500" }}>{formatDateItalian(serviceDate)}</ThemedText>
              </View>
            </Pressable>
            {showDatePicker ? (
              <DateTimePicker
                value={serviceDate}
                mode="date"
                display="default"
                onChange={(event, date) => {
                  setShowDatePicker(false);
                  if (date) setServiceDate(date);
                }}
              />
            ) : null}
          </>
        )}

        <View style={styles.timeRow}>
          {Platform.OS === "web" ? (
            <>
              <View style={styles.timeInputContainer}>
                <TextInput
                  label="Ora Inizio"
                  placeholder="HH:MM"
                  value={departureTime ? formatTimeItalian(departureTime) : ""}
                  onChangeText={(text) => {
                    const parts = text.split(":");
                    if (parts.length === 2) {
                      const h = parseInt(parts[0]);
                      const m = parseInt(parts[1]);
                      if (!isNaN(h) && !isNaN(m)) {
                        const dt = new Date();
                        dt.setHours(h, m);
                        setDepartureTime(dt);
                      }
                    }
                  }}
                />
              </View>
              <View style={styles.timeInputContainer}>
                <TextInput
                  label="Ora Fine"
                  placeholder="HH:MM"
                  value={returnTime ? formatTimeItalian(returnTime) : ""}
                  onChangeText={(text) => {
                    const parts = text.split(":");
                    if (parts.length === 2) {
                      const h = parseInt(parts[0]);
                      const m = parseInt(parts[1]);
                      if (!isNaN(h) && !isNaN(m)) {
                        const rt = new Date();
                        rt.setHours(h, m);
                        setReturnTime(rt);
                      }
                    }
                  }}
                />
              </View>
            </>
          ) : Platform.OS === "ios" ? (
            <>
              <Pressable 
                style={[styles.timeCard, { backgroundColor: theme.cardBackground }]}
                onPress={() => {
                  setTempDepartureTime(departureTime || new Date());
                  setShowDepartureTimePicker(true);
                }}
              >
                <View style={styles.timeContent}>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>Inizio</ThemedText>
                  <ThemedText type="body" style={{ fontWeight: "500" }}>
                    {departureTime ? formatTimeItalian(departureTime) : "--:--"}
                  </ThemedText>
                </View>
              </Pressable>
              <Pressable 
                style={[styles.timeCard, { backgroundColor: theme.cardBackground }]}
                onPress={() => {
                  setTempReturnTime(returnTime || new Date());
                  setShowReturnTimePicker(true);
                }}
              >
                <View style={styles.timeContent}>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>Fine</ThemedText>
                  <ThemedText type="body" style={{ fontWeight: "500" }}>
                    {returnTime ? formatTimeItalian(returnTime) : "--:--"}
                  </ThemedText>
                </View>
              </Pressable>
              <Modal
                visible={showDepartureTimePicker}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowDepartureTimePicker(false)}
              >
                <View style={styles.modalOverlay}>
                  <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
                    <View style={styles.modalHeader}>
                      <ThemedText type="h3">Ora Inizio</ThemedText>
                      <Pressable onPress={() => setShowDepartureTimePicker(false)}>
                        <Feather name="x" size={24} color={theme.text} />
                      </Pressable>
                    </View>
                    <DateTimePicker
                      value={tempDepartureTime}
                      mode="time"
                      display="spinner"
                      onChange={(event, date) => {
                        if (date) setTempDepartureTime(date);
                      }}
                      locale="it-IT"
                    />
                    <Button 
                      onPress={() => {
                        setDepartureTime(tempDepartureTime);
                        setShowDepartureTimePicker(false);
                      }}
                      style={{ marginTop: Spacing.md }}
                    >
                      Conferma
                    </Button>
                  </View>
                </View>
              </Modal>
              <Modal
                visible={showReturnTimePicker}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowReturnTimePicker(false)}
              >
                <View style={styles.modalOverlay}>
                  <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
                    <View style={styles.modalHeader}>
                      <ThemedText type="h3">Ora Fine</ThemedText>
                      <Pressable onPress={() => setShowReturnTimePicker(false)}>
                        <Feather name="x" size={24} color={theme.text} />
                      </Pressable>
                    </View>
                    <DateTimePicker
                      value={tempReturnTime}
                      mode="time"
                      display="spinner"
                      onChange={(event, date) => {
                        if (date) setTempReturnTime(date);
                      }}
                      locale="it-IT"
                    />
                    <Button 
                      onPress={() => {
                        setReturnTime(tempReturnTime);
                        setShowReturnTimePicker(false);
                      }}
                      style={{ marginTop: Spacing.md }}
                    >
                      Conferma
                    </Button>
                  </View>
                </View>
              </Modal>
            </>
          ) : (
            <>
              <Pressable 
                style={[styles.timeCard, { backgroundColor: theme.cardBackground }]}
                onPress={() => setShowDepartureTimePicker(true)}
              >
                <View style={styles.timeContent}>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>Inizio</ThemedText>
                  <ThemedText type="body" style={{ fontWeight: "500" }}>
                    {departureTime ? formatTimeItalian(departureTime) : "--:--"}
                  </ThemedText>
                </View>
              </Pressable>
              {showDepartureTimePicker ? (
                <DateTimePicker
                  value={departureTime || new Date()}
                  mode="time"
                  display="default"
                  onChange={(event, date) => {
                    setShowDepartureTimePicker(false);
                    if (date) setDepartureTime(date);
                  }}
                />
              ) : null}
              <Pressable 
                style={[styles.timeCard, { backgroundColor: theme.cardBackground }]}
                onPress={() => setShowReturnTimePicker(true)}
              >
                <View style={styles.timeContent}>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>Fine</ThemedText>
                  <ThemedText type="body" style={{ fontWeight: "500" }}>
                    {returnTime ? formatTimeItalian(returnTime) : "--:--"}
                  </ThemedText>
                </View>
              </Pressable>
              {showReturnTimePicker ? (
                <DateTimePicker
                  value={returnTime || new Date()}
                  mode="time"
                  display="default"
                  onChange={(event, date) => {
                    setShowReturnTimePicker(false);
                    if (date) setReturnTime(date);
                  }}
                />
              ) : null}
            </>
          )}
        </View>
        {duration !== null ? (
          <View style={[styles.durationBadge, { backgroundColor: theme.successLight }]}>
            <Feather name="clock" size={14} color={theme.success} />
            <ThemedText type="small" style={{ color: theme.success, marginLeft: 6 }}>
              Durata: {duration} minuti
            </ThemedText>
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <SectionHeader icon="map-pin" title="Inizio" />
        <LocationTypeTabs
          selectedType={originType}
          onSelectType={(type) => {
            setOriginType(type);
            setOriginStructureId("");
            setOriginDepartmentId("");
            setOriginAddress("");
            setShowOriginPicker(true);
          }}
        />
        <SelectButton
          label="Luogo di Inizio"
          value={getOriginDisplayText()}
          placeholder="Seleziona partenza..."
          onPress={() => setShowOriginPicker(true)}
          icon="map-pin"
        />
      </View>

      {/* Waypoints section - read only for emergency services */}
      {trip?.waypoints && trip.waypoints.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader icon="navigation" title="Tappe Intervento" />
          <View style={[styles.waypointsContainer, { backgroundColor: theme.backgroundDefault, borderRadius: BorderRadius.md }]}>
            {trip.waypoints.map((waypoint, index) => {
              const waypointLabel = waypoint.waypointType === "luogo_intervento" ? "Luogo Intervento" : `Tappa ${index + 1}`;
              let displayText = "";
              if (waypoint.locationType === "gps" || waypoint.locationType === "domicilio") {
                displayText = waypoint.address || "GPS";
              } else if (waypoint.locationType === "sede") {
                displayText = trip.locationName ? `Sede ${trip.locationName}` : "Sede";
              } else if (waypoint.structureName) {
                displayText = waypoint.structureName;
                if (waypoint.departmentName) {
                  displayText += ` - ${waypoint.departmentName}`;
                }
              } else {
                displayText = waypoint.address || waypointLabel;
              }
              
              return (
                <View key={waypoint.id} style={styles.waypointItem}>
                  <View style={[styles.waypointIcon, { backgroundColor: theme.warning + "20" }]}>
                    <Feather name="navigation" size={14} color={theme.warning} />
                  </View>
                  <View style={styles.waypointContent}>
                    <ThemedText type="small" style={{ color: theme.warning, fontSize: 10 }}>{waypointLabel}</ThemedText>
                    <ThemedText type="body" style={{ fontWeight: "500" }} numberOfLines={2}>
                      {displayText}
                    </ThemedText>
                    {waypoint.structureAddress ? (
                      <ThemedText type="small" style={{ color: theme.textSecondary }} numberOfLines={1}>
                        {waypoint.structureAddress}
                      </ThemedText>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader icon="flag" title="Destinazione" />
        <LocationTypeTabs
          selectedType={destinationType}
          onSelectType={(type) => {
            setDestinationType(type);
            setDestinationStructureId("");
            setDestinationDepartmentId("");
            setDestinationAddress("");
            setShowDestPicker(true);
          }}
        />
        <SelectButton
          label="Luogo di Destinazione"
          value={getDestDisplayText()}
          placeholder="Seleziona destinazione..."
          onPress={() => setShowDestPicker(true)}
          icon="flag"
        />
      </View>

      <View style={styles.section}>
        <SectionHeader icon="navigation" title="Chilometri" />
        <View style={styles.kmRow}>
          <View style={styles.kmInputContainer}>
            <TextInput
              label="Km Iniziali"
              value={kmInitial}
              onChangeText={setKmInitial}
              keyboardType="number-pad"
              placeholder="0"
            />
          </View>
          <View style={styles.kmArrow}>
            <Feather name="arrow-right" size={20} color={theme.textSecondary} />
          </View>
          <View style={styles.kmInputContainer}>
            <TextInput
              label="Km Finali"
              value={kmFinal}
              onChangeText={setKmFinal}
              keyboardType="number-pad"
              placeholder="0"
            />
          </View>
        </View>
        {kmTraveled > 0 ? (
          <View style={[styles.kmSummary, { backgroundColor: theme.successLight }]}>
            <ThemedText type="body" style={{ color: theme.success, fontWeight: "600" }}>
              Percorsi: {kmTraveled} km
            </ThemedText>
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <SectionHeader icon="file-text" title="Note (opzionale)" />
        <TextInput
          label="Note aggiuntive"
          value={notes}
          onChangeText={setNotes}
          placeholder="Inserisci eventuali note..."
          multiline
        />
      </View>

      <View style={styles.submitSection}>
        <Button
          onPress={handleSubmit}
          disabled={updateTripMutation.isPending}
          style={{ backgroundColor: theme.primary }}
        >
          {updateTripMutation.isPending ? "Salvando..." : "Salva Modifiche"}
        </Button>
      </View>

      <LocationPickerModal
        visible={showOriginPicker}
        onClose={() => setShowOriginPicker(false)}
        title="Seleziona Inizio"
        locationType={originType}
        structureId={originStructureId}
        departmentId={originDepartmentId}
        address={originAddress}
        structures={structures || []}
        departments={departments || []}
        locations={locations || []}
        onSelectType={setOriginType}
        onSelectStructure={setOriginStructureId}
        onSelectDepartment={setOriginDepartmentId}
        onChangeAddress={setOriginAddress}
        onConfirm={() => setShowOriginPicker(false)}
        onAddCustomStructure={handleAddCustomStructure}
        onAddCustomDepartment={handleAddCustomDepartment}
        skipCategoryStep={true}
      />

      <LocationPickerModal
        visible={showDestPicker}
        onClose={() => setShowDestPicker(false)}
        title="Seleziona Destinazione"
        locationType={destinationType}
        structureId={destinationStructureId}
        departmentId={destinationDepartmentId}
        address={destinationAddress}
        structures={structures || []}
        departments={departments || []}
        locations={locations || []}
        onSelectType={setDestinationType}
        onSelectStructure={setDestinationStructureId}
        onSelectDepartment={setDestinationDepartmentId}
        onChangeAddress={setDestinationAddress}
        onConfirm={() => setShowDestPicker(false)}
        onAddCustomStructure={handleAddCustomStructure}
        onAddCustomDepartment={handleAddCustomDepartment}
        skipCategoryStep={true}
      />
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  sectionTitle: {
    flex: 1,
  },
  returnTripCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    marginBottom: Spacing.xl,
  },
  returnTripContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  returnTripIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  returnTripText: {
    flex: 1,
  },
  crewTypeContainer: {
    gap: Spacing.sm,
  },
  crewTypeButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
  },
  selectButtonCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  selectButtonIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  selectButtonContent: {
    flex: 1,
  },
  pickerCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  pickerIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  pickerContent: {
    flex: 1,
  },
  timeRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  timeCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  timeContent: {
    alignItems: "center",
  },
  timeInputContainer: {
    flex: 1,
  },
  durationBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    padding: Spacing.xl,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  kmRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  kmInputContainer: {
    flex: 1,
  },
  kmArrow: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
  },
  kmSummary: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
  },
  submitSection: {
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  locationTabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  locationTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  waypointsContainer: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  waypointItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  waypointIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  waypointContent: {
    flex: 1,
  },
});
