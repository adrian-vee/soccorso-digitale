import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "@/screens/HomeScreen";
import HandoffHistoryScreen from "@/screens/HandoffHistoryScreen";
import MaterialiScadutiScreen from "@/screens/MaterialiScadutiScreen";
import ScheduledMissionsScreen from "@/screens/ScheduledMissionsScreen";
import OggiScreen from "@/screens/OggiScreen";
import SLAScreen from "@/screens/SLAScreen";
import ServiceDetailScreen from "@/screens/ServiceDetailScreen";
import ServiceCompleteScreen from "@/screens/ServiceCompleteScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type HomeStackParamList = {
  Home: undefined;
  HandoffHistory: undefined;
  MaterialiScaduti: undefined;
  ScheduledMissions: undefined;
  Oggi: undefined;
  SLA: undefined;
  ServiceDetail: { serviceId: string };
  ServiceComplete: { serviceId: string };
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

export default function HomeStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="HandoffHistory"
        component={HandoffHistoryScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MaterialiScaduti"
        component={MaterialiScadutiScreen}
        options={{ headerTitle: "Materiali da Ripristinare" }}
      />
      <Stack.Screen
        name="ScheduledMissions"
        component={ScheduledMissionsScreen}
        options={{ headerTitle: "Missioni Programmate" }}
      />
      <Stack.Screen
        name="Oggi"
        component={OggiScreen}
        options={{ headerTitle: "Servizi di Oggi" }}
      />
      <Stack.Screen
        name="SLA"
        component={SLAScreen}
        options={{ headerTitle: "SLA Monitor" }}
      />
      <Stack.Screen
        name="ServiceDetail"
        component={ServiceDetailScreen}
        options={{ headerTitle: "Dettaglio Servizio" }}
      />
      <Stack.Screen
        name="ServiceComplete"
        component={ServiceCompleteScreen}
        options={{ headerTitle: "Chiusura Servizio" }}
      />
    </Stack.Navigator>
  );
}
