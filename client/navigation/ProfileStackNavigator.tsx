import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ProfileScreen from "@/screens/ProfileScreen";
import DocumentScannerScreen from "@/screens/DocumentScannerScreen";
import VehicleDetailScreen from "@/screens/VehicleDetailScreen";
import ChecklistScreen from "@/screens/ChecklistScreen";
import InventoryScreen from "@/screens/InventoryScreen";
import InventoryScannerScreen from "@/screens/InventoryScannerScreen";
import PrivacyScreen from "@/screens/PrivacyScreen";
import SportingEventScreen from "@/screens/SportingEventScreen";
import NotificationsSettingsScreen from "@/screens/NotificationsSettingsScreen";
import ScadenzeScreen from "@/screens/ScadenzeScreen";
import MaterialiScadutiScreen from "@/screens/MaterialiScadutiScreen";
import StaffProfileScreen from "@/screens/StaffProfileScreen";
import InfoAppScreen from "@/screens/InfoAppScreen";
import AssistenzaScreen from "@/screens/AssistenzaScreen";
import FuelCardScreen from "@/screens/FuelCardScreen";
import VehicleDocumentsScreen from "@/screens/VehicleDocumentsScreen";
import SanitizationLogScreen from "@/screens/SanitizationLogScreen";
import RescueSheetScreen from "@/screens/RescueSheetScreen";
import RescueSheetListScreen from "@/screens/RescueSheetListScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type ProfileStackParamList = {
  Profile: undefined;
  VehicleDetail: undefined;
  Checklist: undefined;
  Inventory: undefined;
  InventoryScanner: undefined;
  Privacy: undefined;
  SportingEvent: undefined;
  NotificationsSettings: undefined;
  Scadenze: undefined;
  MaterialiScaduti: undefined;
  StaffProfile: undefined;
  InfoApp: undefined;
  Assistenza: undefined;
  FuelCard: undefined;
  VehicleDocuments: undefined;
  SanitizationLog: undefined;
  RescueSheet: undefined;
  RescueSheetList: undefined;

  DocumentScanner: {
    onCapture?: (uri: string) => void;
    documentType?: "foglio_servizio" | "documento_paziente" | "altro";
  };
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileStackNavigator() {
  const screenOptions = useScreenOptions();
  const opaqueScreenOptions = useScreenOptions({ transparent: false });

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          headerTitle: "Profilo",
          ...opaqueScreenOptions,
        }}
      />
      <Stack.Screen
        name="VehicleDetail"
        component={VehicleDetailScreen}
        options={{
          headerTitle: "Dettaglio Veicolo",
        }}
      />
      <Stack.Screen
        name="Checklist"
        component={ChecklistScreen}
        options={{
          headerTitle: "Checklist Pre-Partenza",
        }}
      />
      <Stack.Screen
        name="Inventory"
        component={InventoryScreen}
        options={{
          headerTitle: "Inventario Materiali",
        }}
      />
      <Stack.Screen
        name="InventoryScanner"
        component={InventoryScannerScreen}
        options={{
          headerShown: false,
          presentation: "fullScreenModal",
        }}
      />
      <Stack.Screen
        name="Privacy"
        component={PrivacyScreen}
        options={{
          headerTitle: "Privacy e Dati",
          ...opaqueScreenOptions,
        }}
      />
      <Stack.Screen
        name="SportingEvent"
        component={SportingEventScreen}
        options={{
          headerTitle: "Evento Sportivo",
        }}
      />
      <Stack.Screen
        name="DocumentScanner"
        component={DocumentScannerScreen}
        options={{
          headerShown: false,
          presentation: "fullScreenModal",
        }}
      />
      <Stack.Screen
        name="NotificationsSettings"
        component={NotificationsSettingsScreen}
        options={{
          headerTitle: "Notifiche",
        }}
      />
      <Stack.Screen
        name="Scadenze"
        component={ScadenzeScreen}
        options={{
          headerTitle: "Scadenze Materiali",
        }}
      />
      <Stack.Screen
        name="MaterialiScaduti"
        component={MaterialiScadutiScreen}
        options={{
          headerTitle: "Materiali da Ripristinare",
        }}
      />
      <Stack.Screen
        name="StaffProfile"
        component={StaffProfileScreen}
        options={{
          headerTitle: "Profilo Personale",
        }}
      />
      <Stack.Screen
        name="InfoApp"
        component={InfoAppScreen}
        options={{
          headerTitle: "Info App",
        }}
      />
      <Stack.Screen
        name="Assistenza"
        component={AssistenzaScreen}
        options={{
          headerTitle: "Assistenza",
        }}
      />
      <Stack.Screen
        name="FuelCard"
        component={FuelCardScreen}
        options={{
          headerTitle: "Carburante",
        }}
      />
      <Stack.Screen
        name="VehicleDocuments"
        component={VehicleDocumentsScreen}
        options={{
          headerTitle: "Documenti Veicolo",
        }}
      />
      <Stack.Screen
        name="SanitizationLog"
        component={SanitizationLogScreen}
        options={{
          headerTitle: "Registro Sanificazioni",
        }}
      />
      <Stack.Screen
        name="RescueSheetList"
        component={RescueSheetListScreen}
        options={{
          headerTitle: "Schede di Soccorso",
        }}
      />
      <Stack.Screen
        name="RescueSheet"
        component={RescueSheetScreen}
        options={{
          headerTitle: "Nuova Scheda di Soccorso",
        }}
      />
    </Stack.Navigator>
  );
}
