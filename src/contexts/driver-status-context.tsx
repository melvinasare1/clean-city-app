import React, { createContext, useContext } from "react";
import type { DriverStatus } from "@/services/driver-api";

type DriverStatusContextValue = {
  refreshDriverStatus: () => Promise<void>;
};

const DriverStatusContext = createContext<DriverStatusContextValue | undefined>(undefined);

export const DriverStatusProvider = DriverStatusContext.Provider;

export function useDriverStatus(): DriverStatusContextValue {
  const ctx = useContext(DriverStatusContext);
  if (!ctx) {
    throw new Error("useDriverStatus must be used within DriverStatusProvider");
  }
  return ctx;
}
