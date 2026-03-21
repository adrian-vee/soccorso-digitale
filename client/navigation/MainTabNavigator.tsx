import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { CommonActions } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { StyleSheet, View, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import HomeStackNavigator from "@/navigation/HomeStackNavigator";
import TripsStackNavigator from "@/navigation/TripsStackNavigator";
import TripEntryStackNavigator from "@/navigation/TripEntryStackNavigator";
import HubStackNavigator from "@/navigation/HubStackNavigator";
import ProfileStackNavigator from "@/navigation/ProfileStackNavigator";
import { useTheme } from "@/hooks/useTheme";

export type MainTabParamList = {
  HomeTab: undefined;
  TripsTab: undefined;
  TripEntryTab: undefined;
  HubTab: undefined;
  ProfileTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const resetTabListener = ({ navigation, route }: any) => ({
  tabPress: (e: any) => {
    const state = navigation.getState();
    const tabRoute = state.routes.find((r: any) => r.key === route.key);
    if (tabRoute?.state && tabRoute.state.routes.length > 1) {
      e.preventDefault();
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: route.name }],
        })
      );
    }
  },
});

function TabIcon({ name, color, size }: { name: string; color: string; size: number; focused: boolean }) {
  return (
    <Feather name={name as any} size={size} color={color} />
  );
}

export default function MainTabNavigator() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 4);
  const tabBarHeight = 60 + bottomInset;

  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isDark ? theme.backgroundRoot : "#FFFFFF",
          borderTopWidth: 0,
          elevation: 0,
          height: tabBarHeight,
          paddingBottom: bottomInset,
          paddingTop: 4,
          ...Platform.select({
            ios: {
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: isDark ? 0.3 : 0.08,
              shadowRadius: 12,
            },
            android: {
              elevation: 12,
            },
            default: {
              boxShadow: isDark
                ? "0 -4px 20px rgba(0,0,0,0.4)"
                : "0 -4px 20px rgba(0,0,0,0.06)",
            },
          }),
        },
        tabBarItemStyle: {
          paddingTop: 6,
          paddingBottom: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginTop: 0,
          marginBottom: 0,
        },
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          title: "Home",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="home" color={color} size={size} focused={focused} />
          ),
        }}
        listeners={resetTabListener}
      />
      <Tab.Screen
        name="TripsTab"
        component={TripsStackNavigator}
        options={{
          title: "Storico",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="list" color={color} size={size} focused={focused} />
          ),
        }}
        listeners={resetTabListener}
      />
      <Tab.Screen
        name="TripEntryTab"
        component={TripEntryStackNavigator}
        options={{
          title: "Inserisci",
          tabBarIcon: ({ focused }) => (
            <View style={styles.fabContainer}>
              <View style={[
                styles.fabShadow,
                isDark ? styles.fabShadowDark : styles.fabShadowLight,
              ]}>
                <LinearGradient
                  colors={isDark
                    ? ["#5BB8FF", "#3D8FE8", "#2B6DC4"]
                    : ["#3399FF", "#0066CC", "#004C99"]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.fabGradient}
                >
                  <Feather
                    name="plus"
                    size={28}
                    color="#FFFFFF"
                  />
                </LinearGradient>
              </View>
            </View>
          ),
          tabBarLabel: () => null,
        }}
        listeners={resetTabListener}
      />
      <Tab.Screen
        name="HubTab"
        component={HubStackNavigator}
        options={{
          title: "Hub",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="globe" color={color} size={size} focused={focused} />
          ),
        }}
        listeners={resetTabListener}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{
          title: "Profilo",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="user" color={color} size={size} focused={focused} />
          ),
        }}
        listeners={resetTabListener}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  fabContainer: {
    position: "absolute",
    top: -24,
    alignItems: "center",
    justifyContent: "center",
    width: 56,
    height: 56,
  },
  fabShadow: {
    borderRadius: 28,
    ...Platform.select({
      ios: {},
      android: { elevation: 10 },
      default: {},
    }),
  },
  fabShadowLight: {
    ...Platform.select({
      ios: {
        shadowColor: "#0066CC",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      default: {
        boxShadow: "0 6px 20px rgba(0, 102, 204, 0.4)",
      },
    }),
  },
  fabShadowDark: {
    ...Platform.select({
      ios: {
        shadowColor: "#4DA3FF",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
      },
      default: {
        boxShadow: "0 6px 20px rgba(77, 163, 255, 0.4)",
      },
    }),
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
});
