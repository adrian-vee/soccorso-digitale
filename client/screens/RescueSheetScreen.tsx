import React, { useState, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  Dimensions,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Svg, { Path } from "react-native-svg";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl, getAuthToken } from "@/lib/query-client";

const { width: SCREEN_W } = Dimensions.get("window");
const IS_WEB = Platform.OS === ("web" as string);

const DISPATCH_CODES = [
  { code: "C", label: "Bianco", color: "#E0E0E0", textColor: "#333" },
  { code: "B", label: "Verde", color: "#00A651", textColor: "#FFF" },
  { code: "V", label: "Giallo", color: "#FFC107", textColor: "#333" },
  { code: "G", label: "Arancione", color: "#FF8C00", textColor: "#FFF" },
  { code: "R", label: "Rosso", color: "#DC3545", textColor: "#FFF" },
];

const MISSION_CODES = ["0", "1", "2", "3", "4"];

const LUOGO_OPTIONS = [
  { key: "casa", label: "CASA", code: "K" },
  { key: "strada", label: "STRADA", code: "S" },
  { key: "pubblici", label: "ES. PUBBLICI", code: "P" },
  { key: "sportivi", label: "IMP. SPORTIVI", code: "Y" },
  { key: "lavorativi", label: "IMP. LAVORATIVI", code: "L" },
  { key: "scuole", label: "SCUOLE", code: "Q" },
  { key: "protetta", label: "STRUTT. PROTETTA", code: "" },
  { key: "rv", label: "RENDEZ VOUS", code: "" },
  { key: "altro", label: "ALTRO", code: "Z" },
];

const RINVENIMENTO_OPTIONS = [
  "IN PIEDI", "SEDUTA", "PRONA", "SUPINA", "LATERALE DX", "LATERALE SX",
];

const PRESENTI_OPTIONS = [
  "112", "113", "PL", "VVF", "G.COST.", "CNSAS", "MMG", "MCA",
];

const MSA_OPTIONS = [
  { key: "attivata", label: "Attivata" },
  { key: "annullata", label: "Annullata" },
  { key: "non_disponibile", label: "Non disp." },
  { key: "accompagna", label: "Accompagna" },
  { key: "non_accompagna", label: "Non accomp." },
];

const EVENTO_MEDICO = ["Cardiov.", "Respirat.", "Neurol.", "Altro"];
const EVENTO_TRAUMATICO = ["Incid.strad.", "Caduta", "Aggress.", "Annegam.", "Folgoraz.", "Altro"];

const VALUTAZIONE_A_ITEMS = [
  "Incosciente", "Ostruzione vie aeree", "Arresto respiratorio",
  "Respiro difficoltoso", "Rumori respiratori", "Otorragia DX", "Otorragia SX", "Epistassi",
];

const VALUTAZIONE_B_ITEMS = [
  "Lesioni evidenti DX", "Lesioni evidenti SX", "Asimmetria torace DX", "Asimmetria torace SX",
];

const TRAUMA_ITEMS = [
  "1 Trauma chiuso", "2 Amputazione", "3 Sub-amputazione", "4 Schiacciamento",
  "5 Frattura esposta", "6 Accorciamento", "7 Deviazione arto",
  "8 Ferita penetrante", "9 Ematoma", "10 Formicolio", "11 Ustione",
];

const VALUTAZIONE_C_ITEMS = [
  "Arresto cardiaco", "Emorragia esterna", "Polso radiale assente DX",
  "Polso radiale assente SX", "Bradicardia", "Tachicardia",
  "Polso ritmico", "Polso aritmico",
];

const CUTE_ITEMS = ["Pallida", "Cianotica", "Fredda", "Calda", "Sudata"];

const VALUTAZIONE_D_ITEMS = [
  "Deviazione bocca", "Debolezza arti DX", "Debolezza arti SX", "Alterazione linguaggio",
];

const PUPILLE_ITEMS = ["Miosi", "Midriasi", "Anisocoria DX>SX", "Anisocoria SX>DX"];

const VALUTAZIONE_E_MOTILITA = ["Motilita DX assente", "Motilita SX assente", "Motilita Sup assente", "Motilita Inf assente"];
const VALUTAZIONE_E_SENSIBILITA = ["Sensibilita DX assente", "Sensibilita SX assente", "Sensibilita Sup assente", "Sensibilita Inf assente"];

const SEGNI_SINTOMI = [
  "Dolore", "Dolore addominale", "Dolore toracico", "Dispnea", "Edemi",
  "Melena", "Ematemesi", "Vomito", "Nausea", "Diarrea", "Ematuria",
  "Cefalea", "Vertigine", "Agitazione", "Alter. vista",
];

const PRESTAZIONI_ITEMS = [
  "Ossigeno", "Aspirazione", "Cannula oro faringea", "Ventilazione manuale",
  "Rimozione casco/cintura", "Estricazione complessa", "Estricazione rapida",
  "Abbattimento su spinale", "Emostasi", "Medicazione",
  "Immobilizzazione arti", "Immobilizzazione colonna", "Protezione termica",
];

const PRESIDI_ITEMS = [
  "Occhialini O2", "Maschera O2", "Collare cervicale", "Asse spinale",
  "Materasso depressione", "Cucchiaio/Scoop", "Estricatore", "Steccobenda",
];

const DINAMICA_OPTIONS = [
  { key: "maggiore", label: "Maggiore" },
  { key: "autonomo", label: "Autonomo" },
  { key: "pedone", label: "Pedone" },
  { key: "bici", label: "Bici" },
  { key: "moto", label: "Moto" },
  { key: "auto", label: "Auto" },
  { key: "mezzo_pesante", label: "Mezzo pesante" },
];

const TIME_FIELDS = [
  { key: "oraAttivazione", label: "ATTIVAZ." },
  { key: "inizioMissione", label: "INIZIO MISS." },
  { key: "arrivoPosto", label: "ARR. POSTO" },
  { key: "partenzaPosto", label: "PART. POSTO" },
  { key: "arrivoRv", label: "ARR. RV" },
  { key: "partenzaDaRv", label: "PART. DA RV" },
  { key: "arrivoInH", label: "ARR. IN H" },
  { key: "operativoFine1", label: "OPERATIVO" },
  { key: "inBaseFine2", label: "IN BASE" },
];

const PARAM_KEYS = [
  { key: "avpu", label: "AVPU", kb: "default" as const },
  { key: "fr", label: "FR", kb: "numeric" as const },
  { key: "spo2", label: "SpO2", kb: "numeric" as const },
  { key: "fc", label: "FC", kb: "numeric" as const },
  { key: "pa", label: "PA", kb: "default" as const },
  { key: "temp", label: "T\u00B0C", kb: "numeric" as const },
  { key: "glicemia", label: "Glic", kb: "numeric" as const },
  { key: "dolore", label: "NRS", kb: "numeric" as const },
];

const CF_MONTHS: Record<string, number> = { A:1, B:2, C:3, D:4, E:5, H:6, L:7, M:8, P:9, R:10, S:11, T:12 };

const PROVINCE_MAP: Record<string, string> = {
  "Verona": "VR", "Vicenza": "VI", "Padova": "PD", "Venezia": "VE",
  "Treviso": "TV", "Belluno": "BL", "Rovigo": "RO", "Brescia": "BS",
  "Mantova": "MN", "Trento": "TN", "Bolzano": "BZ", "Milano": "MI",
  "Bergamo": "BG", "Cremona": "CR", "Ferrara": "FE", "Bologna": "BO",
  "Modena": "MO", "Reggio nell'Emilia": "RE", "Parma": "PR",
  "Torino": "TO", "Genova": "GE", "Firenze": "FI", "Roma": "RM",
  "Napoli": "NA", "Bari": "BA", "Palermo": "PA", "Catania": "CT",
  "Udine": "UD", "Trieste": "TS", "Gorizia": "GO", "Pordenone": "PN",
  "Piacenza": "PC", "Ravenna": "RA", "Rimini": "RN", "Forl\u00EC-Cesena": "FC",
  "Lecco": "LC", "Como": "CO", "Varese": "VA", "Monza e della Brianza": "MB",
  "Pavia": "PV", "Lodi": "LO", "Sondrio": "SO",
};

