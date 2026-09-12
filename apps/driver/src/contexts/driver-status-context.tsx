import React, { createContext, useContext } from "react";

type DriverStatusContextValue = {
  refreshDriverStatus: () => Promise<void>;
  isApproved: boolean;
  statusLoading: boolean;
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
