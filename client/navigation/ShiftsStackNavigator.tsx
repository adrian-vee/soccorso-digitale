import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ShiftsScreen from "@/screens/ShiftsScreen";
import OpenShiftsScreen from "@/screens/OpenShiftsScreen";
import EventsScreen from "@/screens/EventsScreen";
import SwapRequestsScreen from "@/screens/SwapRequestsScreen";
import AvailabilityScreen from "@/screens/AvailabilityScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type ShiftsStackParamList = {
  ShiftsList: undefined;
  OpenShifts: undefined;
  Events: undefined;
  SwapRequests: undefined;
  Availability: undefined;
};

const Stack = createNativeStackNavigator<ShiftsStackParamList>();

export default function ShiftsStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="ShiftsList"
        component={ShiftsScreen}
        options={{
          headerTitle: "Turni",
        }}
      />
      <Stack.Screen
        name="OpenShifts"
        component={OpenShiftsScreen}
        options={{
          headerTitle: "Turni Scoperti",
        }}
      />
      <Stack.Screen
        name="Events"
        component={EventsScreen}
        options={{
          headerTitle: "Eventi",
        }}
      />
      <Stack.Screen
        name="SwapRequests"
        component={SwapRequestsScreen}
        options={{
          headerTitle: "Scambi Turno",
        }}
      />
      <Stack.Screen
        name="Availability"
        component={AvailabilityScreen}
        options={{
          headerTitle: "Disponibilita",
        }}
      />
    </Stack.Navigator>
  );
}