function parseCF(cf: string) {
  if (cf.length !== 16) return null;
  const yearCode = parseInt(cf.substring(6, 8));
  const monthLetter = cf.charAt(8);
  const dayCode = parseInt(cf.substring(9, 11));
  const month = CF_MONTHS[monthLetter.toUpperCase()];
  if (!month) return null;
  const isFemale = dayCode > 40;
  const day = isFemale ? dayCode - 40 : dayCode;
  const currentYear = new Date().getFullYear() % 100;
  const year = yearCode <= currentYear ? 2000 + yearCode : 1900 + yearCode;
  const birthDate = new Date(year, month - 1, day);
  const age = Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  return {
    cf: cf.toUpperCase(),
    birthDate: `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`,
    sex: isFemale ? "F" : "M",
    age: String(age),
  };
}

const BODY_ZONES_FRONT: Array<{ id: string; label: string; path: string }> = [
  { id: "testa", label: "Testa", path: "M70,8 C70,8 72,2 80,2 C88,2 90,8 90,8 L92,18 C92,25 88,30 80,30 C72,30 68,25 68,18 Z" },
  { id: "collo", label: "Collo", path: "M74,30 L86,30 L88,40 L72,40 Z" },
  { id: "spalla_sx", label: "Spalla SX", path: "M72,40 L52,46 L48,56 L56,58 L66,52 L72,48 Z" },
  { id: "spalla_dx", label: "Spalla DX", path: "M88,40 L108,46 L112,56 L104,58 L94,52 L88,48 Z" },
  { id: "torace", label: "Torace", path: "M66,48 L72,40 L88,40 L94,48 L96,72 L64,72 Z" },
  { id: "addome", label: "Addome", path: "M64,72 L96,72 L98,100 L62,100 Z" },
  { id: "bacino", label: "Bacino", path: "M62,100 L98,100 L100,116 L60,116 Z" },
  { id: "braccio_sx_sup", label: "Braccio SX sup", path: "M48,56 L56,58 L54,88 L44,86 Z" },
  { id: "braccio_sx_inf", label: "Braccio SX inf", path: "M44,86 L54,88 L50,118 L40,116 Z" },
  { id: "mano_sx", label: "Mano SX", path: "M40,116 L50,118 L48,134 L36,132 Z" },
  { id: "braccio_dx_sup", label: "Braccio DX sup", path: "M112,56 L104,58 L106,88 L116,86 Z" },
  { id: "braccio_dx_inf", label: "Braccio DX inf", path: "M116,86 L106,88 L110,118 L120,116 Z" },
  { id: "mano_dx", label: "Mano DX", path: "M120,116 L110,118 L112,134 L124,132 Z" },
  { id: "coscia_sx", label: "Coscia SX", path: "M60,116 L78,116 L76,160 L58,160 Z" },
  { id: "coscia_dx", label: "Coscia DX", path: "M82,116 L100,116 L102,160 L84,160 Z" },
  { id: "ginocchio_sx", label: "Ginocchio SX", path: "M58,160 L76,160 L74,178 L56,178 Z" },
  { id: "ginocchio_dx", label: "Ginocchio DX", path: "M84,160 L102,160 L104,178 L86,178 Z" },
  { id: "gamba_sx", label: "Gamba SX", path: "M56,178 L74,178 L72,220 L54,220 Z" },
  { id: "gamba_dx", label: "Gamba DX", path: "M86,178 L104,178 L106,220 L88,220 Z" },
  { id: "piede_sx", label: "Piede SX", path: "M54,220 L72,220 L74,236 L48,236 Z" },
  { id: "piede_dx", label: "Piede DX", path: "M88,220 L106,220 L112,236 L86,236 Z" },
];

const BODY_ZONES_BACK: Array<{ id: string; label: string; path: string }> = [
  { id: "testa_post", label: "Testa Post.", path: "M70,8 C70,8 72,2 80,2 C88,2 90,8 90,8 L92,18 C92,25 88,30 80,30 C72,30 68,25 68,18 Z" },
  { id: "collo_post", label: "Collo Post.", path: "M74,30 L86,30 L88,40 L72,40 Z" },
  { id: "spalla_sx_post", label: "Spalla SX P.", path: "M72,40 L52,46 L48,56 L56,58 L66,52 L72,48 Z" },
  { id: "spalla_dx_post", label: "Spalla DX P.", path: "M88,40 L108,46 L112,56 L104,58 L94,52 L88,48 Z" },
  { id: "torace_post", label: "Dorso Sup.", path: "M66,48 L72,40 L88,40 L94,48 L96,72 L64,72 Z" },
  { id: "addome_post", label: "Dorso Inf.", path: "M64,72 L96,72 L98,100 L62,100 Z" },
  { id: "bacino_post", label: "Bacino Post.", path: "M62,100 L98,100 L100,116 L60,116 Z" },
  { id: "braccio_sx_sup_post", label: "Braccio SX sup P.", path: "M48,56 L56,58 L54,88 L44,86 Z" },
  { id: "braccio_sx_inf_post", label: "Braccio SX inf P.", path: "M44,86 L54,88 L50,118 L40,116 Z" },
  { id: "mano_sx_post", label: "Mano SX P.", path: "M40,116 L50,118 L48,134 L36,132 Z" },
  { id: "braccio_dx_sup_post", label: "Braccio DX sup P.", path: "M112,56 L104,58 L106,88 L116,86 Z" },
  { id: "braccio_dx_inf_post", label: "Braccio DX inf P.", path: "M116,86 L106,88 L110,118 L120,116 Z" },
  { id: "mano_dx_post", label: "Mano DX P.", path: "M120,116 L110,118 L112,134 L124,132 Z" },
  { id: "coscia_sx_post", label: "Coscia SX P.", path: "M60,116 L78,116 L76,160 L58,160 Z" },
  { id: "coscia_dx_post", label: "Coscia DX P.", path: "M82,116 L100,116 L102,160 L84,160 Z" },
  { id: "ginocchio_sx_post", label: "Ginocchio SX P.", path: "M58,160 L76,160 L74,178 L56,178 Z" },
  { id: "ginocchio_dx_post", label: "Ginocchio DX P.", path: "M84,160 L102,160 L104,178 L86,178 Z" },
  { id: "gamba_sx_post", label: "Gamba SX P.", path: "M56,178 L74,178 L72,220 L54,220 Z" },
  { id: "gamba_dx_post", label: "Gamba DX P.", path: "M86,178 L104,178 L106,220 L88,220 Z" },
  { id: "piede_sx_post", label: "Piede SX P.", path: "M54,220 L72,220 L74,236 L48,236 Z" },
  { id: "piede_dx_post", label: "Piede DX P.", path: "M88,220 L106,220 L112,236 L86,236 Z" },
];

function CBox({ on, toggle, label, color, w }: { on: boolean; toggle: () => void; label: string; color?: string; w?: string }) {
  const { theme } = useTheme();
  return (
    <Pressable
      style={[s.cb, w ? { width: w as any } : null]}
      onPress={() => { if (!IS_WEB) Haptics.selectionAsync(); toggle(); }}
    >
      <View style={[s.cbBox, { borderColor: color || theme.primary }, on ? { backgroundColor: color || theme.primary } : null]}>
        {on ? <Feather name="check" size={11} color="#FFF" /> : null}
      </View>
      <ThemedText style={s.cbLabel}>{label}</ThemedText>
    </Pressable>
  );
}

function TField({ label, value, onChange }: { label: string; value: string; onChange: (t: string) => void }) {
  const { theme, isDark } = useTheme();
  const handle = (text: string) => {
    const c = text.replace(/[^0-9]/g, "");
    if (c.length <= 2) onChange(c);
    else if (c.length <= 4) onChange(c.slice(0, 2) + ":" + c.slice(2));
  };
  return (
    <View style={s.tf}>
      <ThemedText style={s.tfLabel}>{label}</ThemedText>
      <TextInput
        style={[s.tfInput, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)", color: theme.text, borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)" }]}
        value={value} onChangeText={handle} placeholder="--:--" placeholderTextColor={theme.textSecondary}
        keyboardType="numeric" maxLength={5}
      />
    </View>
  );
}

function FField({ label, value, onChange, kb, ml, ph }: { label: string; value: string; onChange: (t: string) => void; kb?: "default" | "numeric" | "email-address"; ml?: boolean; ph?: string }) {
  const { theme, isDark } = useTheme();
  return (
    <View style={s.ff}>
      <ThemedText style={s.ffLabel}>{label}</ThemedText>
      <TextInput
        style={[s.ffInput, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)", color: theme.text, borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)" }, ml ? { height: 56, textAlignVertical: "top" } : null]}
        value={value} onChangeText={onChange} placeholder={ph || label} placeholderTextColor={theme.textSecondary}
        keyboardType={kb} multiline={ml}
      />
    </View>
  );
}

