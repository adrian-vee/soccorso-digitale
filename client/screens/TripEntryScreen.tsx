import React, { useState, useEffect, useRef } from "react";
import { 
  View, 
  StyleSheet, 
  Alert, 
  ActivityIndicator, 
  Pressable,
  Modal,
  Switch,
  AppState
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Platform, Linking } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { TextInput } from "@/components/TextInput";
import { Card } from "@/components/Card";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { Spacing, BorderRadius } from "@/constants/theme";
import { PickerModal } from "@/components/PickerModal";
import { LocationPickerModal } from "@/components/LocationPickerModal";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { TripEntryStackParamList } from "@/navigation/TripEntryStackNavigator";
import { SignaturePad } from "@/components/SignaturePad";
import { HolidayChip } from "@/components/HolidayChip";
import { WeatherBadge } from "@/components/WeatherBadge";
import { What3WordsInput } from "@/components/What3WordsInput";

const AUTHORIZER_TYPES = [
  { value: "medico_bordo", label: "Medico a bordo" },
  { value: "infermiere_bordo", label: "Infermiere a bordo" },
  { value: "medico_reparto", label: "Medico del reparto" },
  { value: "centrale_operativa", label: "Centrale Operativa" },
];

// Italian province abbreviation mapping (city -> province code)
const PROVINCE_MAP: Record<string, string> = {
  // Veneto
  "Verona": "VR", "San Giovanni Lupatoto": "VR", "Villafranca di Verona": "VR", "Legnago": "VR", "Nogara": "VR", "Bussolengo": "VR", "Pescantina": "VR", "Negrar": "VR", "San Bonifacio": "VR", "Isola della Scala": "VR", "Bovolone": "VR", "Cerea": "VR", "Sona": "VR", "Castelnuovo del Garda": "VR", "Peschiera del Garda": "VR", "Lazise": "VR", "Bardolino": "VR", "Malcesine": "VR", "Garda": "VR", "Sommacampagna": "VR", "Valeggio sul Mincio": "VR", "Zevio": "VR", "Cologna Veneta": "VR", "Monteforte d'Alpone": "VR", "Illasi": "VR", "Caldiero": "VR", "Soave": "VR", "Sant'Ambrogio di Valpolicella": "VR", "San Pietro in Cariano": "VR", "Mozzecane": "VR", "Castel d'Azzano": "VR", "Buttapietra": "VR", "San Martino Buon Albergo": "VR", "Lavagno": "VR", "Grezzana": "VR", "Oppeano": "VR", "Vigasio": "VR", "Trevenzuolo": "VR", "Erbè": "VR", "Sanguinetto": "VR", "Casaleone": "VR", "Concamarise": "VR", "Salizzole": "VR", "Roverè Veronese": "VR", "Bosco Chiesanuova": "VR", "Cerro Veronese": "VR",
  "Vicenza": "VI", "Bassano del Grappa": "VI", "Schio": "VI", "Valdagno": "VI", "Arzignano": "VI", "Thiene": "VI", "Montecchio Maggiore": "VI", "Chiampo": "VI", "Lonigo": "VI", "Brendola": "VI", "Malo": "VI", "Sandrigo": "VI", "Dueville": "VI", "Torri di Quartesolo": "VI", "Altavilla Vicentina": "VI", "Creazzo": "VI", "Sovizzo": "VI", "Costabissara": "VI", "Monteviale": "VI", "Arcugnano": "VI", "Albettone": "VI", "Montegalda": "VI", "Montegaldella": "VI", "Barbarano Vicentino": "VI", "Castegnero": "VI", "Nanto": "VI", "Orgiano": "VI", "Sossano": "VI", "Villaga": "VI", "Noventa Vicentina": "VI", "Pojana Maggiore": "VI", "Asigliano Veneto": "VI", "Marostica": "VI", "Rosà": "VI", "Cassola": "VI", "Romano d'Ezzelino": "VI", "Pove del Grappa": "VI", "Solagna": "VI", "San Nazario": "VI", "Cismon del Grappa": "VI", "Valstagna": "VI", "Campolongo sul Brenta": "VI",
  "Padova": "PD", "Abano Terme": "PD", "Albignasego": "PD", "Cadoneghe": "PD", "Cittadella": "PD", "Este": "PD", "Monselice": "PD", "Piove di Sacco": "PD", "Selvazzano Dentro": "PD", "Vigonza": "PD", "Rubano": "PD", "Limena": "PD", "Noventa Padovana": "PD", "Piazzola sul Brenta": "PD", "Camposampiero": "PD", "Vigodarzere": "PD", "Saonara": "PD", "Ponte San Nicolò": "PD", "Legnaro": "PD", "Polverara": "PD", "Brugine": "PD", "Correzzola": "PD", "Codevigo": "PD", "Arzergrande": "PD", "Sant'Angelo di Piove di Sacco": "PD", "Pontelongo": "PD", "Agna": "PD", "Candiana": "PD", "Arre": "PD", "Bagnoli di Sopra": "PD", "Battaglia Terme": "PD", "Montagnana": "PD", "Conselve": "PD", "Due Carrare": "PD", "Cartura": "PD", "Maserà di Padova": "PD", "Casalserugo": "PD", "Bovolenta": "PD", "Pernumia": "PD", "San Pietro Viminario": "PD", "Solesino": "PD", "Stanghella": "PD", "Pozzonovo": "PD", "Sant'Elena": "PD", "Villa Estense": "PD", "Ospedaletto Euganeo": "PD", "Cinto Euganeo": "PD", "Lozzo Atestino": "PD", "Vo'": "PD", "Baone": "PD", "Arquà Petrarca": "PD", "Galzignano Terme": "PD", "Torreglia": "PD", "Teolo": "PD", "Rovolon": "PD", "Cervarese Santa Croce": "PD", "Saccolongo": "PD", "Veggiano": "PD", "Mestrino": "PD", "Montegrotto Terme": "PD",
  "Treviso": "TV", "Conegliano": "TV", "Montebelluna": "TV", "Castelfranco Veneto": "TV", "Vittorio Veneto": "TV", "Mogliano Veneto": "TV", "Oderzo": "TV", "Paese": "TV", "Spresiano": "TV", "Villorba": "TV", "Ponzano Veneto": "TV", "Carbonera": "TV", "Quinto di Treviso": "TV", "Silea": "TV", "Preganziol": "TV", "Zero Branco": "TV", "Casier": "TV", "Roncade": "TV", "San Biagio di Callalta": "TV",
  "Venezia": "VE", "Mestre": "VE", "Chioggia": "VE", "Jesolo": "VE", "Mirano": "VE", "Portogruaro": "VE", "San Donà di Piave": "VE", "Spinea": "VE", "Dolo": "VE", "Mira": "VE", "Martellago": "VE", "Noale": "VE", "Salzano": "VE", "Scorzè": "VE", "Marcon": "VE", "Quarto d'Altino": "VE", "Meolo": "VE", "Musile di Piave": "VE", "Noventa di Piave": "VE", "Fossalta di Piave": "VE", "Ceggia": "VE", "Torre di Mosto": "VE", "Eraclea": "VE", "Caorle": "VE", "Concordia Sagittaria": "VE", "Fossalta di Portogruaro": "VE", "Gruaro": "VE", "Pramaggiore": "VE", "Annone Veneto": "VE", "Cinto Caomaggiore": "VE", "Teglio Veneto": "VE", "Santo Stino di Livenza": "VE",
  "Rovigo": "RO", "Adria": "RO", "Badia Polesine": "RO", "Lendinara": "RO", "Porto Viro": "RO", "Occhiobello": "RO", "Taglio di Po": "RO", "Porto Tolle": "RO", "Rosolina": "RO", "Loreo": "RO", "Corbola": "RO", "Ariano nel Polesine": "RO", "Papozze": "RO", "Villanova Marchesana": "RO", "Canaro": "RO", "Ficarolo": "RO", "Gaiba": "RO", "Stienta": "RO", "Salara": "RO", "Calto": "RO", "Castelmassa": "RO", "Ceneselli": "RO", "Bergantino": "RO", "Melara": "RO", "Trecenta": "RO", "Giacciano con Baruchella": "RO", "Canda": "RO", "San Bellino": "RO", "Lusia": "RO", "Bagnolo di Po": "RO", "Castelguglielmo": "RO", "Crespino": "RO", "Pontecchio Polesine": "RO", "Frassinelle Polesine": "RO", "Pincara": "RO", "Villanova del Ghebbo": "RO", "Fratta Polesine": "RO", "Costa di Rovigo": "RO", "Arquà Polesine": "RO", "Polesella": "RO", "Guarda Veneta": "RO", "Gavello": "RO", "Bosaro": "RO", "Ceregnano": "RO", "Villadose": "RO", "San Martino di Venezze": "RO",
  "Belluno": "BL", "Feltre": "BL", "Sedico": "BL", "Santa Giustina": "BL", "Ponte nelle Alpi": "BL", "Limana": "BL", "Mel": "BL", "Lentiai": "BL", "Trichiana": "BL", "Borgo Valbelluna": "BL", "Cortina d'Ampezzo": "BL", "Agordo": "BL", "Alleghe": "BL", "Auronzo di Cadore": "BL", "Pieve di Cadore": "BL", "Calalzo di Cadore": "BL", "Domegge di Cadore": "BL", "Lozzo di Cadore": "BL", "Vodo Cadore": "BL", "Borca di Cadore": "BL", "San Vito di Cadore": "BL",
  // Lombardia
  "Milano": "MI", "Monza": "MB", "Brescia": "BS", "Bergamo": "BG", "Como": "CO", "Varese": "VA", "Pavia": "PV", "Cremona": "CR", "Mantova": "MN", "Lecco": "LC", "Lodi": "LO", "Sondrio": "SO",
  // Emilia-Romagna
  "Bologna": "BO", "Modena": "MO", "Parma": "PR", "Reggio Emilia": "RE", "Ferrara": "FE", "Ravenna": "RA", "Forlì": "FC", "Cesena": "FC", "Rimini": "RN", "Piacenza": "PC",
  // Trentino-Alto Adige
  "Trento": "TN", "Bolzano": "BZ", "Rovereto": "TN", "Merano": "BZ", "Bressanone": "BZ", "Brunico": "BZ",
  // Friuli-Venezia Giulia
  "Trieste": "TS", "Udine": "UD", "Pordenone": "PN", "Gorizia": "GO",
  // Piemonte
  "Torino": "TO", "Novara": "NO", "Alessandria": "AL", "Asti": "AT", "Cuneo": "CN", "Biella": "BI", "Vercelli": "VC", "Verbania": "VB",
  // Liguria
  "Genova": "GE", "La Spezia": "SP", "Savona": "SV", "Imperia": "IM",
  // Toscana
  "Firenze": "FI", "Prato": "PO", "Livorno": "LI", "Arezzo": "AR", "Pisa": "PI", "Pistoia": "PT", "Lucca": "LU", "Siena": "SI", "Massa": "MS", "Carrara": "MS", "Grosseto": "GR",
  // Lazio
  "Roma": "RM", "Latina": "LT", "Frosinone": "FR", "Viterbo": "VT", "Rieti": "RI",
  // Campania
  "Napoli": "NA", "Salerno": "SA", "Caserta": "CE", "Avellino": "AV", "Benevento": "BN",
  // Sicilia
  "Palermo": "PA", "Catania": "CT", "Messina": "ME", "Siracusa": "SR", "Ragusa": "RG", "Trapani": "TP", "Agrigento": "AG", "Caltanissetta": "CL", "Enna": "EN",
  // Sardegna
  "Cagliari": "CA", "Sassari": "SS", "Nuoro": "NU", "Oristano": "OR",
  // Altre regioni
  "Ancona": "AN", "Pesaro": "PU", "Fermo": "FM", "Macerata": "MC", "Ascoli Piceno": "AP",
  "Perugia": "PG", "Terni": "TR",
  "L'Aquila": "AQ", "Pescara": "PE", "Chieti": "CH", "Teramo": "TE",
  "Campobasso": "CB", "Isernia": "IS",
  "Potenza": "PZ", "Matera": "MT",
  "Bari": "BA", "Lecce": "LE", "Taranto": "TA", "Foggia": "FG", "Brindisi": "BR", "Barletta": "BT", "Andria": "BT", "Trani": "BT",
  "Cosenza": "CS", "Catanzaro": "CZ", "Reggio Calabria": "RC", "Crotone": "KR", "Vibo Valentia": "VV",
  "Aosta": "AO",
};

