import { useEffect, useRef, useCallback } from "react";
import { AppState, AppStateStatus } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";

const SYNC_INTERVAL = 30000;

export function useRealtimeSync(enabled: boolean = true) {
  const queryClient = useQueryClient();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const invalidateAllData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
    queryClient.invalidateQueries({ queryKey: ["/api/structures"] });
    queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
    queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
    queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
    queryClient.invalidateQueries({ queryKey: ["/api/checklist-template"] });
  }, [queryClient]);

  const startPolling = useCallback(() => {
    if (intervalRef.current) return;
    
    intervalRef.current = setInterval(() => {
      NetInfo.fetch().then((state) => {
        if (state.isConnected) {
          invalidateAllData();
        }
      });
    }, SYNC_INTERVAL);
  }, [invalidateAllData]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      stopPolling();
      return;
    }

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        invalidateAllData();
        startPolling();
      } else if (nextAppState.match(/inactive|background/)) {
        stopPolling();
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    
    invalidateAllData();
    startPolling();

    return () => {
      subscription.remove();
      stopPolling();
    };
  }, [enabled, invalidateAllData, startPolling, stopPolling]);

  return { refresh: invalidateAllData };
}
