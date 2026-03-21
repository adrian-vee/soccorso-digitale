import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HubMissionsScreen from "@/screens/HubMissionsScreen";

export type HubStackParamList = {
  HubMissions: undefined;
};

const Stack = createNativeStackNavigator<HubStackParamList>();

export default function HubStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="HubMissions"
        component={HubMissionsScreen}
      />
    </Stack.Navigator>
  );
}