function Strip({ title, color, right }: { title: string; color?: string; right?: React.ReactNode }) {
  return (
    <View style={[s.strip, { backgroundColor: color || "rgba(0,102,204,0.2)" }]}>
      <ThemedText style={s.stripText}>{title}</ThemedText>
      {right ? right : null}
    </View>
  );
}

function BodyDiagram({ zones, onToggle, title, bodyZones }: { zones: Record<string, boolean>; onToggle: (id: string) => void; title: string; bodyZones: typeof BODY_ZONES_FRONT }) {
  const { isDark } = useTheme();
  const diagramW = Math.min((SCREEN_W - 48) / 2, 160);
  const diagramH = diagramW * 1.75;
  return (
    <View style={s.bodyCol}>
      <ThemedText style={s.bodyTitle}>{title}</ThemedText>
      <Svg width={diagramW} height={diagramH} viewBox="30 0 100 240">
        {bodyZones.map(z => (
          <Path
            key={z.id}
            d={z.path}
            fill={zones[z.id] ? "rgba(220,53,69,0.5)" : "transparent"}
            stroke={isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)"}
            strokeWidth={0.8}
            onPress={() => { if (!IS_WEB) Haptics.selectionAsync(); onToggle(z.id); }}
          />
        ))}
      </Svg>
      <View style={s.traumaTagRow}>
        {bodyZones.filter(z => zones[z.id]).map(z => (
          <View key={z.id} style={s.traumaTag}>
            <ThemedText style={s.traumaTagTxt}>{z.label}</ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function RescueSheetScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const vehicle = user?.vehicle;
  const [activeTab, setActiveTab] = useState(0);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [locationPermission, requestLocationPermission] = Location.useForegroundPermissions();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const scanLock = useRef(false);

  const today = new Date().toISOString().split("T")[0];
  const nowTime = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const [form, setForm] = useState({
    sheetDate: today,
    dispatchCode: "",
    oraAttivazione: "",
    inizioMissione: "",
    arrivoPosto: "",
    partenzaPosto: "",
    arrivoRv: "",
    partenzaDaRv: "",
    arrivoInH: "",
    operativoFine1: "",
    inBaseFine2: "",
    sospeso: false,
    nonReperito: false,
    siAllontana: false,
    rientraInEli: false,
    rendezVousIdroambulanza: false,
    luogoComune: "",
    luogoVia: "",
    luogoProv: "",
    luogoNr: "",
    luogoRiferimenti: "",
    coinvolti: "",
    idemResidenza: false,
    pazienteCognome: "",
    pazienteNome: "",
    pazienteSesso: "",
    pazienteEtaAnni: "",
    pazienteEtaMesi: "",
    pazienteEtaGiorni: "",
    pazienteNatoIl: "",
    pazienteCf: "",
    residenzaComune: "",
    residenzaVia: "",
    residenzaNr: "",
    residenzaProv: "",
    residenzaStatoEstero: "",
    cittadinanzaIta: true,
    pazienteEmail: "",
    giaSulPosto: { msa: false, msi: false, msb: false } as Record<string, boolean>,
    codiceMissione: "",
    destinazionePs: false,
    autista: "",
    soccorritore: "",
    altroSoccorritore: "",
    soccorritore2: "",
    eventoMedico: {} as Record<string, boolean>,
    eventoTraumatico: {} as Record<string, boolean>,
    eventoInfortunio: false,
    eventoIntossicazione: false,
    luogoEvento: "",
    presentiSulPosto: {} as Record<string, boolean>,
    allertamentoMsa: "",
    rinvenimento: "",
    rinvenimentoNote: "",
    valutazioneA: {} as Record<string, boolean>,
    valutazioneB: {} as Record<string, boolean>,
    traumaItems: {} as Record<string, boolean>,
    valutazioneC: {} as Record<string, boolean>,
    cuteItems: {} as Record<string, boolean>,
    avpu: "",
    cpss: "",
    valutazioneD: {} as Record<string, boolean>,
    pupilleItems: {} as Record<string, boolean>,
    oraInsorgenzaD: "",
    valutazioneE_motilita: {} as Record<string, boolean>,
    valutazioneE_sensibilita: {} as Record<string, boolean>,
    parametriVitali: [
      { ora: "", avpu: "", fr: "", spo2: "", fc: "", pa: "", temp: "", glicemia: "", dolore: "" },
      { ora: "", avpu: "", fr: "", spo2: "", fc: "", pa: "", temp: "", glicemia: "", dolore: "" },
      { ora: "", avpu: "", fr: "", spo2: "", fc: "", pa: "", temp: "", glicemia: "", dolore: "" },
    ] as Array<Record<string, string>>,
    altriSegniSintomi: {} as Record<string, boolean>,
    segniInizioOre: "",
    rcpInizioOre: "",
    daeShockOre: "",
    numeroShock: "",
    roscOre: "",
    prestazioni: {} as Record<string, boolean>,
    ossigenoLmin: "",
    presidi: {} as Record<string, boolean>,
    dinamicaTrauma: {} as Record<string, boolean>,
    rifiutoTrasporto: false,
    rifiutoTrattamento: false,
    firmaRifiuto: "",
    note: "",
    consegnaPsNome: "",
    consegnaPsTipo: "",
    consegnaPsOre: "",
    firmaCompilatore: "",
    traumaZones: {} as Record<string, boolean>,
  });

  const updateForm = useCallback((key: string, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const toggleMapItem = useCallback((mapKey: string, itemKey: string) => {
    if (!IS_WEB) Haptics.selectionAsync();
    setForm(prev => ({
      ...prev,
      [mapKey]: { ...(prev as any)[mapKey], [itemKey]: !(prev as any)[mapKey][itemKey] },
    }));
  }, []);

  const updateParamVitali = useCallback((index: number, key: string, value: string) => {
    setForm(prev => {
      const newParams = [...prev.parametriVitali];
      newParams[index] = { ...newParams[index], [key]: value };
      return { ...prev, parametriVitali: newParams };
    });
  }, []);

  const setNow = useCallback((field: string) => {
    if (!IS_WEB) Haptics.selectionAsync();
    updateForm(field, nowTime());
  }, []);

  const handleBarcodeScan = useCallback((result: any) => {
    if (scanLock.current) return;
    const rawData = result?.data;
    if (!rawData) return;
    const cfMatch = rawData.match(/[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]/i);
    if (!cfMatch) {
      setScannerOpen(false);
      Alert.alert("Non riconosciuto", "Nessun codice fiscale trovato nel barcode.");
      return;
    }
    const parsed = parseCF(cfMatch[0]);
    if (!parsed) {
      setScannerOpen(false);
      Alert.alert("Errore", "Impossibile decodificare il codice fiscale.");
      return;
    }
    scanLock.current = true;
    if (!IS_WEB) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setForm(prev => ({
      ...prev,
      pazienteCf: parsed.cf,
      pazienteNatoIl: parsed.birthDate,
      pazienteSesso: parsed.sex,
      pazienteEtaAnni: parsed.age,
    }));
    setScannerOpen(false);
    setTimeout(() => { scanLock.current = false; }, 1500);
  }, []);

  const openScanner = useCallback(async () => {
    if (IS_WEB) {
      Alert.alert("Non disponibile", "Usa l'app su dispositivo mobile per scansionare");
      return;
    }
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert("Permesso negato", "Serve il permesso fotocamera per scansionare il documento.");
        return;
      }
    }
    scanLock.current = false;
    setScannerOpen(true);
  }, [cameraPermission, requestCameraPermission]);

  const handleGPS = useCallback(async () => {
    if (IS_WEB) {
      Alert.alert("Non disponibile", "Usa l'app su dispositivo mobile per il GPS");
      return;
    }
    if (!locationPermission?.granted) {
      const result = await requestLocationPermission();
      if (!result.granted) {
        Alert.alert("Permesso negato", "Serve il permesso di localizzazione.");
        return;
      }
    }
    setGpsLoading(true);
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const geo = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      if (geo && geo.length > 0) {
        const g = geo[0];
        const prov = PROVINCE_MAP[g.subregion || ""] || PROVINCE_MAP[g.region || ""] || "";
        if (!IS_WEB) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setForm(prev => ({
          ...prev,
          luogoComune: g.city || g.subregion || "",
          luogoVia: g.street || "",
          luogoNr: g.streetNumber || "",
          luogoProv: prov,
        }));
      }
    } catch (err) {
      Alert.alert("Errore GPS", "Impossibile ottenere la posizione.");
    } finally {
      setGpsLoading(false);
    }
  }, [locationPermission, requestLocationPermission]);

  const saveMutation = useMutation({
    mutationFn: async (status: string) => {
      const body = {
        vehicleId: vehicle?.id,
        vehicleCode: vehicle?.code,
        locationId: user?.location?.id || user?.vehicle?.locationId,
        sheetDate: form.sheetDate,
        dispatchCode: form.dispatchCode || null,
        oraAttivazione: form.oraAttivazione || null,
        inizioMissione: form.inizioMissione || null,
        arrivoPosto: form.arrivoPosto || null,
        partenzaPosto: form.partenzaPosto || null,
        arrivoRv: form.arrivoRv || null,
        partenzaDaRv: form.partenzaDaRv || null,
        arrivoInH: form.arrivoInH || null,
        operativoFine1: form.operativoFine1 || null,
        inBaseFine2: form.inBaseFine2 || null,
        sospeso: form.sospeso,
        nonReperito: form.nonReperito,
        siAllontana: form.siAllontana,
        rientraInEli: form.rientraInEli,
        rendezVousIdroambulanza: form.rendezVousIdroambulanza,
        luogoComune: form.luogoComune || null,
        luogoVia: form.luogoVia || null,
        luogoProv: form.luogoProv || null,
        luogoNr: form.luogoNr || null,
        luogoRiferimenti: form.luogoRiferimenti || null,
        coinvolti: form.coinvolti ? parseInt(form.coinvolti) : null,
        idemResidenza: form.idemResidenza,
        pazienteCognome: form.pazienteCognome || null,
        pazienteNome: form.pazienteNome || null,
        pazienteSesso: form.pazienteSesso || null,
        pazienteEtaAnni: form.pazienteEtaAnni ? parseInt(form.pazienteEtaAnni) : null,
        pazienteEtaMesi: form.pazienteEtaMesi ? parseInt(form.pazienteEtaMesi) : null,
        pazienteEtaGiorni: form.pazienteEtaGiorni ? parseInt(form.pazienteEtaGiorni) : null,
        pazienteNatoIl: form.pazienteNatoIl || null,
        pazienteCf: form.pazienteCf || null,
        residenzaComune: form.residenzaComune || null,
        residenzaVia: form.residenzaVia || null,
        residenzaNr: form.residenzaNr || null,
        residenzaProv: form.residenzaProv || null,
        residenzaStatoEstero: form.residenzaStatoEstero || null,
        cittadinanzaIta: form.cittadinanzaIta,
        pazienteEmail: form.pazienteEmail || null,
        giaSulPosto: form.giaSulPosto,
        codiceMissione: form.codiceMissione || null,
        destinazionePs: form.destinazionePs,
        equipaggio: {
          autista: form.autista,
          soccorritore: form.soccorritore,
          altroSoccorritore: form.altroSoccorritore,
          soccorritore2: form.soccorritore2,
        },
        eventoMedico: form.eventoMedico,
        eventoTraumatico: form.eventoTraumatico,
        eventoInfortunio: form.eventoInfortunio,
        eventoIntossicazione: form.eventoIntossicazione,
        luogoEvento: form.luogoEvento || null,
        presentiSulPosto: form.presentiSulPosto,
        allertamentoMsa: form.allertamentoMsa || null,
        rinvenimento: form.rinvenimento || null,
        rinvenimentoNote: form.rinvenimentoNote || null,
        valutazioneA: form.valutazioneA,
        valutazioneB: { ...form.valutazioneB, traumaItems: form.traumaItems },
        valutazioneC: { ...form.valutazioneC, cuteItems: form.cuteItems },
        valutazioneD: {
          ...form.valutazioneD,
          pupilleItems: form.pupilleItems,
          avpu: form.avpu,
          cpss: form.cpss,
          oraInsorgenza: form.oraInsorgenzaD,
        },
        valutazioneE: {
          motilita: form.valutazioneE_motilita,
          sensibilita: form.valutazioneE_sensibilita,
        },
        parametriVitali: form.parametriVitali,
        altriSegniSintomi: {
          ...form.altriSegniSintomi,
          inizioOre: form.segniInizioOre,
        },
        rcp: {
          inizioOre: form.rcpInizioOre,
          daeShockOre: form.daeShockOre,
          numeroShock: form.numeroShock,
          roscOre: form.roscOre,
        },
        prestazioni: { ...form.prestazioni, ossigenoLmin: form.ossigenoLmin },
        presidi: form.presidi,
        dinamicaTrauma: form.dinamicaTrauma,
        traumaZones: form.traumaZones,
        rifiutoTrasporto: form.rifiutoTrasporto,
        rifiutoTrattamento: form.rifiutoTrattamento,
        firmaRifiuto: form.firmaRifiuto || null,
        note: form.note || null,
        consegnaPsNome: form.consegnaPsNome || null,
        consegnaPsTipo: form.consegnaPsTipo || null,
        consegnaPsOre: form.consegnaPsOre || null,
        firmaCompilatore: form.firmaCompilatore || null,
        status,
      };

      const url = new URL("/api/rescue-sheets", getApiUrl());
      const token = await getAuthToken();
      const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error("Errore nel salvataggio");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rescue-sheets"] });
      if (!IS_WEB) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Salvata", "Scheda di soccorso salvata con successo");
    },
    onError: () => {
      Alert.alert("Errore", "Impossibile salvare la scheda di soccorso");
    },
  });

  const tabProgress = [
    !!(form.sheetDate && (form.dispatchCode || form.oraAttivazione || form.pazienteCognome)),
    !!(Object.values(form.valutazioneA).some(Boolean) || form.parametriVitali[0].ora || Object.values(form.traumaZones).some(Boolean)),
    !!(form.autista || form.note || form.firmaCompilatore),
  ];

  const TABS = ["1 DATI", "2 CLINICA", "3 CHIUSURA"];

  const bd = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const inputBg = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)";
  const inputBd = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)";

  const renderPage1 = () => (
    <>
      <View style={[s.section, { borderColor: bd }]}>
        <View style={s.headerRow}>
          <View style={s.hField}>
            <ThemedText style={s.hLabel}>DATA</ThemedText>
            <ThemedText style={s.hValue}>{form.sheetDate}</ThemedText>
          </View>
          <View style={s.hField}>
            <ThemedText style={s.hLabel}>MEZZO</ThemedText>
            <ThemedText style={s.hValue}>{vehicle?.code || "-"}</ThemedText>
          </View>
        </View>
        <ThemedText style={s.miniLabel}>CODICE INVIO</ThemedText>
        <View style={s.codeRow}>
          {DISPATCH_CODES.map(dc => (
            <Pressable
              key={dc.code}
              style={[s.codeBtn, { backgroundColor: dc.color }, form.dispatchCode === dc.code ? s.codeBtnOn : null]}
              onPress={() => { if (!IS_WEB) Haptics.selectionAsync(); updateForm("dispatchCode", form.dispatchCode === dc.code ? "" : dc.code); }}
            >
              <ThemedText style={[s.codeBtnTxt, { color: dc.textColor }]}>{dc.code}</ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      <Strip title="ORARI" />
      <View style={[s.section, { borderColor: bd }]}>
        <View style={s.timeGrid}>
          {TIME_FIELDS.map(tf => (
            <View key={tf.key} style={s.timeCell}>
              <TField label={tf.label} value={(form as any)[tf.key]} onChange={v => updateForm(tf.key, v)} />
              <Pressable style={s.nowBtn} onPress={() => setNow(tf.key)}>
                <Feather name="zap" size={10} color="#FFF" />
              </Pressable>
            </View>
          ))}
        </View>
        <View style={s.cbRow}>
          <CBox on={form.sospeso} toggle={() => updateForm("sospeso", !form.sospeso)} label="SOSP." w="33%" />
          <CBox on={form.nonReperito} toggle={() => updateForm("nonReperito", !form.nonReperito)} label="NON REP." w="33%" />
          <CBox on={form.siAllontana} toggle={() => updateForm("siAllontana", !form.siAllontana)} label="SI ALLONT." w="33%" />
        </View>
        <View style={s.cbRow}>
          <CBox on={form.rientraInEli} toggle={() => updateForm("rientraInEli", !form.rientraInEli)} label="RIENTRA ELI." w="50%" />
          <CBox on={form.rendezVousIdroambulanza} toggle={() => updateForm("rendezVousIdroambulanza", !form.rendezVousIdroambulanza)} label="RV IDROAMB." w="50%" />
        </View>
      </View>

      <Strip
        title="LUOGO EVENTO"
        right={
          <Pressable style={s.gpsBtn} onPress={handleGPS} disabled={gpsLoading}>
            {gpsLoading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Feather name="map-pin" size={14} color="#FFF" />
                <ThemedText style={s.gpsBtnTxt}>USA GPS</ThemedText>
              </>
            )}
          </Pressable>
        }
      />
      <View style={[s.section, { borderColor: bd }]}>
        <View style={s.row}>
          <View style={{ flex: 2 }}><FField label="COMUNE" value={form.luogoComune} onChange={v => updateForm("luogoComune", v)} /></View>
          <View style={{ flex: 1, marginLeft: 6 }}><FField label="PROV." value={form.luogoProv} onChange={v => updateForm("luogoProv", v)} /></View>
        </View>
        <View style={s.row}>
          <View style={{ flex: 3 }}><FField label="VIA" value={form.luogoVia} onChange={v => updateForm("luogoVia", v)} /></View>
          <View style={{ flex: 1, marginLeft: 6 }}><FField label="NR." value={form.luogoNr} onChange={v => updateForm("luogoNr", v)} kb="numeric" /></View>
        </View>
        <FField label="RIFERIMENTI" value={form.luogoRiferimenti} onChange={v => updateForm("luogoRiferimenti", v)} />
        <View style={s.row}>
          <View style={{ flex: 1 }}><FField label="COINVOLTI" value={form.coinvolti} onChange={v => updateForm("coinvolti", v)} kb="numeric" /></View>
          <View style={{ flex: 1, marginLeft: 6 }}><CBox on={form.idemResidenza} toggle={() => updateForm("idemResidenza", !form.idemResidenza)} label="IDEM RESID." /></View>
        </View>
        <ThemedText style={s.miniLabel}>LUOGO</ThemedText>
        <View style={s.cbRow}>
          {LUOGO_OPTIONS.map(lo => (
            <CBox key={lo.key} on={form.luogoEvento === lo.key} toggle={() => updateForm("luogoEvento", form.luogoEvento === lo.key ? "" : lo.key)} label={lo.label} w="33%" />
          ))}
        </View>
      </View>

      <Strip title="PAZIENTE" />
      <View style={[s.section, { borderColor: bd }]}>
        <Pressable style={s.scanBtn} onPress={openScanner}>
          <Feather name="camera" size={16} color="#FFF" />
          <ThemedText style={s.scanBtnTxt}>SCANSIONA DOCUMENTO</ThemedText>
        </Pressable>
        <View style={s.row}>
          <View style={{ flex: 1 }}><FField label="COGNOME" value={form.pazienteCognome} onChange={v => updateForm("pazienteCognome", v)} /></View>
          <View style={{ flex: 1, marginLeft: 6 }}><FField label="NOME" value={form.pazienteNome} onChange={v => updateForm("pazienteNome", v)} /></View>
        </View>
        <View style={s.row}>
          {["M", "F"].map(sx => (
            <Pressable
              key={sx}
              style={[s.sexBtn, { backgroundColor: form.pazienteSesso === sx ? (sx === "M" ? "#0066CC" : "#CC0066") : inputBg, borderColor: form.pazienteSesso === sx ? "transparent" : inputBd }]}
              onPress={() => { if (!IS_WEB) Haptics.selectionAsync(); updateForm("pazienteSesso", form.pazienteSesso === sx ? "" : sx); }}
            >
              <ThemedText style={[s.sexBtnTxt, form.pazienteSesso === sx ? { color: "#FFF" } : null]}>{sx}</ThemedText>
            </Pressable>
          ))}
          <View style={{ flex: 1, marginLeft: 6 }}><FField label="ANNI" value={form.pazienteEtaAnni} onChange={v => updateForm("pazienteEtaAnni", v)} kb="numeric" /></View>
          <View style={{ flex: 1, marginLeft: 6 }}><FField label="MESI" value={form.pazienteEtaMesi} onChange={v => updateForm("pazienteEtaMesi", v)} kb="numeric" /></View>
          <View style={{ flex: 1, marginLeft: 6 }}><FField label="GG" value={form.pazienteEtaGiorni} onChange={v => updateForm("pazienteEtaGiorni", v)} kb="numeric" /></View>
        </View>
        <View style={s.row}>
          <View style={{ flex: 1 }}><FField label="NATO/A IL" value={form.pazienteNatoIl} onChange={v => updateForm("pazienteNatoIl", v)} /></View>
          <View style={{ flex: 1, marginLeft: 6 }}><FField label="COD. FISCALE" value={form.pazienteCf} onChange={v => updateForm("pazienteCf", v.toUpperCase())} /></View>
        </View>
      </View>

      <Strip title="RESIDENZA" />
      <View style={[s.section, { borderColor: bd }]}>
        <View style={s.row}>
          <View style={{ flex: 2 }}><FField label="COMUNE" value={form.residenzaComune} onChange={v => updateForm("residenzaComune", v)} /></View>
          <View style={{ flex: 1, marginLeft: 6 }}><FField label="PROV." value={form.residenzaProv} onChange={v => updateForm("residenzaProv", v)} /></View>
        </View>
        <View style={s.row}>
          <View style={{ flex: 3 }}><FField label="VIA" value={form.residenzaVia} onChange={v => updateForm("residenzaVia", v)} /></View>
          <View style={{ flex: 1, marginLeft: 6 }}><FField label="NR." value={form.residenzaNr} onChange={v => updateForm("residenzaNr", v)} /></View>
        </View>
        <View style={s.row}>
          <View style={{ flex: 1 }}><FField label="STATO ESTERO" value={form.residenzaStatoEstero} onChange={v => updateForm("residenzaStatoEstero", v)} /></View>
          <View style={{ flex: 1, marginLeft: 6 }}><CBox on={form.cittadinanzaIta} toggle={() => updateForm("cittadinanzaIta", !form.cittadinanzaIta)} label="CITT. ITA" /></View>
        </View>
        <FField label="E-MAIL" value={form.pazienteEmail} onChange={v => updateForm("pazienteEmail", v)} kb="email-address" />
      </View>

      <Strip title="EVENTO RILEVATO" color="rgba(220,53,69,0.2)" />
      <View style={[s.section, { borderColor: bd }]}>
        <ThemedText style={s.miniLabel}>MEDICO</ThemedText>
        <View style={s.cbRow}>
          {EVENTO_MEDICO.map(em => <CBox key={em} on={!!form.eventoMedico[em]} toggle={() => toggleMapItem("eventoMedico", em)} label={em} w="25%" />)}
        </View>
        <ThemedText style={s.miniLabel}>TRAUMATICO</ThemedText>
        <View style={s.cbRow}>
          {EVENTO_TRAUMATICO.map(et => <CBox key={et} on={!!form.eventoTraumatico[et]} toggle={() => toggleMapItem("eventoTraumatico", et)} label={et} w="33%" />)}
        </View>
        <View style={s.cbRow}>
          <CBox on={form.eventoInfortunio} toggle={() => updateForm("eventoInfortunio", !form.eventoInfortunio)} label="INFORTUNIO" w="50%" />
          <CBox on={form.eventoIntossicazione} toggle={() => updateForm("eventoIntossicazione", !form.eventoIntossicazione)} label="INTOSSICAZ." w="50%" />
        </View>
      </View>

      <Strip title="PRESENTI SUL POSTO / MSA" />
      <View style={[s.section, { borderColor: bd }]}>
        <View style={s.cbRow}>
          {PRESENTI_OPTIONS.map(po => <CBox key={po} on={!!form.presentiSulPosto[po]} toggle={() => toggleMapItem("presentiSulPosto", po)} label={po} w="25%" />)}
        </View>
        <ThemedText style={s.miniLabel}>GIA SUL POSTO</ThemedText>
        <View style={s.cbRow}>
          <CBox on={!!form.giaSulPosto.msa} toggle={() => toggleMapItem("giaSulPosto", "msa")} label="MSA" w="33%" />
          <CBox on={!!form.giaSulPosto.msi} toggle={() => toggleMapItem("giaSulPosto", "msi")} label="MSI" w="33%" />
          <CBox on={!!form.giaSulPosto.msb} toggle={() => toggleMapItem("giaSulPosto", "msb")} label="MSB" w="33%" />
        </View>
        <ThemedText style={s.miniLabel}>ALLERT. MSA</ThemedText>
        <View style={s.cbRow}>
          {MSA_OPTIONS.map(mo => <CBox key={mo.key} on={form.allertamentoMsa === mo.key} toggle={() => updateForm("allertamentoMsa", form.allertamentoMsa === mo.key ? "" : mo.key)} label={mo.label} w="33%" />)}
        </View>
      </View>

      <Strip title="CODICE MISSIONE" />
      <View style={[s.section, { borderColor: bd }]}>
        <View style={s.row}>
          {MISSION_CODES.map(mc => (
            <Pressable
              key={mc}
              style={[s.missionBtn, { backgroundColor: form.codiceMissione === mc ? "#0066CC" : inputBg, borderColor: form.codiceMissione === mc ? "#0066CC" : inputBd }]}
              onPress={() => { if (!IS_WEB) Haptics.selectionAsync(); updateForm("codiceMissione", form.codiceMissione === mc ? "" : mc); }}
            >
              <ThemedText style={[s.missionTxt, form.codiceMissione === mc ? { color: "#FFF" } : null]}>{mc}</ThemedText>
            </Pressable>
          ))}
          <View style={{ flex: 1, marginLeft: 8 }}>
            <CBox on={form.destinazionePs} toggle={() => updateForm("destinazionePs", !form.destinazionePs)} label="PS" />
          </View>
        </View>
      </View>

      <Strip title="RINVENIMENTO" />
      <View style={[s.section, { borderColor: bd }]}>
        <View style={s.cbRow}>
          {RINVENIMENTO_OPTIONS.map(ro => <CBox key={ro} on={form.rinvenimento === ro} toggle={() => updateForm("rinvenimento", form.rinvenimento === ro ? "" : ro)} label={ro} w="33%" />)}
        </View>
        <FField label="NOTE RINV." value={form.rinvenimentoNote} onChange={v => updateForm("rinvenimentoNote", v)} />
      </View>
    </>
  );

  const renderPage2 = () => (
    <>
      <Strip title="A - AIRWAY" color="rgba(220,53,69,0.25)" />
      <View style={[s.section, { borderColor: bd }]}>
        <View style={s.cbRow}>
          {VALUTAZIONE_A_ITEMS.map(item => <CBox key={item} on={!!form.valutazioneA[item]} toggle={() => toggleMapItem("valutazioneA", item)} label={item} color="#DC3545" w="50%" />)}
        </View>
      </View>

      <Strip title="B - BREATHING / TRAUMA" color="rgba(255,140,0,0.25)" />
      <View style={[s.section, { borderColor: bd }]}>
        <View style={s.cbRow}>
          {VALUTAZIONE_B_ITEMS.map(item => <CBox key={item} on={!!form.valutazioneB[item]} toggle={() => toggleMapItem("valutazioneB", item)} label={item} color="#FF8C00" w="50%" />)}
        </View>
        <ThemedText style={s.miniLabel}>TRAUMA</ThemedText>
        <View style={s.cbRow}>
          {TRAUMA_ITEMS.map(item => <CBox key={item} on={!!form.traumaItems[item]} toggle={() => toggleMapItem("traumaItems", item)} label={item} color="#FF8C00" w="50%" />)}
        </View>
      </View>

      <Strip title="C - CIRCULATION" color="rgba(220,53,69,0.25)" />
      <View style={[s.section, { borderColor: bd }]}>
        <View style={s.cbRow}>
          {VALUTAZIONE_C_ITEMS.map(item => <CBox key={item} on={!!form.valutazioneC[item]} toggle={() => toggleMapItem("valutazioneC", item)} label={item} color="#DC3545" w="50%" />)}
        </View>
        <ThemedText style={s.miniLabel}>CUTE</ThemedText>
        <View style={s.cbRow}>
          {CUTE_ITEMS.map(item => <CBox key={item} on={!!form.cuteItems[item]} toggle={() => toggleMapItem("cuteItems", item)} label={item} w="33%" />)}
        </View>
      </View>

      <Strip title="D - DISABILITY" color="rgba(0,102,204,0.25)" />
      <View style={[s.section, { borderColor: bd }]}>
        <View style={s.row}>
          <ThemedText style={[s.miniLabel, { marginRight: 6 }]}>AVPU:</ThemedText>
          {["A", "V", "P", "U"].map(v => (
            <Pressable key={v} style={[s.avpuBtn, { backgroundColor: form.avpu === v ? "#0066CC" : inputBg, borderColor: form.avpu === v ? "#0066CC" : inputBd }]}
              onPress={() => { if (!IS_WEB) Haptics.selectionAsync(); updateForm("avpu", form.avpu === v ? "" : v); }}>
              <ThemedText style={[s.avpuTxt, form.avpu === v ? { color: "#FFF" } : null]}>{v}</ThemedText>
            </Pressable>
          ))}
          <View style={{ flex: 1, marginLeft: 8 }}><FField label="CPSS" value={form.cpss} onChange={v => updateForm("cpss", v)} kb="numeric" /></View>
        </View>
        <View style={s.cbRow}>
          {VALUTAZIONE_D_ITEMS.map(item => <CBox key={item} on={!!form.valutazioneD[item]} toggle={() => toggleMapItem("valutazioneD", item)} label={item} w="50%" />)}
        </View>
        <ThemedText style={s.miniLabel}>PUPILLE</ThemedText>
        <View style={s.cbRow}>
          {PUPILLE_ITEMS.map(item => <CBox key={item} on={!!form.pupilleItems[item]} toggle={() => toggleMapItem("pupilleItems", item)} label={item} w="50%" />)}
        </View>
        <TField label="ORA INSORGENZA" value={form.oraInsorgenzaD} onChange={v => updateForm("oraInsorgenzaD", v)} />
      </View>

      <Strip title="E - EXPOSURE" color="rgba(0,166,81,0.25)" />
      <View style={[s.section, { borderColor: bd }]}>
        <ThemedText style={s.miniLabel}>MOTILITA</ThemedText>
        <View style={s.cbRow}>
          {VALUTAZIONE_E_MOTILITA.map(item => <CBox key={item} on={!!form.valutazioneE_motilita[item]} toggle={() => toggleMapItem("valutazioneE_motilita", item)} label={item} w="50%" />)}
        </View>
        <ThemedText style={s.miniLabel}>SENSIBILITA</ThemedText>
        <View style={s.cbRow}>
          {VALUTAZIONE_E_SENSIBILITA.map(item => <CBox key={item} on={!!form.valutazioneE_sensibilita[item]} toggle={() => toggleMapItem("valutazioneE_sensibilita", item)} label={item} w="50%" />)}
        </View>
      </View>

      <Strip title="PARAMETRI VITALI" color="rgba(0,102,204,0.25)" />
      <View style={[s.section, { borderColor: bd }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
          <View>
            <View style={s.paramRow}>
              <View style={[s.paramCell, s.paramHeaderCell]}><ThemedText style={s.paramHdrTxt}> </ThemedText></View>
              <View style={[s.paramCell, s.paramHeaderCell]}><ThemedText style={s.paramHdrTxt}>ORA</ThemedText></View>
              {PARAM_KEYS.map(pk => (
                <View key={pk.key} style={[s.paramCell, s.paramHeaderCell]}><ThemedText style={s.paramHdrTxt}>{pk.label}</ThemedText></View>
              ))}
            </View>
            {form.parametriVitali.map((pv, idx) => (
              <View key={idx} style={s.paramRow}>
                <View style={[s.paramCell, { width: 60 }]}>
                  <ThemedText style={s.paramIdxTxt}>{idx === 0 ? "ARR." : `RIV.${idx}`}</ThemedText>
                </View>
                <View style={s.paramCell}>
                  <Pressable style={s.paramInputWrap} onPress={() => updateParamVitali(idx, "ora", nowTime())}>
                    <TextInput
                      style={[s.paramInput, { backgroundColor: inputBg, color: theme.text, borderColor: inputBd }]}
                      value={pv.ora} onChangeText={v => updateParamVitali(idx, "ora", v)}
                      placeholder="--:--" placeholderTextColor={theme.textSecondary} keyboardType="numeric" maxLength={5}
                    />
                  </Pressable>
                </View>
                {PARAM_KEYS.map(pk => (
                  <View key={pk.key} style={s.paramCell}>
                    <TextInput
                      style={[s.paramInput, { backgroundColor: inputBg, color: theme.text, borderColor: inputBd }]}
                      value={pv[pk.key]} onChangeText={v => updateParamVitali(idx, pk.key, v)}
                      placeholder="-" placeholderTextColor={theme.textSecondary} keyboardType={pk.kb}
                    />
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      <Strip title="SEGNI / SINTOMI" />
      <View style={[s.section, { borderColor: bd }]}>
        <View style={s.cbRow}>
          {SEGNI_SINTOMI.map(ss => <CBox key={ss} on={!!form.altriSegniSintomi[ss]} toggle={() => toggleMapItem("altriSegniSintomi", ss)} label={ss} w="33%" />)}
        </View>
        <TField label="INIZIO ORE" value={form.segniInizioOre} onChange={v => updateForm("segniInizioOre", v)} />
      </View>

      <Strip title="RCP / DAE" color="rgba(220,53,69,0.25)" />
      <View style={[s.section, { borderColor: bd }]}>
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <View style={s.row}>
              <View style={{ flex: 1 }}><TField label="RCP INIZIO" value={form.rcpInizioOre} onChange={v => updateForm("rcpInizioOre", v)} /></View>
              <Pressable style={[s.nowBtn, { marginLeft: 4, alignSelf: "flex-end" }]} onPress={() => setNow("rcpInizioOre")}><Feather name="zap" size={10} color="#FFF" /></Pressable>
            </View>
          </View>
          <View style={{ flex: 1, marginLeft: 6 }}>
            <View style={s.row}>
              <View style={{ flex: 1 }}><TField label="DAE 1 SHOCK" value={form.daeShockOre} onChange={v => updateForm("daeShockOre", v)} /></View>
              <Pressable style={[s.nowBtn, { marginLeft: 4, alignSelf: "flex-end" }]} onPress={() => setNow("daeShockOre")}><Feather name="zap" size={10} color="#FFF" /></Pressable>
            </View>
          </View>
        </View>
        <View style={s.row}>
          <View style={{ flex: 1 }}><FField label="NR. SHOCK" value={form.numeroShock} onChange={v => updateForm("numeroShock", v)} kb="numeric" /></View>
          <View style={{ flex: 1, marginLeft: 6 }}>
            <View style={s.row}>
              <View style={{ flex: 1 }}><TField label="ROSC ORE" value={form.roscOre} onChange={v => updateForm("roscOre", v)} /></View>
              <Pressable style={[s.nowBtn, { marginLeft: 4, alignSelf: "flex-end" }]} onPress={() => setNow("roscOre")}><Feather name="zap" size={10} color="#FFF" /></Pressable>
            </View>
          </View>
        </View>
      </View>

      <Strip title="LOCALIZZAZIONE TRAUMA" color="rgba(220,53,69,0.2)" />
      <View style={[s.section, { borderColor: bd }]}>
        <View style={s.bodyRow}>
          <BodyDiagram title="ANTERIORE" zones={form.traumaZones} onToggle={id => toggleMapItem("traumaZones", id)} bodyZones={BODY_ZONES_FRONT} />
          <BodyDiagram title="POSTERIORE" zones={form.traumaZones} onToggle={id => toggleMapItem("traumaZones", id)} bodyZones={BODY_ZONES_BACK} />
        </View>
      </View>
    </>
  );

  const renderPage3 = () => (
    <>
      <Strip title="PRESTAZIONI" />
      <View style={[s.section, { borderColor: bd }]}>
        <View style={s.cbRow}>
          {PRESTAZIONI_ITEMS.map(pi => <CBox key={pi} on={!!form.prestazioni[pi]} toggle={() => toggleMapItem("prestazioni", pi)} label={pi} w="50%" />)}
        </View>
        {form.prestazioni["Ossigeno"] ? <FField label="O2 l/min" value={form.ossigenoLmin} onChange={v => updateForm("ossigenoLmin", v)} kb="numeric" /> : null}
      </View>

      <Strip title="PRESIDI" />
      <View style={[s.section, { borderColor: bd }]}>
        <View style={s.cbRow}>
          {PRESIDI_ITEMS.map(pi => <CBox key={pi} on={!!form.presidi[pi]} toggle={() => toggleMapItem("presidi", pi)} label={pi} w="50%" />)}
        </View>
      </View>

      <Strip title="DINAMICA TRAUMA" />
      <View style={[s.section, { borderColor: bd }]}>
        <View style={s.cbRow}>
          {DINAMICA_OPTIONS.map(d => <CBox key={d.key} on={!!form.dinamicaTrauma[d.key]} toggle={() => toggleMapItem("dinamicaTrauma", d.key)} label={d.label} w="33%" />)}
        </View>
      </View>

      <Strip title="RIFIUTO TRASPORTO / TRATTAMENTO" color="rgba(220,53,69,0.2)" />
      <View style={[s.section, { borderColor: bd }]}>
        <ThemedText style={s.rifiutoTxt}>
          Io sottoscritto/a, informato/a delle mie condizioni di salute, rifiuto il trasporto in ospedale.
        </ThemedText>
        <View style={s.cbRow}>
          <CBox on={form.rifiutoTrasporto} toggle={() => updateForm("rifiutoTrasporto", !form.rifiutoTrasporto)} label="RIFIUTO TRASPORTO" color="#DC3545" w="50%" />
          <CBox on={form.rifiutoTrattamento} toggle={() => updateForm("rifiutoTrattamento", !form.rifiutoTrattamento)} label="RIFIUTO TRATTAM." color="#DC3545" w="50%" />
        </View>
        {(form.rifiutoTrasporto || form.rifiutoTrattamento) ? <FField label="FIRMA" value={form.firmaRifiuto} onChange={v => updateForm("firmaRifiuto", v)} /> : null}
      </View>

      <Strip title="EQUIPAGGIO" />
      <View style={[s.section, { borderColor: bd }]}>
        <View style={s.row}>
          <View style={{ flex: 1 }}><FField label="AUTISTA" value={form.autista} onChange={v => updateForm("autista", v)} /></View>
          <View style={{ flex: 1, marginLeft: 6 }}><FField label="SOCCORRITORE" value={form.soccorritore} onChange={v => updateForm("soccorritore", v)} /></View>
        </View>
        <View style={s.row}>
          <View style={{ flex: 1 }}><FField label="ALTRO SOCC." value={form.altroSoccorritore} onChange={v => updateForm("altroSoccorritore", v)} /></View>
          <View style={{ flex: 1, marginLeft: 6 }}><FField label="SOCCORRITORE 2" value={form.soccorritore2} onChange={v => updateForm("soccorritore2", v)} /></View>
        </View>
      </View>

      <Strip title="NOTE E CHIUSURA" />
      <View style={[s.section, { borderColor: bd }]}>
        <FField label="NOTE" value={form.note} onChange={v => updateForm("note", v)} ml />
        <ThemedText style={[s.miniLabel, { marginTop: Spacing.sm }]}>CONSEGNA PS (PROC. NR. 11)</ThemedText>
        <View style={s.row}>
          <View style={{ flex: 2 }}><FField label="NOME/COGNOME" value={form.consegnaPsNome} onChange={v => updateForm("consegnaPsNome", v)} /></View>
          <View style={{ flex: 1, marginLeft: 6 }}><TField label="ORE" value={form.consegnaPsOre} onChange={v => updateForm("consegnaPsOre", v)} /></View>
        </View>
        <View style={s.row}>
          {[{ key: "infermiere", label: "INFERM." }, { key: "medico", label: "MEDICO" }].map(t => (
            <Pressable key={t.key}
              style={[s.sexBtn, { backgroundColor: form.consegnaPsTipo === t.key ? "#0066CC" : inputBg, borderColor: form.consegnaPsTipo === t.key ? "transparent" : inputBd }]}
              onPress={() => { if (!IS_WEB) Haptics.selectionAsync(); updateForm("consegnaPsTipo", form.consegnaPsTipo === t.key ? "" : t.key); }}>
              <ThemedText style={[s.sexBtnTxt, form.consegnaPsTipo === t.key ? { color: "#FFF" } : null]}>{t.label}</ThemedText>
            </Pressable>
          ))}
        </View>
        <FField label="FIRMA COMPILATORE" value={form.firmaCompilatore} onChange={v => updateForm("firmaCompilatore", v)} />
      </View>

      <ThemedText style={s.privacy}>
        I dati personali saranno trattati nel rispetto del D. Lgs. 196/2003 e GDPR 679/2016
      </ThemedText>

      <View style={s.actionBtns}>
        <Pressable style={[s.saveBtn, { backgroundColor: "#6C757D" }]} onPress={() => saveMutation.mutate("draft")} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <ActivityIndicator color="#FFF" size="small" /> : (
            <>
              <Feather name="save" size={16} color="#FFF" />
              <ThemedText style={s.saveBtnTxt}>SALVA BOZZA</ThemedText>
            </>
          )}
        </Pressable>
        <Pressable
          style={[s.saveBtn, { backgroundColor: "#00A651" }]}
          onPress={() => Alert.alert("Completare?", "La scheda non potra' essere modificata.", [
            { text: "Annulla", style: "cancel" },
            { text: "Completa", onPress: () => saveMutation.mutate("completed") },
          ])}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? <ActivityIndicator color="#FFF" size="small" /> : (
            <>
              <Feather name="check-circle" size={16} color="#FFF" />
              <ThemedText style={s.saveBtnTxt}>COMPLETA</ThemedText>
            </>
          )}
        </Pressable>
      </View>
    </>
  );

  return (
    <View style={[s.container, { backgroundColor: theme.backgroundRoot }]}>
      <LinearGradient
        colors={isDark ? [theme.backgroundRoot, "#0a1628", "#0d1f3c"] : ["#f8fafc", "#eef5f9", "#e4eff5"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <View style={{ paddingTop: headerHeight + Spacing.xs, paddingHorizontal: Spacing.sm }}>
        <LinearGradient colors={["#0066CC", "#004A99"]} style={s.banner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Feather name="file-text" size={14} color="#FFF" />
          <ThemedText style={s.bannerTxt}>SCHEDA DI SOCCORSO 118</ThemedText>
        </LinearGradient>

        <View style={s.tabBar}>
          {TABS.map((tab, i) => (
            <Pressable
              key={tab}
              style={[s.tab, activeTab === i ? s.tabActive : null]}
              onPress={() => { if (!IS_WEB) Haptics.selectionAsync(); setActiveTab(i); }}
            >
              <View style={[s.tabDot, tabProgress[i] ? s.tabDotFilled : null]} />
              <ThemedText style={[s.tabTxt, activeTab === i ? s.tabTxtActive : null]}>{tab}</ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={{ paddingHorizontal: Spacing.sm, paddingBottom: tabBarHeight + Spacing.xl }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {activeTab === 0 ? renderPage1() : activeTab === 1 ? renderPage2() : renderPage3()}
      </ScrollView>

      <Modal visible={scannerOpen} animationType="slide" presentationStyle="fullScreen">
        <View style={s.scannerContainer}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["code39", "pdf417", "qr"] }}
            onBarcodeScanned={handleBarcodeScan}
          />
          <View style={s.scannerOverlay}>
            <View style={s.scannerFrame} />
          </View>
          <View style={s.scannerBottom}>
            <ThemedText style={s.scannerHint}>Inquadra il codice a barre della Tessera Sanitaria</ThemedText>
            <Pressable style={s.scannerCancel} onPress={() => setScannerOpen(false)}>
              <Feather name="x" size={20} color="#FFF" />
              <ThemedText style={s.scannerCancelTxt}>ANNULLA</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
    gap: 8,
  },
  bannerTxt: { color: "#FFF", fontSize: 13, fontWeight: "800", letterSpacing: 2 },
  tabBar: { flexDirection: "row", marginBottom: Spacing.xs, gap: 4 },
  tab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    borderRadius: BorderRadius.sm,
    backgroundColor: "rgba(0,102,204,0.08)",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  tabActive: { backgroundColor: "#0066CC" },
  tabTxt: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5, color: "#0066CC" },
  tabTxtActive: { color: "#FFF" },
  tabDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(0,0,0,0.15)" },
  tabDotFilled: { backgroundColor: "#00A651" },
  section: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    marginBottom: 5,
    overflow: "hidden",
  },
  strip: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
    marginBottom: 3,
    marginTop: 5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stripText: { fontSize: 10, fontWeight: "800", letterSpacing: 1, color: "#0066CC" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", gap: 8, marginBottom: Spacing.xs },
  hField: { flex: 1 },
  hLabel: { fontSize: 9, fontWeight: "700", opacity: 0.6, letterSpacing: 1 },
  hValue: { fontSize: 15, fontWeight: "700", marginTop: 1 },
  miniLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8, opacity: 0.6, marginBottom: 3, marginTop: 5 },
  codeRow: { flexDirection: "row", gap: 4, marginTop: 4 },
  codeBtn: { flex: 1, height: 34, borderRadius: BorderRadius.xs, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "transparent" },
  codeBtnOn: { borderColor: "#000", transform: [{ scale: 1.05 }] },
  codeBtnTxt: { fontSize: 14, fontWeight: "900" },
  timeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  timeCell: { width: "31.5%", flexDirection: "row", alignItems: "flex-end", gap: 2 },
  nowBtn: { backgroundColor: "#0066CC", width: 24, height: 24, borderRadius: BorderRadius.xs, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  cb: { flexDirection: "row", alignItems: "center", paddingVertical: 4 },
  cbBox: { width: 18, height: 18, borderRadius: 3, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginRight: 5 },
  cbLabel: { fontSize: 11, fontWeight: "500" },
  cbRow: { flexDirection: "row", flexWrap: "wrap", rowGap: 2 },
  tf: { flex: 1 },
  tfLabel: { fontSize: 8, fontWeight: "700", letterSpacing: 0.5, opacity: 0.6, marginBottom: 1 },
  tfInput: { height: 30, borderRadius: BorderRadius.xs, borderWidth: 1, paddingHorizontal: 4, fontSize: 12, textAlign: "center", fontWeight: "600" },
  ff: { marginBottom: 4 },
  ffLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 0.5, opacity: 0.6, marginBottom: 1 },
  ffInput: { height: 34, borderRadius: BorderRadius.xs, borderWidth: 1, paddingHorizontal: Spacing.sm, fontSize: 13 },
  row: { flexDirection: "row", alignItems: "flex-start" },
  sexBtn: { width: 38, height: 34, borderRadius: BorderRadius.xs, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  sexBtnTxt: { fontSize: 14, fontWeight: "700" },
  missionBtn: { width: 38, height: 34, borderRadius: BorderRadius.xs, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  missionTxt: { fontSize: 16, fontWeight: "900" },
  avpuBtn: { width: 34, height: 34, borderRadius: BorderRadius.xs, borderWidth: 1, alignItems: "center", justifyContent: "center", marginRight: 4 },
  avpuTxt: { fontSize: 14, fontWeight: "900" },
  paramRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "rgba(0,0,0,0.1)" },
  paramCell: { width: 56, paddingVertical: 3, paddingHorizontal: 2, alignItems: "center", justifyContent: "center" },
  paramHeaderCell: { backgroundColor: "rgba(0,102,204,0.08)" },
  paramHdrTxt: { fontSize: 8, fontWeight: "800", letterSpacing: 0.3 },
  paramIdxTxt: { fontSize: 8, fontWeight: "700", color: "#0066CC" },
  paramInputWrap: { width: "100%" },
  paramInput: { height: 26, borderRadius: 3, borderWidth: 0.5, fontSize: 11, textAlign: "center", fontWeight: "600", paddingHorizontal: 2 },
  bodyRow: { flexDirection: "row", justifyContent: "space-around", alignItems: "flex-start", paddingVertical: Spacing.sm },
  bodyCol: { alignItems: "center", flex: 1 },
  bodyTitle: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5, marginBottom: 6, color: "#0066CC" },
  traumaTagRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginTop: 6 },
  traumaTag: { backgroundColor: "rgba(220,53,69,0.15)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: BorderRadius.xs, margin: 2 },
  traumaTagTxt: { fontSize: 9, fontWeight: "600", color: "#DC3545" },
  rifiutoTxt: { fontSize: 11, fontStyle: "italic", opacity: 0.7, marginBottom: Spacing.xs, lineHeight: 15 },
  privacy: { fontSize: 8, opacity: 0.4, textAlign: "center", marginVertical: Spacing.sm, lineHeight: 11 },
  actionBtns: { gap: Spacing.sm, marginTop: Spacing.sm },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", height: 46, borderRadius: BorderRadius.md, gap: 8 },
  saveBtnTxt: { color: "#FFF", fontSize: 14, fontWeight: "800", letterSpacing: 1 },
  scanBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00A651",
    height: 44,
    borderRadius: BorderRadius.sm,
    gap: 8,
    marginBottom: Spacing.sm,
  },
  scanBtnTxt: { color: "#FFF", fontSize: 13, fontWeight: "700", letterSpacing: 0.5 },
  gpsBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#00A651",
    height: 30,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.xs,
    gap: 5,
  },
  gpsBtnTxt: { color: "#FFF", fontSize: 10, fontWeight: "700" },
  scannerContainer: { flex: 1, backgroundColor: "#000" },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  scannerFrame: {
    width: SCREEN_W * 0.75,
    height: 120,
    borderWidth: 2,
    borderColor: "#00A651",
    borderRadius: 12,
    backgroundColor: "transparent",
  },
  scannerBottom: {
    position: "absolute",
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: "center",
    gap: 16,
  },
  scannerHint: { color: "#FFF", fontSize: 14, fontWeight: "600", textAlign: "center", paddingHorizontal: 24 },
  scannerCancel: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    gap: 8,
  },
  scannerCancelTxt: { color: "#FFF", fontSize: 14, fontWeight: "700" },
});
