import React, { createContext, useContext } from "react";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

interface RealtimeSyncContextType {
  refresh: () => void;
}

const RealtimeSyncContext = createContext<RealtimeSyncContextType | null>(null);

export function RealtimeSyncProvider({ children }: { children: React.ReactNode }) {
  const { refresh } = useRealtimeSync(true);

  return (
    <RealtimeSyncContext.Provider value={{ refresh }}>
      {children}
    </RealtimeSyncContext.Provider>
  );
}

export function useRealtimeSyncContext() {
  const context = useContext(RealtimeSyncContext);
  if (!context) {
    throw new Error("useRealtimeSyncContext must be used within a RealtimeSyncProvider");
  }
  return context;
}