// Region to province code fallback (for when city is not in the map)
const REGION_TO_PROVINCE: Record<string, string> = {
  "Veneto": "VR", "Lombardia": "MI", "Emilia-Romagna": "BO", "Trentino-Alto Adige": "TN", "Friuli-Venezia Giulia": "UD",
  "Piemonte": "TO", "Liguria": "GE", "Toscana": "FI", "Lazio": "RM", "Campania": "NA", "Sicilia": "PA", "Sardegna": "CA",
  "Marche": "AN", "Umbria": "PG", "Abruzzo": "AQ", "Molise": "CB", "Basilicata": "PZ", "Puglia": "BA", "Calabria": "CS", "Valle d'Aosta": "AO",
};

// Helper function to get province code from city or region
const getProvinceCode = (city: string | null, region: string | null): string => {
  if (city && PROVINCE_MAP[city]) {
    return PROVINCE_MAP[city];
  }
  if (region && REGION_TO_PROVINCE[region]) {
    return REGION_TO_PROVINCE[region];
  }
  // Return empty if not found
  return region || "";
};

const TRIP_DRAFT_KEY = "@soccorso_digitale_trip_draft";

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

const INTERVENTION_LOCATION_TABS = [
  { value: "casa_di_riposo", label: "CDR", icon: "heart" },
  { value: "domicilio", label: "Domicilio", icon: "map-pin" },
  { value: "gps", label: "Usa GPS", icon: "navigation" },
];

