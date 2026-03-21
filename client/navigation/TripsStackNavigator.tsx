import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import TripsListScreen from "@/screens/TripsListScreen";
import TripEditScreen from "@/screens/TripEditScreen";
import TripReportScreen from "@/screens/TripReportScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type TripsStackParamList = {
  TripsList: undefined;
  TripEdit: { tripId: string };
  TripReport: { tripId: string };
};

const Stack = createNativeStackNavigator<TripsStackParamList>();

export default function TripsStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="TripsList"
        component={TripsListScreen}
        options={{
          headerTitle: "I Miei Viaggi",
        }}
      />
      <Stack.Screen
        name="TripEdit"
        component={TripEditScreen}
        options={{
          headerTitle: "Modifica Viaggio",
        }}
      />
      <Stack.Screen
        name="TripReport"
        component={TripReportScreen}
        options={{
          headerTitle: "Scheda Viaggio",
        }}
      />
    </Stack.Navigator>
  );
}
