import React from "react";
import { View, ActivityIndicator } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabNavigator from "@/navigation/MainTabNavigator";
import LoginScreen from "@/screens/LoginScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/useTheme";

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();
  const { user, isLoading: authLoading } = useAuth();
  const { theme } = useTheme();

  if (authLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.backgroundRoot }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {!user ? (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
      ) : (
        <Stack.Screen
          name="Main"
          component={MainTabNavigator}
          options={{ headerShown: false }}
        />
      )}
    </Stack.Navigator>
  );
}