function LocationTypeTabs({ 
  selectedType, 
  onSelectType,
  sedeName,
}: { 
  selectedType: string; 
  onSelectType: (type: string) => void;
  sedeName?: string;
}) {
  const { theme, isDark } = useTheme();
  
  return (
    <View style={styles.locationTabs}>
      {LOCATION_TABS.map((tab) => {
        const isSelected = selectedType === tab.value;
        const displayLabel = tab.label; // Keep tab labels simple, show full name in selection display
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
              {displayLabel}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

function InterventionLocationTabs({ 
  selectedType, 
  onSelectType,
  isLoading = false,
}: { 
  selectedType: string; 
  onSelectType: (type: string) => void;
  isLoading?: boolean;
}) {
  const { theme, isDark } = useTheme();
  
  return (
    <View style={styles.locationTabs}>
      {INTERVENTION_LOCATION_TABS.map((tab) => {
        const isSelected = selectedType === tab.value;
        const isGps = tab.value === "gps";
        return (
          <Pressable
            key={tab.value}
            style={[
              styles.locationTab,
              { 
                backgroundColor: isSelected 
                  ? (isGps ? "#0066CC" : theme.primary) 
                  : theme.cardBackground,
                borderColor: isSelected 
                  ? (isGps ? "#0066CC" : theme.primary) 
                  : theme.border,
              }
            ]}
            onPress={() => {
              if (Platform.OS !== "web") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              onSelectType(tab.value);
            }}
            disabled={isGps && isLoading}
          >
            {isGps && isLoading ? (
              <ActivityIndicator size="small" color={isSelected ? "#FFFFFF" : (isDark ? "#FFFFFF" : "#0066CC")} />
            ) : (
              <Feather 
                name={tab.icon as any} 
                size={14} 
                color={isSelected ? "#FFFFFF" : (isGps ? (isDark ? "#FFFFFF" : "#0066CC") : theme.textSecondary)} 
              />
            )}
            <ThemedText 
              type="small" 
              style={{ 
                color: isSelected ? "#FFFFFF" : (isGps ? (isDark ? "#FFFFFF" : "#0066CC") : theme.textSecondary),
                marginLeft: 4,
                fontWeight: isSelected ? "600" : "400",
              }}
            >
              {isGps && isLoading ? "..." : tab.label}
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

interface LocationData {
  id: string;
  name: string;
  address: string | null;
}

interface Department {
  id: string;
  name: string;
}

interface Trip {
  kmFinal: number;
  originType: string;
  originStructureId: string | null;
  originDepartmentId: string | null;
  originAddress: string | null;
  destinationType: string;
  destinationStructureId: string | null;
  destinationDepartmentId: string | null;
  destinationAddress: string | null;
}

function SectionHeader({ icon, title }: { icon: string; title: string }) {
  const { theme, isDark } = useTheme();
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
  const { theme, isDark } = useTheme();

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

type TripEntryNavigationProp = NativeStackNavigationProp<TripEntryStackParamList>;

export default function TripEntryScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const selectedVehicle = user?.vehicle || null;
  const queryClient = useQueryClient();
  const navigation = useNavigation<TripEntryNavigationProp>();
  const { 
    pendingCount, 
    isOnline, 
    isSyncing, 
    submitTrip: submitTripOffline,
    retrySync,
    isEncryptionSupported: hasEncryption,
  } = useOfflineQueue();

  const [serviceNumber, setServiceNumber] = useState("");
  const [isReturnTrip, setIsReturnTrip] = useState(false);
  const [serviceType, setServiceType] = useState("dimissione"); // dimissione, visita, trasferimento, emergenza, dialisi
  const [crewType, setCrewType] = useState("autista_soccorritore"); // autista_soccorritore, autista_infermiere
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
  const [kmManuallyEdited, setKmManuallyEdited] = useState(false);
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);
  const [calculatedDistance, setCalculatedDistance] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [deviceAuthEnabled, setDeviceAuthEnabled] = useState(false);
  const [authorizerType, setAuthorizerType] = useState("medico_bordo");
  const [authorizerName, setAuthorizerName] = useState("");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [showAuthTypePicker, setShowAuthTypePicker] = useState(false);
  
  // Emergency service with waypoints
  const [isEmergencyService, setIsEmergencyService] = useState(false);
  const [emergencyStartType, setEmergencyStartType] = useState<"sede" | "gps">("sede");
  const [emergencyStartAddress, setEmergencyStartAddress] = useState("");
  const [emergencyStartCoords, setEmergencyStartCoords] = useState<{lat: number, lng: number} | null>(null);
  const [isGettingGpsLocation, setIsGettingGpsLocation] = useState(false);
  const [waypoint1Type, setWaypoint1Type] = useState("domicilio"); // Luogo Intervento
  const [waypoint1StructureId, setWaypoint1StructureId] = useState("");
  const [waypoint1DepartmentId, setWaypoint1DepartmentId] = useState("");
  const [waypoint1Address, setWaypoint1Address] = useState("");
  const [waypoint1Coords, setWaypoint1Coords] = useState<{lat: number, lng: number} | null>(null);
  const [isGettingWaypoint1Gps, setIsGettingWaypoint1Gps] = useState(false);
  const [waypoint2Type, setWaypoint2Type] = useState("ospedale"); // Destinazione Intermedia
  const [waypoint2StructureId, setWaypoint2StructureId] = useState("");
  const [waypoint2DepartmentId, setWaypoint2DepartmentId] = useState("");
  const [waypoint2Address, setWaypoint2Address] = useState("");
  const [showWaypoint1Picker, setShowWaypoint1Picker] = useState(false);
  const [showWaypoint2Picker, setShowWaypoint2Picker] = useState(false);
  const [waypointKmBreakdown, setWaypointKmBreakdown] = useState<{leg1: number | null, leg2: number | null, leg3: number | null}>({leg1: null, leg2: null, leg3: null});
  const [isCalculatingWaypointKm, setIsCalculatingWaypointKm] = useState(false);
  const [formUserCoords, setFormUserCoords] = useState<{ lat: number; lon: number } | null>(null);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDepartureTimePicker, setShowDepartureTimePicker] = useState(false);
  const [showReturnTimePicker, setShowReturnTimePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());
  const [tempDepartureTime, setTempDepartureTime] = useState(new Date());
  const [tempReturnTime, setTempReturnTime] = useState(new Date());
  const [showOriginPicker, setShowOriginPicker] = useState(false);
  const [showDestPicker, setShowDestPicker] = useState(false);
  const [showGenderPicker, setShowGenderPicker] = useState(false);

  const { data: structures } = useQuery<Structure[]>({
    queryKey: ["/api/structures"],
  });

  const { data: departments } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const { data: locations } = useQuery<LocationData[]>({
    queryKey: ["/api/locations"],
  });

  const { data: lastTrip } = useQuery<Trip | null>({
    queryKey: ["/api/vehicles", selectedVehicle?.id, "last-trip"],
    enabled: !!selectedVehicle?.id,
  });

  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const lastLocationUpdateRef = useRef<number>(0);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Location.getLastKnownPositionAsync()
      .then((pos) => {
        if (pos) {
          setFormUserCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        } else {
          setFormUserCoords({ lat: 45.1553, lon: 11.307 });
        }
      })
      .catch(() => setFormUserCoords({ lat: 45.1553, lon: 11.307 }));
  }, []);

  useEffect(() => {
    const startLocationTracking = async () => {
      if (!selectedVehicle?.id) return;
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      try {
        locationSubscriptionRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 30000,
            distanceInterval: 50,
          },
          async (location) => {
            const now = Date.now();
            if (now - lastLocationUpdateRef.current < 30000) return;
            lastLocationUpdateRef.current = now;

            try {
              await apiRequest("PATCH", `/api/vehicles/${selectedVehicle.id}/location`, {
                latitude: location.coords.latitude.toString(),
                longitude: location.coords.longitude.toString(),
                isOnService: true,
              });
            } catch (error) {
              console.log("Failed to update vehicle location:", error);
            }
          }
        );
      } catch (error) {
        console.log("Location tracking error:", error);
      }
    };

    startLocationTracking();

    return () => {
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
      }
      if (selectedVehicle?.id) {
        apiRequest("PATCH", `/api/vehicles/${selectedVehicle.id}/location`, {
          latitude: "0",
          longitude: "0",
          isOnService: false,
        }).catch(() => {});
      }
    };
  }, [selectedVehicle?.id]);

  useEffect(() => {
    if (lastTrip?.kmFinal) {
      setKmInitial(lastTrip.kmFinal.toString());
    } else if (selectedVehicle?.currentKm) {
      setKmInitial(selectedVehicle.currentKm.toString());
    }
    
    if (lastTrip) {
      setOriginType(lastTrip.destinationType);
      setOriginStructureId(lastTrip.destinationStructureId || "");
      setOriginDepartmentId(lastTrip.destinationDepartmentId || "");
      setOriginAddress(lastTrip.destinationAddress || "");
    }
  }, [lastTrip, selectedVehicle]);

  useEffect(() => {
    const restoreDraft = async () => {
      try {
        const saved = await AsyncStorage.getItem(TRIP_DRAFT_KEY);
        if (!saved) return;
        const draft = JSON.parse(saved);
        if (draft.vehicleId !== selectedVehicle?.id) {
          await AsyncStorage.removeItem(TRIP_DRAFT_KEY);
          return;
        }
        const savedTime = new Date(draft.savedAt);
        const hoursSince = (Date.now() - savedTime.getTime()) / (1000 * 60 * 60);
        if (hoursSince > 12) {
          await AsyncStorage.removeItem(TRIP_DRAFT_KEY);
          return;
        }
        Alert.alert(
          "Dati non salvati",
          "Hai un inserimento in corso. Vuoi continuare da dove avevi lasciato?",
          [
            { text: "No, ricomincia", style: "destructive", onPress: () => AsyncStorage.removeItem(TRIP_DRAFT_KEY) },
            { text: "Si, continua", onPress: () => {
              if (draft.serviceNumber) setServiceNumber(draft.serviceNumber);
              if (draft.isReturnTrip !== undefined) setIsReturnTrip(draft.isReturnTrip);
              if (draft.serviceType) setServiceType(draft.serviceType);
              if (draft.crewType) setCrewType(draft.crewType);
              if (draft.serviceDate) setServiceDate(new Date(draft.serviceDate));
              if (draft.departureTime) setDepartureTime(new Date(draft.departureTime));
              if (draft.returnTime) setReturnTime(new Date(draft.returnTime));
              if (draft.patientBirthYear) setPatientBirthYear(draft.patientBirthYear);
              if (draft.patientGender) setPatientGender(draft.patientGender);
              if (draft.originType) setOriginType(draft.originType);
              if (draft.originStructureId) setOriginStructureId(draft.originStructureId);
              if (draft.originDepartmentId) setOriginDepartmentId(draft.originDepartmentId);
              if (draft.originAddress) setOriginAddress(draft.originAddress);
              if (draft.destinationType) setDestinationType(draft.destinationType);
              if (draft.destinationStructureId) setDestinationStructureId(draft.destinationStructureId);
              if (draft.destinationDepartmentId) setDestinationDepartmentId(draft.destinationDepartmentId);
              if (draft.destinationAddress) setDestinationAddress(draft.destinationAddress);
              if (draft.kmInitial) setKmInitial(draft.kmInitial);
              if (draft.kmFinal) setKmFinal(draft.kmFinal);
              if (draft.kmManuallyEdited !== undefined) setKmManuallyEdited(draft.kmManuallyEdited);
              if (draft.notes) setNotes(draft.notes);
              if (draft.deviceAuthEnabled !== undefined) setDeviceAuthEnabled(draft.deviceAuthEnabled);
              if (draft.authorizerType) setAuthorizerType(draft.authorizerType);
              if (draft.authorizerName) setAuthorizerName(draft.authorizerName);
              if (draft.isEmergencyService !== undefined) setIsEmergencyService(draft.isEmergencyService);
              if (draft.emergencyStartType) setEmergencyStartType(draft.emergencyStartType);
              if (draft.emergencyStartAddress) setEmergencyStartAddress(draft.emergencyStartAddress);
              if (draft.emergencyStartCoords) setEmergencyStartCoords(draft.emergencyStartCoords);
              if (draft.waypoint1Type) setWaypoint1Type(draft.waypoint1Type);
              if (draft.waypoint1StructureId) setWaypoint1StructureId(draft.waypoint1StructureId);
              if (draft.waypoint1DepartmentId) setWaypoint1DepartmentId(draft.waypoint1DepartmentId);
              if (draft.waypoint1Address) setWaypoint1Address(draft.waypoint1Address);
              if (draft.waypoint1Coords) setWaypoint1Coords(draft.waypoint1Coords);
              if (draft.waypoint2Type) setWaypoint2Type(draft.waypoint2Type);
              if (draft.waypoint2StructureId) setWaypoint2StructureId(draft.waypoint2StructureId);
              if (draft.waypoint2DepartmentId) setWaypoint2DepartmentId(draft.waypoint2DepartmentId);
              if (draft.waypoint2Address) setWaypoint2Address(draft.waypoint2Address);
            }},
          ]
        );
      } catch (e) {}
    };
    if (selectedVehicle?.id) {
      restoreDraft();
    }
  }, [selectedVehicle?.id]);

  useEffect(() => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(async () => {
      try {
        const hasData = serviceNumber || patientBirthYear || patientGender || 
          originStructureId || originAddress || destinationStructureId || 
          destinationAddress || kmFinal || notes || authorizerName ||
          waypoint1Address || waypoint1StructureId || waypoint2Address || waypoint2StructureId ||
          emergencyStartAddress;
        if (!hasData) return;
        
        const draft = {
          serviceNumber, isReturnTrip, serviceType, crewType,
          serviceDate: serviceDate.toISOString(),
          departureTime: departureTime?.toISOString() || null,
          returnTime: returnTime?.toISOString() || null,
          patientBirthYear, patientGender,
          originType, originStructureId, originDepartmentId, originAddress,
          destinationType, destinationStructureId, destinationDepartmentId, destinationAddress,
          kmInitial, kmFinal, kmManuallyEdited, notes,
          deviceAuthEnabled, authorizerType, authorizerName,
          isEmergencyService, emergencyStartType, emergencyStartAddress,
          emergencyStartCoords, waypoint1Type, waypoint1StructureId, waypoint1DepartmentId,
          waypoint1Address, waypoint1Coords, waypoint2Type, waypoint2StructureId,
          waypoint2DepartmentId, waypoint2Address,
          savedAt: new Date().toISOString(),
          vehicleId: selectedVehicle?.id,
        };
        await AsyncStorage.setItem(TRIP_DRAFT_KEY, JSON.stringify(draft));
      } catch (e) {}
    }, 1000);
    return () => { if (draftTimerRef.current) clearTimeout(draftTimerRef.current); };
  }, [serviceNumber, isReturnTrip, serviceType, crewType, serviceDate, departureTime, returnTime,
      patientBirthYear, patientGender, originType, originStructureId, originDepartmentId, originAddress,
      destinationType, destinationStructureId, destinationDepartmentId, destinationAddress,
      kmInitial, kmFinal, kmManuallyEdited, notes, deviceAuthEnabled, authorizerType, authorizerName,
      isEmergencyService, emergencyStartType, emergencyStartAddress, emergencyStartCoords,
      waypoint1Type, waypoint1StructureId, waypoint1DepartmentId, waypoint1Address, waypoint1Coords,
      waypoint2Type, waypoint2StructureId, waypoint2DepartmentId, waypoint2Address]);

  useEffect(() => {
    const calculateDistance = async () => {
      // Get sede address for origin/destination - use structureId (which stores location id when sede is selected) or default to user's location
      const originSedeLocation = locations?.find(l => l.id === (originType === "sede" && originStructureId ? originStructureId : user?.locationId));
      const originSedeAddress = originSedeLocation?.address || originSedeLocation?.name;
      const destSedeLocation = locations?.find(l => l.id === (destinationType === "sede" && destinationStructureId ? destinationStructureId : user?.locationId));
      const destSedeAddress = destSedeLocation?.address || destSedeLocation?.name;
      
      const hasOrigin = originType === "ospedale" || originType === "casa_di_riposo" 
        ? !!originStructureId 
        : originType === "sede"
          ? !!originSedeAddress
          : !!originAddress;
      const hasDestination = destinationType === "ospedale" || destinationType === "casa_di_riposo" 
        ? !!destinationStructureId 
        : destinationType === "sede"
          ? !!destSedeAddress
          : !!destinationAddress;

      if (!hasOrigin || !hasDestination || !kmInitial) {
        setCalculatedDistance(null);
        return;
      }

      if (kmManuallyEdited) return;

      setIsCalculatingDistance(true);
      const controller = new AbortController();
      const fetchTimeout = setTimeout(() => controller.abort(), 15000);
      
      try {
        const apiUrl = getApiUrl();
        const url = new URL("/api/distance", apiUrl);
        
        const payload: any = {};
        const sedeLoc = locations?.find(l => l.id === user?.locationId);
        if (sedeLoc?.address) {
          const provMatch = sedeLoc.address.match(/\(([A-Z]{2})\)/);
          payload.locationContext = sedeLoc.name + (provMatch ? ` (${provMatch[1]})` : "");
        } else if (sedeLoc?.name) {
          payload.locationContext = sedeLoc.name;
        }
        if (originType === "ospedale" || originType === "casa_di_riposo") {
          payload.originStructureId = originStructureId;
        } else if (originType === "sede" && originSedeAddress) {
          payload.originAddress = originSedeAddress;
          payload.originIsDomicilio = false;
        } else if (originAddress) {
          payload.originAddress = originAddress;
          payload.originIsDomicilio = originType === "domicilio";
        }
        
        if (destinationType === "ospedale" || destinationType === "casa_di_riposo") {
          payload.destinationStructureId = destinationStructureId;
        } else if (destinationType === "sede" && destSedeAddress) {
          payload.destinationAddress = destSedeAddress;
          payload.destinationIsDomicilio = false;
        } else if (destinationAddress) {
          payload.destinationAddress = destinationAddress;
          payload.destinationIsDomicilio = destinationType === "domicilio";
        }

        const response = await fetch(url.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(fetchTimeout);

        if (response.ok) {
          const data = await response.json();
          setCalculatedDistance(data.distanceKm);
          const initialKm = parseInt(kmInitial);
          if (!isNaN(initialKm) && data.distanceKm) {
            setKmFinal((initialKm + data.distanceKm).toString());
          }
        }
      } catch (error: any) {
        clearTimeout(fetchTimeout);
        if (error.name !== "AbortError") {
          console.error("Distance calculation error:", error);
        }
      } finally {
        setIsCalculatingDistance(false);
      }
    };

    const timeoutId = setTimeout(calculateDistance, 500);
    return () => clearTimeout(timeoutId);
  }, [originType, originStructureId, originAddress, destinationType, destinationStructureId, destinationAddress, kmInitial, kmManuallyEdited, locations, user?.locationId]);

  const kmTraveled = kmFinal && kmInitial 
    ? Math.max(0, parseInt(kmFinal) - parseInt(kmInitial))
    : 0;

  // Calculate waypoint distances for emergency services
  useEffect(() => {
    const calculateWaypointDistances = async () => {
      if (!isEmergencyService || !kmInitial) return;
      
      // Check if we have waypoint 1 (luogo intervento) - required
      const hasWaypoint1 = waypoint1Type === "ospedale" || waypoint1Type === "casa_di_riposo"
        ? !!waypoint1StructureId
        : waypoint1Type === "gps"
          ? !!waypoint1Address && !!waypoint1Coords
          : !!waypoint1Address;
      
      // Check if we have waypoint 2 (destinazione intermedia) - optional
      const hasWaypoint2 = waypoint2Type === "ospedale" || waypoint2Type === "casa_di_riposo"
        ? !!waypoint2StructureId
        : !!waypoint2Address;
      
      // Check if we have final destination
      const hasFinalDest = destinationType === "ospedale" || destinationType === "casa_di_riposo"
        ? !!destinationStructureId
        : destinationType === "sede"
          ? true // Sede is always available
          : !!destinationAddress;
      
      console.log("Emergency km calc check:", { hasWaypoint1, hasFinalDest, waypoint1Type, waypoint1Address, destinationType });
      
      if (!hasWaypoint1 || !hasFinalDest) {
        console.log("Missing waypoint1 or finalDest, skipping km calc");
        setWaypointKmBreakdown({leg1: null, leg2: null, leg3: null});
        return;
      }
      
      if (kmManuallyEdited) return;
      
      setIsCalculatingWaypointKm(true);
      
      try {
        const apiUrl = getApiUrl();
        
        // Build waypoints array for multi-leg calculation
        const waypoints = [];
        
        // Leg 1: Start (Sede or GPS) -> Luogo Intervento
        const leg1Payload: any = {
          originAddress: emergencyStartType === "gps" && emergencyStartAddress 
            ? emergencyStartAddress 
            : (locations?.find(l => l.id === user?.locationId)?.address || "Sede"),
          originIsDomicilio: false,
        };
        if (emergencyStartType === "gps" && emergencyStartCoords) {
          leg1Payload.originLat = emergencyStartCoords.lat;
          leg1Payload.originLng = emergencyStartCoords.lng;
        }
        if (waypoint1Type === "ospedale" || waypoint1Type === "casa_di_riposo") {
          leg1Payload.destinationStructureId = waypoint1StructureId;
        } else if (waypoint1Type === "gps" && waypoint1Coords) {
          leg1Payload.destinationAddress = waypoint1Address;
          leg1Payload.destinationLat = waypoint1Coords.lat;
          leg1Payload.destinationLng = waypoint1Coords.lng;
          leg1Payload.destinationIsDomicilio = true;
        } else {
          leg1Payload.destinationAddress = waypoint1Address;
          leg1Payload.destinationIsDomicilio = waypoint1Type === "domicilio";
        }
        
        // Leg 2 or 3: Waypoint1 -> Waypoint2/Final
        const leg2Payload: any = {};
        if (waypoint1Type === "ospedale" || waypoint1Type === "casa_di_riposo") {
          leg2Payload.originStructureId = waypoint1StructureId;
        } else if (waypoint1Type === "gps" && waypoint1Coords) {
          leg2Payload.originAddress = waypoint1Address;
          leg2Payload.originLat = waypoint1Coords.lat;
          leg2Payload.originLng = waypoint1Coords.lng;
          leg2Payload.originIsDomicilio = true;
        } else {
          leg2Payload.originAddress = waypoint1Address;
          leg2Payload.originIsDomicilio = waypoint1Type === "domicilio";
        }
        
        let leg2Km = null;
        let leg3Km = null;
        
        if (hasWaypoint2) {
          // Leg 2: Waypoint1 -> Waypoint2
          if (waypoint2Type === "ospedale" || waypoint2Type === "casa_di_riposo") {
            leg2Payload.destinationStructureId = waypoint2StructureId;
          } else {
            leg2Payload.destinationAddress = waypoint2Address;
            leg2Payload.destinationIsDomicilio = waypoint2Type === "domicilio";
          }
          
          // Leg 3: Waypoint2 -> Final
          const leg3Payload: any = {};
          if (waypoint2Type === "ospedale" || waypoint2Type === "casa_di_riposo") {
            leg3Payload.originStructureId = waypoint2StructureId;
          } else {
            leg3Payload.originAddress = waypoint2Address;
            leg3Payload.originIsDomicilio = waypoint2Type === "domicilio";
          }
          if (destinationType === "ospedale" || destinationType === "casa_di_riposo") {
            leg3Payload.destinationStructureId = destinationStructureId;
          } else if (destinationType === "sede") {
            leg3Payload.destinationAddress = locations?.find(l => l.id === user?.locationId)?.address || "Sede";
            leg3Payload.destinationIsDomicilio = false;
          } else {
            leg3Payload.destinationAddress = destinationAddress;
            leg3Payload.destinationIsDomicilio = destinationType === "domicilio";
          }
          
          // Make parallel requests for all legs
          const [res1, res2, res3] = await Promise.all([
            fetch(new URL("/api/distance", apiUrl).toString(), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(leg1Payload),
            }),
            fetch(new URL("/api/distance", apiUrl).toString(), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(leg2Payload),
            }),
            fetch(new URL("/api/distance", apiUrl).toString(), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(leg3Payload),
            }),
          ]);
          
          const [data1, data2, data3] = await Promise.all([
            res1.ok ? res1.json() : { distanceKm: null },
            res2.ok ? res2.json() : { distanceKm: null },
            res3.ok ? res3.json() : { distanceKm: null },
          ]);
          
          setWaypointKmBreakdown({
            leg1: data1.distanceKm,
            leg2: data2.distanceKm,
            leg3: data3.distanceKm,
          });
          
          const totalKm = (data1.distanceKm || 0) + (data2.distanceKm || 0) + (data3.distanceKm || 0);
          if (totalKm > 0) {
            const initialKm = parseInt(kmInitial);
            if (!isNaN(initialKm)) {
              setKmFinal((initialKm + totalKm).toString());
              setCalculatedDistance(totalKm);
            }
          }
        } else {
          // Only 2 legs: Start -> Waypoint1 -> Final
          if (destinationType === "ospedale" || destinationType === "casa_di_riposo") {
            leg2Payload.destinationStructureId = destinationStructureId;
          } else if (destinationType === "sede") {
            leg2Payload.destinationAddress = locations?.find(l => l.id === user?.locationId)?.address || "Sede";
            leg2Payload.destinationIsDomicilio = false;
          } else {
            leg2Payload.destinationAddress = destinationAddress;
            leg2Payload.destinationIsDomicilio = destinationType === "domicilio";
          }
          
          const [res1, res2] = await Promise.all([
            fetch(new URL("/api/distance", apiUrl).toString(), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(leg1Payload),
            }),
            fetch(new URL("/api/distance", apiUrl).toString(), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(leg2Payload),
            }),
          ]);
          
          const [data1, data2] = await Promise.all([
            res1.ok ? res1.json() : { distanceKm: null },
            res2.ok ? res2.json() : { distanceKm: null },
          ]);
          
          console.log("Distance calc results (2 legs):", { data1, data2, res1ok: res1.ok, res2ok: res2.ok });
          
          setWaypointKmBreakdown({
            leg1: data1.distanceKm,
            leg2: null,
            leg3: data2.distanceKm,
          });
          
          const totalKm = (data1.distanceKm || 0) + (data2.distanceKm || 0);
          console.log("Total km calculated:", totalKm);
          if (totalKm > 0) {
            const initialKm = parseInt(kmInitial);
            if (!isNaN(initialKm)) {
              setKmFinal((initialKm + totalKm).toString());
              setCalculatedDistance(totalKm);
            }
          }
        }
      } catch (error) {
        console.error("Waypoint distance calculation error:", error);
      } finally {
        setIsCalculatingWaypointKm(false);
      }
    };
    
    const timeoutId = setTimeout(calculateWaypointDistances, 800);
    return () => clearTimeout(timeoutId);
  }, [isEmergencyService, waypoint1Type, waypoint1StructureId, waypoint1Address, 
      waypoint2Type, waypoint2StructureId, waypoint2Address,
      destinationType, destinationStructureId, destinationAddress, 
      kmInitial, kmManuallyEdited, locations, user?.locationId, emergencyStartType, emergencyStartAddress, emergencyStartCoords, waypoint1Coords]);

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

  // Get current GPS location and reverse geocode to address
  const getCurrentGpsLocation = async () => {
    if (Platform.OS === "web") {
      Alert.alert("GPS non disponibile", "Usa l'app Expo Go sul telefono per usare il GPS");
      return;
    }
    
    setIsGettingGpsLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permesso negato", "È necessario il permesso di localizzazione per usare questa funzione");
        return;
      }
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      
      const { latitude, longitude } = location.coords;
      setEmergencyStartCoords({ lat: latitude, lng: longitude });
      
      // Reverse geocode to get address
      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });
      
      if (reverseGeocode && reverseGeocode.length > 0) {
        const addr = reverseGeocode[0];
        const parts = [];
        // Privacy: exclude street number (civic number)
        if (addr.street) parts.push(addr.street);
        if (addr.city) parts.push(addr.city);
        // Use province abbreviation instead of region name
        const provinceCode = getProvinceCode(addr.city, addr.region);
        if (provinceCode) parts.push(`(${provinceCode})`);
        
        const formattedAddress = parts.join(", ");
        setEmergencyStartAddress(formattedAddress);
        setEmergencyStartType("gps");
        
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } else {
        setEmergencyStartAddress(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        setEmergencyStartType("gps");
      }
    } catch (error) {
      console.error("GPS error:", error);
      Alert.alert("Errore GPS", "Impossibile ottenere la posizione corrente");
    } finally {
      setIsGettingGpsLocation(false);
    }
  };

  // Get GPS location for waypoint1 (Luogo Intervento)
  const getWaypoint1GpsLocation = async () => {
    if (Platform.OS === "web") {
      Alert.alert("GPS non disponibile", "Usa l'app Expo Go sul telefono per usare il GPS");
      return;
    }
    
    setIsGettingWaypoint1Gps(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permesso negato", "È necessario il permesso di localizzazione per usare questa funzione");
        return;
      }
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      
      const { latitude, longitude } = location.coords;
      setWaypoint1Coords({ lat: latitude, lng: longitude });
      
      // Reverse geocode to get address
      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });
      
      if (reverseGeocode && reverseGeocode.length > 0) {
        const addr = reverseGeocode[0];
        const parts = [];
        // Privacy: exclude street number (civic number)
        if (addr.street) parts.push(addr.street);
        if (addr.city) parts.push(addr.city);
        // Use province abbreviation instead of region name
        const provinceCode = getProvinceCode(addr.city, addr.region);
        if (provinceCode) parts.push(`(${provinceCode})`);
        
        const formattedAddress = parts.join(", ");
        setWaypoint1Address(formattedAddress);
        setWaypoint1Type("gps");
        
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } else {
        setWaypoint1Address(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        setWaypoint1Type("gps");
      }
    } catch (error) {
      console.error("GPS error:", error);
      Alert.alert("Errore GPS", "Impossibile ottenere la posizione corrente");
    } finally {
      setIsGettingWaypoint1Gps(false);
    }
  };

  const resetForm = () => {
    const newInitialKm = kmFinal || kmInitial;
    setServiceNumber("");
    setIsReturnTrip(false);
    setIsEmergencyService(false);
    setCrewType("autista_soccorritore"); // Reset to default crew type
    setServiceDate(new Date());
    setDepartureTime(null);
    setReturnTime(null);
    setPatientBirthYear("");
    setPatientGender("");
    setOriginType("ospedale");
    setOriginStructureId("");
    setOriginDepartmentId("");
    setOriginAddress("");
    setDestinationType("ospedale");
    setDestinationStructureId("");
    setDestinationDepartmentId("");
    setDestinationAddress("");
    // Reset waypoints and emergency start
    setEmergencyStartType("sede");
    setEmergencyStartAddress("");
    setEmergencyStartCoords(null);
    setWaypoint1Type("domicilio");
    setWaypoint1StructureId("");
    setWaypoint1DepartmentId("");
    setWaypoint1Address("");
    setWaypoint1Coords(null);
    setWaypoint2Type("ospedale");
    setWaypoint2StructureId("");
    setWaypoint2DepartmentId("");
    setWaypoint2Address("");
    setWaypointKmBreakdown({leg1: null, leg2: null, leg3: null});
    setKmInitial(newInitialKm);
    setKmFinal("");
    setNotes("");
    setCalculatedDistance(null);
    setKmManuallyEdited(false);
    setDeviceAuthEnabled(false);
    setAuthorizerType("medico_bordo");
    setAuthorizerName("");
    setSignatureData(null);
    AsyncStorage.removeItem(TRIP_DRAFT_KEY).catch(() => {});
  };

  const getValidationWarnings = (): string[] => {
    const warnings: string[] = [];
    
    if (calculatedDistance && kmTraveled) {
      const difference = Math.abs(kmTraveled - calculatedDistance);
      const percentDiff = (difference / calculatedDistance) * 100;
      if (percentDiff > 50 && difference > 10) {
        warnings.push(`I km percorsi (${kmTraveled}) differiscono molto dalla distanza calcolata (${calculatedDistance} km)`);
      }
    }
    
    if (kmTraveled > 200) {
      warnings.push(`I km percorsi (${kmTraveled}) sono molto elevati per un singolo servizio`);
    }
    
    if (duration !== null) {
      if (duration < 10 && kmTraveled > 5) {
        warnings.push(`La durata (${duration} min) sembra breve per ${kmTraveled} km`);
      }
      if (duration > 0 && kmTraveled > 0) {
        const avgSpeed = (kmTraveled / duration) * 60;
        if (avgSpeed > 100) {
          warnings.push(`La velocità media risulta troppo alta (${Math.round(avgSpeed)} km/h)`);
        }
        if (avgSpeed < 10 && kmTraveled > 10) {
          warnings.push(`La velocità media risulta molto bassa (${Math.round(avgSpeed)} km/h)`);
        }
      }
      if (duration > 480) {
        warnings.push(`La durata (${Math.round(duration / 60)} ore) è molto lunga`);
      }
    }
    
    return warnings;
  };

  const submitTrip = async () => {
    setIsSubmitting(true);
    
    // Build waypoints array for emergency services
    const waypoints = [];
    if (isEmergencyService) {
      // Waypoint 1: Luogo Intervento
      const hasWaypoint1 = waypoint1Type === "ospedale" || waypoint1Type === "casa_di_riposo"
        ? !!waypoint1StructureId
        : waypoint1Type === "gps"
          ? !!waypoint1Address && !!waypoint1Coords
          : !!waypoint1Address;
      if (hasWaypoint1) {
        waypoints.push({
          waypointOrder: 1,
          waypointType: "luogo_intervento",
          locationType: waypoint1Type,
          structureId: waypoint1StructureId || null,
          departmentId: waypoint1DepartmentId || null,
          address: waypoint1Address || null,
          kmFromPrevious: waypointKmBreakdown.leg1,
        });
      }
      
      // Waypoint 2: Destinazione Intermedia (optional)
      const hasWaypoint2 = waypoint2Type === "ospedale" || waypoint2Type === "casa_di_riposo"
        ? !!waypoint2StructureId
        : !!waypoint2Address;
      if (hasWaypoint2) {
        waypoints.push({
          waypointOrder: 2,
          waypointType: "destinazione_intermedia",
          locationType: waypoint2Type,
          structureId: waypoint2StructureId || null,
          departmentId: waypoint2DepartmentId || null,
          address: waypoint2Address || null,
          kmFromPrevious: waypointKmBreakdown.leg2,
        });
      }
    }
    
    const tripData = {
      progressiveNumber: serviceNumber.trim(),
      vehicleId: selectedVehicle?.id,
      userId: user?.id,
      serviceDate: serviceDate.toISOString().split("T")[0],
      departureTime: departureTime ? formatTimeItalian(departureTime) : null,
      returnTime: returnTime ? formatTimeItalian(returnTime) : null,
      patientBirthYear: patientBirthYear ? parseInt(patientBirthYear) : null,
      patientGender: patientGender || null,
      originType: isEmergencyService ? (emergencyStartType === "gps" ? "domicilio" : "sede") : originType,
      originStructureId: isEmergencyService ? null : (originStructureId || null),
      originDepartmentId: isEmergencyService ? null : (originDepartmentId || null),
      originAddress: isEmergencyService 
        ? (emergencyStartType === "gps" && emergencyStartAddress 
            ? emergencyStartAddress 
            : (locations?.find(l => l.id === user?.locationId)?.address || "Sede")) 
        : (originType === "sede" 
            ? (locations?.find(l => l.id === (originStructureId || user?.locationId))?.address || originAddress || null)
            : (originAddress || null)),
      destinationType,
      destinationStructureId: destinationStructureId || null,
      destinationDepartmentId: destinationDepartmentId || null,
      destinationAddress: destinationType === "sede"
        ? (locations?.find(l => l.id === (destinationStructureId || user?.locationId))?.address || destinationAddress || null)
        : (destinationAddress || null),
      kmInitial: parseInt(kmInitial),
      kmFinal: parseInt(kmFinal),
      kmTraveled,
      durationMinutes: duration,
      isReturnTrip,
      serviceType: isEmergencyService ? "emergenza" : serviceType,
      crewType,
      notes: notes || null,
      isEmergencyService,
      totalWaypointKm: isEmergencyService ? kmTraveled : null,
      waypoints: isEmergencyService ? waypoints : [],
      deviceAuthorization: deviceAuthEnabled ? {
        authorizerType,
        authorizerName: authorizerName || null,
        signatureData: signatureData || null,
      } : null,
    };
    
    try {
      const result = await submitTripOffline(tripData, {
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
          queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
          AsyncStorage.removeItem(TRIP_DRAFT_KEY).catch(() => {});
          resetForm();
          Alert.alert("Successo", "Viaggio salvato con successo!");
        },
        onError: (error: any) => {
          Alert.alert("Errore", error.message || "Errore durante il salvataggio");
        },
      });
      
      if (result.queued) {
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
        resetForm();
        Alert.alert(
          "Salvato offline",
          "Sei offline. Il viaggio è stato salvato localmente e verrà sincronizzato quando tornerà la connessione."
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

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

    if (deviceAuthEnabled && authorizerType !== "centrale_operativa") {
      if (!authorizerName.trim()) {
        Alert.alert("Errore", "Inserisci il nome di chi autorizza l'uso dei dispositivi");
        return;
      }
      if (!signatureData) {
        Alert.alert("Errore", "La firma dell'autorizzatore e obbligatoria");
        return;
      }
    }

    const warnings = getValidationWarnings();
    
    if (warnings.length > 0) {
      Alert.alert(
        "Attenzione",
        `Sono stati rilevati alcuni dati anomali:\n\n${warnings.map(w => `• ${w}`).join("\n")}\n\nVuoi salvare comunque?`,
        [
          { text: "Annulla", style: "cancel" },
          { text: "Salva comunque", onPress: submitTrip },
        ]
      );
      return;
    }

    submitTrip();
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
      const sedeLocation = locations?.find(l => l.id === (originStructureId || user?.locationId));
      return sedeLocation?.name ? `Sede ${sedeLocation.name}` : typeName;
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
      const sedeLocation = locations?.find(l => l.id === (destinationStructureId || user?.locationId));
      return sedeLocation?.name ? `Sede ${sedeLocation.name}` : typeName;
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

  const getFormCompletion = () => {
    const requiredFields = [
      { name: "Data", filled: !!serviceDate },
      { name: "Ora partenza", filled: !!departureTime },
      { name: "Ora arrivo", filled: !!returnTime },
      { name: "Origine", filled: originType === "sede" || (originType === "ospedale" || originType === "casa_di_riposo" ? !!originStructureId : !!originAddress) },
      { name: "Destinazione", filled: destinationType === "sede" || (destinationType === "ospedale" || destinationType === "casa_di_riposo" ? !!destinationStructureId : !!destinationAddress) },
      { name: "Km iniziali", filled: !!kmInitial },
      { name: "Km finali", filled: !!kmFinal },
    ];
    
    if (!isReturnTrip) {
      requiredFields.unshift(
        { name: "Numero servizio", filled: !!serviceNumber.trim() },
        { name: "Anno nascita paziente", filled: !!patientBirthYear },
        { name: "Sesso paziente", filled: !!patientGender }
      );
    }
    
    const requiredFilled = requiredFields.filter(f => f.filled).length;
    
    return {
      percentage: Math.round((requiredFilled / requiredFields.length) * 100),
      requiredComplete: requiredFilled === requiredFields.length,
      requiredFilled,
      requiredTotal: requiredFields.length,
    };
  };

  const formCompletion = getFormCompletion();

  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: insets.top + Spacing.md,
        paddingBottom: tabBarHeight + Spacing["2xl"],
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      <AnnouncementBanner />
      
      <View style={styles.screenTitleCentered}>
        <ThemedText type="h2" style={styles.screenTitleCenter}>Nuovo Servizio</ThemedText>
      </View>

      <View style={[styles.completionCard, { backgroundColor: theme.cardBackground }]}>
        <View style={styles.completionHeader}>
          <View style={styles.completionInfo}>
            <Feather 
              name={formCompletion.requiredComplete ? "check-circle" : "edit-3"} 
              size={16} 
              color={formCompletion.requiredComplete ? theme.success : theme.primary} 
            />
            <ThemedText type="small" style={{ marginLeft: 6, color: theme.textSecondary }}>
              Completamento modulo
            </ThemedText>
          </View>
          <View style={[styles.completionBadge, { 
            backgroundColor: formCompletion.percentage === 100 ? theme.successLight : 
                            formCompletion.requiredComplete ? theme.primaryLight : theme.warningLight 
          }]}>
            <ThemedText type="small" style={{ 
              fontWeight: "600", 
              color: formCompletion.percentage === 100 ? theme.success : 
                     formCompletion.requiredComplete ? theme.primary : theme.warning 
            }}>
              {formCompletion.percentage}%
            </ThemedText>
          </View>
        </View>
        <View style={[styles.progressBarContainer, { backgroundColor: theme.border }]}>
          <View 
            style={[
              styles.progressBar, 
              { 
                width: `${formCompletion.percentage}%`,
                backgroundColor: formCompletion.percentage === 100 ? theme.success : 
                                 formCompletion.requiredComplete ? theme.primary : theme.warning 
              }
            ]} 
          />
        </View>
        <View style={styles.completionDetails}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            Campi compilati: {formCompletion.requiredFilled}/{formCompletion.requiredTotal}
          </ThemedText>
        </View>
      </View>

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

      <Pressable
        style={[styles.returnTripCard, { 
          backgroundColor: isReturnTrip ? theme.primaryLight : theme.cardBackground,
          borderColor: isReturnTrip ? theme.primary : "transparent"
        }]}
        android_ripple={{ color: 'transparent' }}
        onPress={() => {
          if (Platform.OS !== "web") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          const newValue = !isReturnTrip;
          setIsReturnTrip(newValue);
          if (newValue) {
            setIsEmergencyService(false);
            setCrewType("autista_soccorritore");
          }
        }}
      >
        <View style={styles.returnTripContent}>
          <View style={[styles.returnTripIcon, { backgroundColor: isReturnTrip ? theme.primary : theme.backgroundSecondary }]}>
            <Feather name="rotate-ccw" size={18} color={isReturnTrip ? "#FFFFFF" : theme.textSecondary} />
          </View>
          <View style={styles.returnTripText}>
            <ThemedText type="body" style={{ fontWeight: "600" }}>SENZA PAZIENTE</ThemedText>
          </View>
        </View>
        <Switch
          value={isReturnTrip}
          onValueChange={(value) => {
            if (Platform.OS !== "web") {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            setIsReturnTrip(value);
            if (value) {
              setIsEmergencyService(false);
              setCrewType("autista_soccorritore");
            }
          }}
          trackColor={{ false: theme.border, true: theme.primary }}
          thumbColor="#FFFFFF"
        />
      </Pressable>

      {/* Emergency Service Toggle - for multi-stop emergency trips */}
      {!isReturnTrip ? (
        <Pressable
          style={[styles.returnTripCard, { 
            backgroundColor: isEmergencyService ? "#DC354520" : theme.cardBackground,
            borderColor: isEmergencyService ? "#DC3545" : "transparent",
            marginTop: 8,
          }]}
          android_ripple={{ color: 'transparent' }}
          onPress={() => {
            if (Platform.OS !== "web") {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
            const newValue = !isEmergencyService;
            setIsEmergencyService(newValue);
            if (newValue) {
              // When enabling emergency, set origin to sede and crew to autista+infermiere
              setOriginType("sede");
              setCrewType("autista_infermiere");
            } else {
              // When disabling emergency, reset crew to default
              setCrewType("autista_soccorritore");
            }
          }}
        >
          <View style={styles.returnTripContent}>
            <View style={[styles.returnTripIcon, { backgroundColor: isEmergencyService ? "#DC3545" : theme.backgroundSecondary }]}>
              <Feather name="zap" size={18} color={isEmergencyService ? "#FFFFFF" : "#DC3545"} />
            </View>
            <View style={styles.returnTripText}>
              <ThemedText type="body" style={{ fontWeight: "600", color: isEmergencyService ? "#DC3545" : theme.text }}>SERVIZIO EMERGENZA</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 2 }}>
                Con tappe intermedie (Sede → Intervento → Destinazione)
              </ThemedText>
            </View>
          </View>
          <Switch
            value={isEmergencyService}
            onValueChange={(value) => {
              if (Platform.OS !== "web") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }
              setIsEmergencyService(value);
              if (value) {
                setOriginType("sede");
                setCrewType("autista_infermiere");
              } else {
                // When disabling emergency, reset crew to default
                setCrewType("autista_soccorritore");
              }
            }}
            trackColor={{ false: theme.border, true: "#DC3545" }}
            thumbColor="#FFFFFF"
          />
        </Pressable>
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
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              style={{ 
                marginLeft: 8,
                color: crewType === "autista_soccorritore" ? theme.primary : theme.text,
                fontWeight: crewType === "autista_soccorritore" ? "600" : "400",
                flexShrink: 1,
                fontSize: 14,
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
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              style={{ 
                marginLeft: 8,
                color: crewType === "autista_infermiere" ? theme.primary : theme.text,
                fontWeight: crewType === "autista_infermiere" ? "600" : "400",
                flexShrink: 1,
                fontSize: 14,
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

      {/* Service Type Selector - hidden when SENZA PAZIENTE or EMERGENZA is selected */}
      {!isReturnTrip && !isEmergencyService ? (
        <View style={styles.section}>
          <SectionHeader icon="tag" title="Tipo Servizio" />
        <View style={styles.serviceTypeGrid}>
          <View style={styles.serviceTypeRow}>
            {[
              { value: "dimissione", label: "Dimissione", icon: "log-out" },
              { value: "visita", label: "Visita", icon: "activity" },
              { value: "trasferimento", label: "Trasferimento", icon: "repeat" },
            ].map((type) => (
              <Pressable
                key={type.value}
                style={[
                  styles.serviceTypeOption,
                  { 
                    backgroundColor: serviceType === type.value ? "#0066CC" : theme.cardBackground,
                    borderColor: serviceType === type.value ? "#0066CC" : theme.border,
                  }
                ]}
                onPress={() => {
                  if (Platform.OS !== "web") {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  setServiceType(type.value);
                }}
              >
                <Feather 
                  name={type.icon as any} 
                  size={18} 
                  color={serviceType === type.value ? "#FFFFFF" : theme.textSecondary} 
                />
                <ThemedText 
                  type="small" 
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  style={{ 
                    color: serviceType === type.value ? "#FFFFFF" : theme.text,
                    fontWeight: serviceType === type.value ? "600" : "400",
                    marginLeft: 4,
                    fontSize: 11,
                    flexShrink: 1,
                  }}
                >
                  {type.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
          <View style={styles.serviceTypeRow}>
            {/* Dialisi */}
            <Pressable
              style={[
                styles.serviceTypeOption,
                { 
                  backgroundColor: serviceType === "dialisi" ? "#0066CC" : theme.cardBackground,
                  borderColor: serviceType === "dialisi" ? "#0066CC" : theme.border,
                }
              ]}
              onPress={() => {
                if (Platform.OS !== "web") {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                setServiceType("dialisi");
              }}
            >
              <Feather 
                name="droplet" 
                size={16} 
                color={serviceType === "dialisi" ? "#FFFFFF" : theme.textSecondary} 
              />
              <ThemedText 
                type="small" 
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                style={{ 
                  color: serviceType === "dialisi" ? "#FFFFFF" : theme.text,
                  fontWeight: serviceType === "dialisi" ? "600" : "400",
                  marginLeft: 4,
                  fontSize: 11,
                  flexShrink: 1,
                }}
              >
                Dialisi
              </ThemedText>
            </Pressable>
          </View>
        </View>
        </View>
      ) : null}

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
                    style={{ height: 200 }}
                    textColor={isDark ? "#FFFFFF" : "#000000"}
                  />
                  <Pressable 
                    style={[styles.confirmButton, { backgroundColor: theme.primary }]}
                    onPress={() => {
                      setServiceDate(tempDate);
                      setShowDatePicker(false);
                    }}
                  >
                    <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                      Conferma
                    </ThemedText>
                  </Pressable>
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
              <Feather name="chevron-right" size={20} color={theme.textSecondary} />
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

        {/* Festivo + Meteo previsionale per la data selezionata */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: Spacing.xs }}>
          <HolidayChip date={serviceDate} />
          {formUserCoords && (
            <WeatherBadge lat={formUserCoords.lat} lon={formUserCoords.lon} compact />
          )}
        </View>

        <View style={styles.timeRow}>
          <View style={styles.halfInput}>
            {Platform.OS === "web" ? (
              <TextInput
                label="Ora Inizio"
                placeholder="HH:MM"
                value={departureTime ? formatTimeItalian(departureTime) : ""}
                onChangeText={(text) => {
                  const parts = text.split(":");
                  if (parts.length === 2) {
                    const hours = parseInt(parts[0]);
                    const mins = parseInt(parts[1]);
                    if (!isNaN(hours) && !isNaN(mins)) {
                      const date = new Date();
                      date.setHours(hours, mins);
                      setDepartureTime(date);
                    }
                  }
                }}
              />
            ) : Platform.OS === "ios" ? (
              <>
                <Pressable 
                  style={[styles.timeCard, { backgroundColor: theme.cardBackground }]}
                  onPress={() => {
                    setTempDepartureTime(departureTime || new Date());
                    setShowDepartureTimePicker(true);
                  }}
                >
                  <Feather name="log-out" size={16} color={theme.primary} />
                  <View style={styles.timeContent}>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>Inizio</ThemedText>
                    <ThemedText type="body" style={{ fontWeight: "500", color: departureTime ? theme.text : theme.textSecondary }}>
                      {departureTime ? formatTimeItalian(departureTime) : "HH:MM"}
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
                        is24Hour={true}
                        style={{ height: 200 }}
                        textColor={isDark ? "#FFFFFF" : "#000000"}
                      />
                      <Pressable 
                        style={[styles.confirmButton, { backgroundColor: theme.primary }]}
                        onPress={() => {
                          setDepartureTime(tempDepartureTime);
                          setShowDepartureTimePicker(false);
                        }}
                      >
                        <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                          Conferma
                        </ThemedText>
                      </Pressable>
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
                  <Feather name="log-out" size={16} color={theme.primary} />
                  <View style={styles.timeContent}>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>Inizio</ThemedText>
                    <ThemedText type="body" style={{ fontWeight: "500", color: departureTime ? theme.text : theme.textSecondary }}>
                      {departureTime ? formatTimeItalian(departureTime) : "HH:MM"}
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
                    is24Hour={true}
                  />
                ) : null}
              </>
            )}
          </View>
          <View style={styles.halfInput}>
            {Platform.OS === "web" ? (
              <TextInput
                label="Ora Fine"
                placeholder="HH:MM"
                value={returnTime ? formatTimeItalian(returnTime) : ""}
                onChangeText={(text) => {
                  const parts = text.split(":");
                  if (parts.length === 2) {
                    const hours = parseInt(parts[0]);
                    const mins = parseInt(parts[1]);
                    if (!isNaN(hours) && !isNaN(mins)) {
                      const date = new Date();
                      date.setHours(hours, mins);
                      setReturnTime(date);
                    }
                  }
                }}
              />
            ) : Platform.OS === "ios" ? (
              <>
                <Pressable 
                  style={[styles.timeCard, { backgroundColor: theme.cardBackground }]}
                  onPress={() => {
                    setTempReturnTime(returnTime || new Date());
                    setShowReturnTimePicker(true);
                  }}
                >
                  <Feather name="log-in" size={16} color={theme.success} />
                  <View style={styles.timeContent}>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>Fine</ThemedText>
                    <ThemedText type="body" style={{ fontWeight: "500", color: returnTime ? theme.text : theme.textSecondary }}>
                      {returnTime ? formatTimeItalian(returnTime) : "HH:MM"}
                    </ThemedText>
                  </View>
                </Pressable>
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
                        is24Hour={true}
                        style={{ height: 200 }}
                        textColor={isDark ? "#FFFFFF" : "#000000"}
                      />
                      <Pressable 
                        style={[styles.confirmButton, { backgroundColor: theme.primary }]}
                        onPress={() => {
                          setReturnTime(tempReturnTime);
                          setShowReturnTimePicker(false);
                        }}
                      >
                        <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                          Conferma
                        </ThemedText>
                      </Pressable>
                    </View>
                  </View>
                </Modal>
              </>
            ) : (
              <>
                <Pressable 
                  style={[styles.timeCard, { backgroundColor: theme.cardBackground }]}
                  onPress={() => setShowReturnTimePicker(true)}
                >
                  <Feather name="log-in" size={16} color={theme.success} />
                  <View style={styles.timeContent}>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>Fine</ThemedText>
                    <ThemedText type="body" style={{ fontWeight: "500", color: returnTime ? theme.text : theme.textSecondary }}>
                      {returnTime ? formatTimeItalian(returnTime) : "HH:MM"}
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
                    is24Hour={true}
                  />
                ) : null}
              </>
            )}
          </View>
        </View>

        {duration !== null ? (
          <View style={[styles.durationBadge, { backgroundColor: theme.successLight }]}>
            <Feather name="clock" size={14} color={theme.success} />
            <ThemedText type="small" style={{ color: theme.success, marginLeft: 6, fontWeight: "600" }}>
              Durata: {duration} min
            </ThemedText>
          </View>
        ) : null}
      </View>

      {!isReturnTrip ? (
        <View style={styles.section}>
          <SectionHeader icon="user" title="Paziente" />
          <TextInput
            label="Anno Nascita"
            placeholder="es. 1950"
            value={patientBirthYear}
            onChangeText={setPatientBirthYear}
            keyboardType="numeric"
          />
          <Pressable
            style={[styles.selectButton, { backgroundColor: theme.cardBackground }]}
            onPress={() => setShowGenderPicker(!showGenderPicker)}
          >
            <Feather name="users" size={16} color={theme.primary} />
            <View style={styles.selectButtonContent}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>Genere</ThemedText>
              <ThemedText type="body" style={{ fontWeight: "500" }}>
                {patientGender === "M" ? "Maschio" : patientGender === "F" ? "Femmina" : "Seleziona genere..."}
              </ThemedText>
            </View>
            <Feather name={showGenderPicker ? "chevron-up" : "chevron-down"} size={20} color={theme.textSecondary} />
          </Pressable>
          {showGenderPicker ? (
            <View style={[styles.inlinePickerContainer, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
              <Pressable
                style={[styles.genderOption, patientGender === "M" && { backgroundColor: theme.primaryLight }]}
                onPress={() => {
                  if (Platform.OS !== "web") {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  setPatientGender("M");
                  setShowGenderPicker(false);
                }}
              >
                <Feather name="user" size={18} color={patientGender === "M" ? theme.primary : theme.text} />
                <ThemedText style={[styles.genderOptionText, patientGender === "M" && { color: theme.primary, fontWeight: "600" }]}>
                  Maschio
                </ThemedText>
              </Pressable>
              <View style={[styles.genderDivider, { backgroundColor: theme.border }]} />
              <Pressable
                style={[styles.genderOption, patientGender === "F" && { backgroundColor: theme.primaryLight }]}
                onPress={() => {
                  if (Platform.OS !== "web") {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  setPatientGender("F");
                  setShowGenderPicker(false);
                }}
              >
                <Feather name="user" size={18} color={patientGender === "F" ? theme.primary : theme.text} />
                <ThemedText style={[styles.genderOptionText, patientGender === "F" && { color: theme.primary, fontWeight: "600" }]}>
                  Femmina
                </ThemedText>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader 
          icon="map-pin" 
          title={isEmergencyService ? "1. Inizio" : "Inizio"} 
        />
        {isEmergencyService ? (
          <>
            {/* Toggle between Sede and GPS */}
            <View style={styles.emergencyStartToggle}>
              <Pressable
                style={[
                  styles.emergencyStartOption,
                  { 
                    backgroundColor: emergencyStartType === "sede" ? "#DC354520" : theme.cardBackground,
                    borderColor: emergencyStartType === "sede" ? "#DC3545" : theme.border,
                  }
                ]}
                onPress={() => {
                  setEmergencyStartType("sede");
                  setEmergencyStartAddress("");
                  setEmergencyStartCoords(null);
                  if (Platform.OS !== "web") {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                }}
              >
                <Feather name="home" size={16} color={emergencyStartType === "sede" ? "#DC3545" : theme.textSecondary} />
                <ThemedText 
                  type="small" 
                  style={{ 
                    marginLeft: 6, 
                    color: emergencyStartType === "sede" ? "#DC3545" : theme.text,
                    fontWeight: emergencyStartType === "sede" ? "600" : "400",
                  }}
                >
                  Sede
                </ThemedText>
                {emergencyStartType === "sede" && (
                  <Feather name="check" size={14} color="#DC3545" style={{ marginLeft: 4 }} />
                )}
              </Pressable>
              
              <Pressable
                style={[
                  styles.emergencyStartOption,
                  { 
                    backgroundColor: emergencyStartType === "gps" ? "#0066CC20" : theme.cardBackground,
                    borderColor: emergencyStartType === "gps" ? "#0066CC" : theme.border,
                  }
                ]}
                onPress={getCurrentGpsLocation}
                disabled={isGettingGpsLocation}
              >
                {isGettingGpsLocation ? (
                  <ActivityIndicator size="small" color={isDark ? "#FFFFFF" : "#0066CC"} />
                ) : (
                  <Feather name="navigation" size={16} color={emergencyStartType === "gps" ? "#0066CC" : (isDark ? "#FFFFFF" : "#0066CC")} />
                )}
                <ThemedText 
                  type="small" 
                  style={{ 
                    marginLeft: 6, 
                    color: emergencyStartType === "gps" ? "#0066CC" : (isDark ? "#FFFFFF" : "#0066CC"),
                    fontWeight: emergencyStartType === "gps" ? "600" : "400",
                  }}
                >
                  {isGettingGpsLocation ? "Localizzando..." : "Usa GPS"}
                </ThemedText>
                {emergencyStartType === "gps" && !isGettingGpsLocation && (
                  <Feather name="check" size={14} color="#0066CC" style={{ marginLeft: 4 }} />
                )}
              </Pressable>
            </View>
            
            {/* Show current selection */}
            <View style={[styles.emergencyLocationLocked, { 
              backgroundColor: theme.cardBackground, 
              borderColor: emergencyStartType === "sede" ? "#DC354540" : "#0066CC40" 
            }]}>
              <View style={[styles.emergencyLocationIcon, { 
                backgroundColor: emergencyStartType === "sede" ? "#DC354520" : "#0066CC20" 
              }]}>
                <Feather 
                  name={emergencyStartType === "sede" ? "home" : "navigation"} 
                  size={18} 
                  color={emergencyStartType === "sede" ? "#DC3545" : "#0066CC"} 
                />
              </View>
              <View style={styles.emergencyLocationContent}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {emergencyStartType === "sede" ? "Inizio dalla sede" : "Posizione GPS"}
                </ThemedText>
                <ThemedText type="body" style={{ fontWeight: "600" }}>
                  {emergencyStartType === "sede" 
                    ? (locations?.find(l => l.id === user?.locationId)?.name || "Sede Operativa")
                    : (emergencyStartAddress || "Premi 'Usa GPS' per localizzare")}
                </ThemedText>
              </View>
              <View style={[styles.emergencyBadge, { 
                backgroundColor: emergencyStartType === "sede" ? "#DC3545" : "#0066CC" 
              }]}>
                <ThemedText type="small" style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 10 }}>
                  {emergencyStartType === "sede" ? "SEDE" : "GPS"}
                </ThemedText>
              </View>
            </View>
          </>
        ) : (
          <>
            <LocationTypeTabs 
              selectedType={originType} 
              onSelectType={(type) => {
                setOriginType(type);
                setOriginStructureId("");
                setOriginDepartmentId("");
                setOriginAddress("");
                setShowOriginPicker(true);
              }}
              sedeName={locations?.find(l => l.id === user?.locationId)?.name}
            />
            <SelectButton
              label="Luogo di Inizio"
              value={getOriginDisplayText()}
              placeholder="Seleziona partenza..."
              onPress={() => setShowOriginPicker(true)}
              icon="map-pin"
            />
          </>
        )}
      </View>

      {/* Waypoint 1 - Luogo Intervento (only for emergency services) */}
      {isEmergencyService ? (
        <View style={[styles.section, { borderLeftWidth: 3, borderLeftColor: "#DC3545", paddingLeft: Spacing.md }]}>
          <SectionHeader icon="alert-circle" title="2. Luogo Intervento" />
          <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm, flexWrap: "wrap" }}>
            <View style={{ flex: 1, minWidth: 200 }}>
              <InterventionLocationTabs
                selectedType={waypoint1Type}
                isLoading={isGettingWaypoint1Gps}
                onSelectType={(type) => {
                  if (type === "gps") {
                    getWaypoint1GpsLocation();
                  } else {
                    setWaypoint1Type(type);
                    setWaypoint1StructureId("");
                    setWaypoint1DepartmentId("");
                    setWaypoint1Address("");
                    setWaypoint1Coords(null);
                    if (type !== "domicilio") {
                      setShowWaypoint1Picker(true);
                    }
                  }
                }}
              />
            </View>
            <What3WordsInput
              onResolve={(coords, address, w3wAddr) => {
                setWaypoint1Type("gps");
                setWaypoint1Coords(coords);
                setWaypoint1Address(address);
              }}
            />
          </View>
          {waypoint1Type === "gps" && waypoint1Address ? (
            <View style={[styles.emergencyLocationLocked, { 
              backgroundColor: theme.cardBackground, 
              borderColor: "#0066CC40" 
            }]}>
              <View style={[styles.emergencyLocationIcon, { backgroundColor: "#0066CC20" }]}>
                <Feather name="navigation" size={18} color="#0066CC" />
              </View>
              <View style={styles.emergencyLocationContent}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Posizione GPS</ThemedText>
                <ThemedText type="body" style={{ fontWeight: "600" }}>{waypoint1Address}</ThemedText>
              </View>
              <View style={[styles.emergencyBadge, { backgroundColor: "#0066CC" }]}>
                <ThemedText type="small" style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 10 }}>GPS</ThemedText>
              </View>
            </View>
          ) : (
            <SelectButton
              label="Dove è avvenuto l'intervento"
              value={
                waypoint1Type === "ospedale" || waypoint1Type === "casa_di_riposo"
                  ? structures?.find(s => s.id === waypoint1StructureId)?.name || ""
                  : waypoint1Address
              }
              placeholder={waypoint1Type === "domicilio" ? "Inserisci indirizzo intervento..." : "Seleziona luogo intervento..."}
              onPress={() => {
                if (waypoint1Type === "domicilio") {
                  setShowWaypoint1Picker(true);
                } else {
                  setShowWaypoint1Picker(true);
                }
              }}
              icon="alert-circle"
            />
          )}
          {waypointKmBreakdown.leg1 !== null ? (
            <View style={[styles.legKmBadge, { backgroundColor: "#DC354520" }]}>
              <Feather name="arrow-right" size={12} color="#DC3545" />
              <ThemedText type="small" style={{ color: "#DC3545", marginLeft: 4, fontWeight: "600" }}>
                Inizio → Intervento: {waypointKmBreakdown.leg1} km
              </ThemedText>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Waypoint 2 - Destinazione Intermedia (optional, only for emergency services) */}
      {isEmergencyService ? (
        <View style={[styles.section, { borderLeftWidth: 3, borderLeftColor: "#FF9800", paddingLeft: Spacing.md }]}>
          <SectionHeader icon="navigation" title="3. Destinazione Intermedia (opzionale)" />
          <LocationTypeTabs 
            selectedType={waypoint2Type} 
            onSelectType={(type) => {
              setWaypoint2Type(type);
              setWaypoint2StructureId("");
              setWaypoint2DepartmentId("");
              setWaypoint2Address("");
              setShowWaypoint2Picker(true);
            }}
            sedeName={locations?.find(l => l.id === user?.locationId)?.name}
          />
          <SelectButton
            label="Tappa intermedia (se presente)"
            value={
              waypoint2Type === "sede" 
                ? locations?.find(l => l.id === user?.locationId)?.name || "Sede"
                : waypoint2Type === "ospedale" || waypoint2Type === "casa_di_riposo"
                  ? structures?.find(s => s.id === waypoint2StructureId)?.name || ""
                  : waypoint2Address
            }
            placeholder="Seleziona destinazione intermedia..."
            onPress={() => setShowWaypoint2Picker(true)}
            icon="navigation"
          />
          {waypointKmBreakdown.leg2 !== null ? (
            <View style={[styles.legKmBadge, { backgroundColor: "#FF980020" }]}>
              <Feather name="arrow-right" size={12} color="#FF9800" />
              <ThemedText type="small" style={{ color: "#FF9800", marginLeft: 4, fontWeight: "600" }}>
                Intervento → Intermedia: {waypointKmBreakdown.leg2} km
              </ThemedText>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader 
          icon="flag" 
          title={isEmergencyService ? "4. Destinazione Finale" : "Destinazione"} 
        />
        <LocationTypeTabs 
          selectedType={destinationType} 
          onSelectType={(type) => {
            setDestinationType(type);
            setDestinationStructureId("");
            setDestinationDepartmentId("");
            setDestinationAddress("");
            setShowDestPicker(true);
          }}
          sedeName={locations?.find(l => l.id === user?.locationId)?.name}
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
        <TextInput
          label="Km Iniziali"
          placeholder="es. 417945"
          value={kmInitial}
          onChangeText={setKmInitial}
          keyboardType="numeric"
        />
        <View style={styles.kmFinalContainer}>
          <TextInput
            label={isCalculatingDistance ? "Km Finali (calcolo...)" : "Km Finali"}
            placeholder="es. 417970"
            value={kmFinal}
            onChangeText={(text) => {
              setKmFinal(text);
              setKmManuallyEdited(true);
            }}
            keyboardType="numeric"
          />
          {isCalculatingDistance ? (
            <View style={styles.kmLoadingIndicator}>
              <ActivityIndicator size="small" color={theme.primary} />
            </View>
          ) : null}
        </View>

        {calculatedDistance !== null && !kmManuallyEdited ? (
          <View style={[styles.calculatedBadge, { backgroundColor: theme.successLight }]}>
            <Feather name="zap" size={14} color={theme.success} />
            <ThemedText type="small" style={{ color: theme.success, marginLeft: 6, fontWeight: "600" }}>
              +{calculatedDistance} km calcolati automaticamente
            </ThemedText>
          </View>
        ) : null}

        {kmManuallyEdited ? (
          <Pressable 
            style={[styles.resetButton, { backgroundColor: theme.primaryLight }]}
            onPress={() => {
              setKmManuallyEdited(false);
              setKmFinal("");
            }}
          >
            <Feather name="refresh-cw" size={14} color={theme.primary} />
            <ThemedText type="small" style={{ color: theme.primary, marginLeft: 6, fontWeight: "500" }}>
              Ricalcola automaticamente
            </ThemedText>
          </Pressable>
        ) : null}

        <View style={[styles.kmResultCard, { backgroundColor: theme.cardBackground }]}>
          <View style={styles.kmResultContent}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>Km Percorsi</ThemedText>
            <ThemedText type="h2" style={{ color: theme.primary }}>
              {kmTraveled.toLocaleString("it-IT")} km
            </ThemedText>
          </View>
          <View style={[styles.kmResultIcon, { backgroundColor: theme.primaryLight }]}>
            <Feather name="trending-up" size={24} color={theme.primary} />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <TextInput
          label="Note (opzionale)"
          placeholder="Eventuali note aggiuntive..."
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          style={{ height: 80, textAlignVertical: "top", paddingTop: Spacing.md }}
        />
      </View>

      {(pendingCount > 0 || !isOnline) ? (
        <Pressable 
          style={[styles.offlineStatusCard, { backgroundColor: !isOnline ? theme.warning : theme.primaryLight }]}
          onPress={() => {
            if (isOnline && pendingCount > 0) {
              retrySync();
            }
          }}
        >
          <View style={styles.offlineStatusContent}>
            <Feather 
              name={!isOnline ? "wifi-off" : "clock"} 
              size={18} 
              color={!isOnline ? "#FFFFFF" : theme.primary} 
            />
            <View style={styles.offlineStatusText}>
              <ThemedText type="body" style={{ color: !isOnline ? "#FFFFFF" : theme.text, fontWeight: "600" }}>
                {!isOnline ? "Sei offline" : `${pendingCount} viaggi in coda`}
              </ThemedText>
              <ThemedText type="small" style={{ color: !isOnline ? "rgba(255,255,255,0.8)" : theme.textSecondary }}>
                {!isOnline 
                  ? "I viaggi saranno sincronizzati quando torni online" 
                  : isSyncing ? "Sincronizzazione in corso..." : "Tocca per sincronizzare"}
              </ThemedText>
            </View>
          </View>
          {isSyncing ? (
            <ActivityIndicator color={!isOnline ? "#FFFFFF" : theme.primary} size="small" />
          ) : null}
        </Pressable>
      ) : null}

      {hasEncryption ? (
        <View style={[styles.encryptionBadge, { backgroundColor: theme.successLight }]}>
          <Feather name="lock" size={14} color={theme.success} />
          <ThemedText type="small" style={{ color: theme.success, marginLeft: 6, fontWeight: "500" }}>
            Dati protetti con crittografia end-to-end
          </ThemedText>
        </View>
      ) : null}

      <View style={styles.buttonContainer}>
        <Pressable
          style={styles.submitButton}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <LinearGradient
            colors={["#00A651", "#008040"]}
            style={styles.submitButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Feather name={isOnline ? "send" : "save"} size={18} color="#FFFFFF" />
                <ThemedText style={styles.submitButtonText}>
                  {isOnline ? "Invia Foglio di Viaggio" : "Salva Offline"}
                </ThemedText>
              </>
            )}
          </LinearGradient>
        </Pressable>
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

      {/* Waypoint 1 - Luogo Intervento picker */}
      <LocationPickerModal
        visible={showWaypoint1Picker}
        onClose={() => setShowWaypoint1Picker(false)}
        title="Luogo Intervento"
        locationType={waypoint1Type}
        structureId={waypoint1StructureId}
        departmentId={waypoint1DepartmentId}
        address={waypoint1Address}
        structures={structures || []}
        departments={departments || []}
        locations={locations || []}
        onSelectType={setWaypoint1Type}
        onSelectStructure={setWaypoint1StructureId}
        onSelectDepartment={setWaypoint1DepartmentId}
        onChangeAddress={setWaypoint1Address}
        onConfirm={() => setShowWaypoint1Picker(false)}
        onAddCustomStructure={handleAddCustomStructure}
        onAddCustomDepartment={handleAddCustomDepartment}
        skipCategoryStep={true}
      />

      {/* Waypoint 2 - Destinazione Intermedia picker */}
      <LocationPickerModal
        visible={showWaypoint2Picker}
        onClose={() => setShowWaypoint2Picker(false)}
        title="Destinazione Intermedia"
        locationType={waypoint2Type}
        structureId={waypoint2StructureId}
        departmentId={waypoint2DepartmentId}
        address={waypoint2Address}
        structures={structures || []}
        departments={departments || []}
        locations={locations || []}
        onSelectType={setWaypoint2Type}
        onSelectStructure={setWaypoint2StructureId}
        onSelectDepartment={setWaypoint2DepartmentId}
        onChangeAddress={setWaypoint2Address}
        onConfirm={() => setShowWaypoint2Picker(false)}
        onAddCustomStructure={handleAddCustomStructure}
        onAddCustomDepartment={handleAddCustomDepartment}
        skipCategoryStep={true}
      />

      <PickerModal
        visible={showAuthTypePicker}
        onClose={() => setShowAuthTypePicker(false)}
        title="Chi autorizza"
        data={AUTHORIZER_TYPES}
        selectedValue={authorizerType}
        onSelect={(value) => {
          setAuthorizerType(value);
          setShowAuthTypePicker(false);
          if (value === "centrale_operativa") {
            setSignatureData(null);
            setAuthorizerName("");
          }
        }}
        labelKey="label"
        valueKey="value"
      />

    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  screenTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
    marginTop: Spacing.sm,
  },
  screenTitleCentered: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
    marginTop: Spacing.md,
  },
  screenTitleCenter: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  screenTitleIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: "700",
  },
  vehicleCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  vehicleBadge: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    shadowColor: "#0066CC",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  vehicleCode: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  vehicleDetails: {
    marginLeft: Spacing.lg,
    flex: 1,
  },
  vehiclePlate: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  vehicleInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: Spacing.md,
  },
  vehicleInfoItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  returnTripCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.xl,
    borderWidth: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  returnTripContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  returnTripIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  returnTripText: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  crewTypeContainer: {
    gap: Spacing.sm,
  },
  serviceTypeGrid: {
    gap: Spacing.sm,
  },
  serviceTypeRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  serviceTypeOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: 6,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    minWidth: 0,
  },
  crewTypeButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
  },
  section: {
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
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
  pickerCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  pickerIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  timeRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  halfInput: {
    flex: 1,
  },
  timeCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  timeContent: {
    marginLeft: Spacing.md,
  },
  durationBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  selectButtonCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  selectButtonIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  selectButtonContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  selectButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.sm,
  },
  inlinePickerContainer: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginTop: Spacing.xs,
    overflow: "hidden",
  },
  genderOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  genderOptionText: {
    fontSize: 15,
  },
  genderDivider: {
    height: 1,
  },
  kmFinalContainer: {
    position: "relative",
  },
  kmLoadingIndicator: {
    position: "absolute",
    right: Spacing.md,
    top: "50%",
    marginTop: -10,
  },
  calculatedBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  resetButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  kmResultCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  kmResultContent: {
    flex: 1,
  },
  kmResultIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonContainer: {
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  submitButton: {
    borderRadius: BorderRadius.full,
    overflow: "hidden",
    shadowColor: "#00A651",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 5,
  },
  submitButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 56,
    paddingHorizontal: Spacing.xl,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    marginLeft: Spacing.sm,
  },
  secondaryButton: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.full,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    paddingBottom: Spacing["2xl"],
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  confirmButton: {
    height: 48,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.lg,
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
  completionCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  completionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  completionInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  completionBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  progressBarContainer: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: Spacing.sm,
  },
  progressBar: {
    height: "100%",
    borderRadius: 3,
  },
  completionDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  offlineStatusCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  offlineStatusContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  offlineStatusText: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  encryptionBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  scannerButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  scannerButtonIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  scannerButtonContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  scannedDocsContainer: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  scannedDocItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  scannedDocThumb: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  scannedDocInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  removeDocButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  deviceAuthCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  deviceAuthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  deviceAuthInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  deviceAuthText: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  deviceAuthContent: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
    gap: Spacing.md,
  },
  authTypePicker: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  signatureSection: {
    marginTop: Spacing.sm,
  },
  signaturePreview: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.md,
  },
  signatureConfirmed: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  editSignatureButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  centraleNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  emergencyLocationLocked: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 2,
    borderStyle: "dashed",
  },
  emergencyLocationIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  emergencyLocationContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  emergencyBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  legKmBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.xs,
  },
  emergencyStartToggle: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  emergencyStartOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
  },
});
