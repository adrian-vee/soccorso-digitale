import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import TripEntryScreen from "@/screens/TripEntryScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type TripEntryStackParamList = {
  TripEntry: undefined;
};

const Stack = createNativeStackNavigator<TripEntryStackParamList>();

export default function TripEntryStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="TripEntry"
        component={TripEntryScreen}
        options={{
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}
