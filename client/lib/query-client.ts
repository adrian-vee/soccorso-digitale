import { QueryClient, QueryFunction } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// Cache the API URL to avoid repeated computation
let cachedApiUrl: string | null = null;

const AUTH_TOKEN_KEY = "soccorso_digitale_auth_token";

// Get auth token from secure storage
export async function getAuthToken(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      return localStorage.getItem(AUTH_TOKEN_KEY);
    }
    return await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

// Save auth token to secure storage
export async function setAuthToken(token: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
    }
  } catch (error) {
    console.error("Error saving auth token:", error);
  }
}

// Clear auth token from secure storage
export async function clearAuthToken(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    } else {
      await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
    }
  } catch (error) {
    console.error("Error clearing auth token:", error);
  }
}

/**
 * Gets the base URL for the Express API server
 * Works in both development and production:
 * - Development: Uses EXPO_PUBLIC_DOMAIN from env
 * - Production Web: Uses current window.location.origin
 * @returns {string} The API base URL
 */
export function getApiUrl(): string {
  // Return cached value if available
  if (cachedApiUrl) {
    return cachedApiUrl;
  }

  // First try the explicit env variable (set during development)
  const envDomain = process.env.EXPO_PUBLIC_DOMAIN;
  if (envDomain) {
    cachedApiUrl = `https://${envDomain}/`;
    return cachedApiUrl;
  }

  // For web platform, use the current origin
  if (typeof window !== "undefined" && window.location?.origin) {
    cachedApiUrl = window.location.origin + "/";
    return cachedApiUrl;
  }

  // For mobile (Expo Go), try to get the host from the manifest
  try {
    const Constants = require("expo-constants").default;
    const hostUri = Constants?.manifest?.hostUri || 
                    Constants?.manifest2?.extra?.expoClient?.hostUri;
    
    if (hostUri) {
      const host = hostUri.split(":")[0];
      if (host && !host.includes("localhost")) {
        cachedApiUrl = `https://${host}/`;
        return cachedApiUrl;
      }
    }
  } catch (e) {
    // expo-constants not available, continuing with fallback
  }

  // Final fallback: use relative URL (works when served from same origin)
  cachedApiUrl = "/";
  return cachedApiUrl;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown | undefined,
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = new URL(route, baseUrl);

  const headers: Record<string, string> = {};
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  
  // Add auth token if available
  const token = await getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrl = getApiUrl();
    const url = new URL(queryKey.join("/") as string, baseUrl);

    const headers: Record<string, string> = {};
    
    // Add auth token if available
    const token = await getAuthToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(url, {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true,
      staleTime: 30000,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

export function invalidateAllQueries() {
  queryClient.invalidateQueries();
}

export function invalidateQuery(queryKey: string[]) {
  queryClient.invalidateQueries({ queryKey });
}
