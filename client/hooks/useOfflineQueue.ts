import { useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { apiRequest } from "@/lib/query-client";
import { encryptTripData, isEncryptionSupported } from "@/lib/encryption";

const OFFLINE_QUEUE_KEY = "@soccorso_digitale_offline_queue";

export interface QueuedTrip {
  id: string;
  data: any;
  createdAt: number;
  retryCount: number;
  lastError?: string;
}

interface OfflineQueueState {
  queue: QueuedTrip[];
  isOnline: boolean;
  isSyncing: boolean;
  isLoading: boolean;
}

export function useOfflineQueue() {
  const [state, setState] = useState<OfflineQueueState>({
    queue: [],
    isOnline: true,
    isSyncing: false,
    isLoading: true,
  });
  
  const isSyncingRef = useRef(false);
  const onSuccessCallbackRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    loadQueue();
    
    const unsubscribe = NetInfo.addEventListener((netState: NetInfoState) => {
      const online = netState.isConnected === true && netState.isInternetReachable !== false;
      setState(prev => ({ ...prev, isOnline: online }));
      
      if (online && !isSyncingRef.current) {
        syncQueue();
      }
    });

    NetInfo.fetch().then((netState: NetInfoState) => {
      const online = netState.isConnected === true && netState.isInternetReachable !== false;
      setState(prev => ({ ...prev, isOnline: online }));
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const loadQueue = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as QueuedTrip[];
        setState(prev => ({ ...prev, queue: parsed, isLoading: false }));
      } else {
        setState(prev => ({ ...prev, queue: [], isLoading: false }));
      }
    } catch (error) {
      console.error("Error loading offline queue:", error);
      setState(prev => ({ ...prev, queue: [], isLoading: false }));
    }
  }, []);

  const saveQueue = useCallback(async (queue: QueuedTrip[]) => {
    try {
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error("Error saving offline queue:", error);
    }
  }, []);

  const addToQueue = useCallback(async (tripData: any): Promise<boolean> => {
    try {
      const queuedTrip: QueuedTrip = {
        id: `trip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        data: tripData,
        createdAt: Date.now(),
        retryCount: 0,
      };

      const updated = [...state.queue, queuedTrip];
      await saveQueue(updated);
      setState(prev => ({ ...prev, queue: updated }));
      return true;
    } catch (error) {
      console.error("Error adding to queue:", error);
      return false;
    }
  }, [state.queue, saveQueue]);

  const removeFromQueue = useCallback(async (tripId: string) => {
    try {
      const updated = state.queue.filter(t => t.id !== tripId);
      await saveQueue(updated);
      setState(prev => ({ ...prev, queue: updated }));
    } catch (error) {
      console.error("Error removing from queue:", error);
    }
  }, [state.queue, saveQueue]);

  const syncQueue = useCallback(async () => {
    if (isSyncingRef.current || state.queue.length === 0) return;
    
    isSyncingRef.current = true;
    setState(prev => ({ ...prev, isSyncing: true }));

    const currentQueue = [...state.queue];
    const successfulIds: string[] = [];
    const failedTrips: QueuedTrip[] = [];

    for (const trip of currentQueue) {
      try {
        await apiRequest("POST", "/api/trips", trip.data);
        successfulIds.push(trip.id);
      } catch (error: any) {
        const updatedTrip = {
          ...trip,
          retryCount: trip.retryCount + 1,
          lastError: error.message || "Errore di sincronizzazione",
        };
        
        if (updatedTrip.retryCount < 5) {
          failedTrips.push(updatedTrip);
        }
      }
    }

    const remainingQueue = failedTrips;
    await saveQueue(remainingQueue);
    setState(prev => ({ ...prev, queue: remainingQueue, isSyncing: false }));
    isSyncingRef.current = false;

    if (successfulIds.length > 0 && onSuccessCallbackRef.current) {
      onSuccessCallbackRef.current();
    }
  }, [state.queue, saveQueue]);

  const submitTrip = useCallback(async (
    tripData: any,
    options?: { onSuccess?: () => void; onError?: (error: any) => void }
  ): Promise<{ success: boolean; queued: boolean; encrypted: boolean }> => {
    onSuccessCallbackRef.current = options?.onSuccess || null;

    let dataToSend = tripData;
    let wasEncrypted = false;
    
    if (isEncryptionSupported()) {
      try {
        const encryptionResult = await encryptTripData(tripData);
        dataToSend = encryptionResult.data;
        wasEncrypted = encryptionResult.encrypted;
      } catch (error) {
        console.warn("Encryption failed, sending unencrypted:", error);
      }
    }

    if (!state.isOnline) {
      const added = await addToQueue(dataToSend);
      if (added) {
        return { success: true, queued: true, encrypted: wasEncrypted };
      }
      return { success: false, queued: false, encrypted: false };
    }

    try {
      await apiRequest("POST", "/api/trips", dataToSend);
      if (options?.onSuccess) {
        options.onSuccess();
      }
      return { success: true, queued: false, encrypted: wasEncrypted };
    } catch (error: any) {
      const netState = await NetInfo.fetch();
      const isOnline = netState.isConnected === true && netState.isInternetReachable !== false;
      
      if (!isOnline) {
        const added = await addToQueue(dataToSend);
        if (added) {
          return { success: true, queued: true, encrypted: wasEncrypted };
        }
      }
      
      if (options?.onError) {
        options.onError(error);
      }
      return { success: false, queued: false, encrypted: false };
    }
  }, [state.isOnline, addToQueue]);

  const retrySync = useCallback(async () => {
    const netState = await NetInfo.fetch();
    const isOnline = netState.isConnected === true && netState.isInternetReachable !== false;
    
    if (isOnline) {
      await syncQueue();
    }
  }, [syncQueue]);

  const clearQueue = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
      setState(prev => ({ ...prev, queue: [] }));
    } catch (error) {
      console.error("Error clearing queue:", error);
    }
  }, []);

  return {
    queue: state.queue,
    pendingCount: state.queue.length,
    isOnline: state.isOnline,
    isSyncing: state.isSyncing,
    isLoading: state.isLoading,
    isEncryptionSupported: isEncryptionSupported(),
    addToQueue,
    removeFromQueue,
    submitTrip,
    retrySync,
    clearQueue,
    reload: loadQueue,
  };
}
