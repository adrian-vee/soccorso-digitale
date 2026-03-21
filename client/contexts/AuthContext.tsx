import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiRequest, setAuthToken, clearAuthToken, queryClient } from "@/lib/query-client";
import { scheduleExpiryNotifications } from "@/services/expiryNotifications";

interface Vehicle {
  id: string;
  code: string;
  licensePlate: string | null;
  model: string | null;
  locationId: string;
  currentKm: number | null;
  isOnService: boolean | null;
  fuelType: string | null;
  brand: string | null;
  year: number | null;
  displacement: number | null;
  kw: number | null;
  assignedContractName: string | null;
  assignedContractLogo: string | null;
  workScheduleStart: string | null;
  workScheduleEnd: string | null;
  isAssignedToEvent: boolean | null;
  eventName: string | null;
  eventDate: string | null;
  defaultCrewType: string | null;
}

interface Location {
  id: string;
  name: string;
  address: string | null;
}

interface Organization {
  id: string;
  name: string;
  enabledModules: string[] | null;
  logoUrl: string | null;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  customRoleName: string | null;
  accountType: "person" | "vehicle";
  locationId: string | null;
  vehicle: Vehicle | null;
  location: Location | null;
  organization: Organization | null;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = "@soccorso_digitale_auth";
const AUTH_TOKEN_KEY = "@soccorso_digitale_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredUser();
  }, []);

  const loadStoredUser = async () => {
    try {
      const storedUser = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
      const storedToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      
      if (storedUser && storedToken) {
        const parsed = JSON.parse(storedUser);
        
        // Set token first so API calls work
        await setAuthToken(storedToken);
        
        // Try to refresh from server first for latest data
        try {
          const response = await apiRequest("GET", "/api/auth/me");
          if (response.ok) {
            const data = await response.json();
            if (data.user) {
              // Validate that location data exists for vehicle accounts
              const userData = data.user;
              if (userData.accountType === "vehicle" && userData.vehicle && !userData.location) {
                console.warn("Location missing for vehicle account, using cached data");
                setUser(parsed);
              } else {
                setUser(userData);
                await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userData));
              }
              // Schedule expiry notifications on app startup
              scheduleExpiryNotifications().catch(err => {
                console.log("Failed to schedule expiry notifications:", err);
              });
            } else {
              setUser(parsed);
            }
          } else {
            // API failed with error status - clear invalid session
            console.log("Auth refresh failed, clearing session");
            await AsyncStorage.multiRemove([AUTH_STORAGE_KEY, AUTH_TOKEN_KEY]);
            await clearAuthToken();
            setUser(null);
          }
        } catch (refreshError: any) {
          // Check if it's a 401 error - token is invalid, logout
          if (refreshError?.message?.includes("401")) {
            console.log("Token expired or invalid, logging out");
            await AsyncStorage.multiRemove([AUTH_STORAGE_KEY, AUTH_TOKEN_KEY]);
            await clearAuthToken();
            setUser(null);
          } else {
            // Network error or other issue - use cached data
            console.log("Network error, using cached user data:", refreshError);
            setUser(parsed);
          }
        }
      }
    } catch (error) {
      console.error("Error loading stored user:", error);
      // Clear corrupted storage
      await AsyncStorage.multiRemove([AUTH_STORAGE_KEY, AUTH_TOKEN_KEY]);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    // Clear any previous query cache to ensure fresh data
    queryClient.clear();
    
    const response = await apiRequest("POST", "/api/auth/login", { email, password });
    const data = await response.json();
    
    if (data.user) {
      // Validate user data has required fields for vehicle accounts
      const userData = data.user;
      
      // Log for debugging
      console.log("Login successful:", {
        vehicleCode: userData.vehicle?.code,
        locationName: userData.location?.name,
        locationId: userData.locationId
      });
      
      // Save token first
      if (data.token) {
        await setAuthToken(data.token);
        await AsyncStorage.setItem(AUTH_TOKEN_KEY, data.token);
      }
      
      // Then save user data
      setUser(userData);
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userData));
      
      // Schedule expiry notifications after successful login
      scheduleExpiryNotifications().catch(err => {
        console.log("Failed to schedule expiry notifications:", err);
      });
    } else {
      throw new Error(data.error || "Login failed");
    }
  };

  const logout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout", {});
    } catch (error) {
      console.error("Error during logout:", error);
    }
    
    // Clear all state and cache
    setUser(null);
    queryClient.clear();
    await AsyncStorage.multiRemove([AUTH_STORAGE_KEY, AUTH_TOKEN_KEY]);
    await clearAuthToken();
  };

  const refreshUserData = async () => {
    if (!user) return;
    
    try {
      const response = await apiRequest("GET", "/api/auth/me");
      if (response.ok) {
        const data = await response.json();
        if (data.user) {
          const userData = data.user;
          setUser(userData);
          await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userData));
          
          // Log for debugging
          console.log("User data refreshed:", {
            vehicleCode: userData.vehicle?.code,
            locationName: userData.location?.name
          });
        }
      }
    } catch (error) {
      console.warn("Failed to refresh user data:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUserData }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
