import React, { createContext, useContext, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useDriverRealtime } from '@/hooks/useDriverRealtime';
import type { DriverShift } from '@/services/driver-api';

function isShiftOnline(shift: DriverShift | null): boolean {
  return Boolean(shift?.shiftStartedAt && !shift?.shiftEndedAt);
}

type DriverShiftContextValue = {
  shift: DriverShift | null;
  setShift: (shift: DriverShift | null) => void;
  isOnline: boolean;
};

const DriverShiftContext = createContext<DriverShiftContextValue | undefined>(undefined);

export function DriverShiftProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [shift, setShift] = useState<DriverShift | null>(null);
  const isOnline = isShiftOnline(shift);

  useDriverRealtime(user?.id ?? '', isOnline);

  const value = useMemo(
    () => ({ shift, setShift, isOnline }),
    [shift, isOnline]
  );

  return <DriverShiftContext.Provider value={value}>{children}</DriverShiftContext.Provider>;
}

export function useDriverShift(): DriverShiftContextValue {
  const ctx = useContext(DriverShiftContext);
  if (!ctx) {
    throw new Error('useDriverShift must be used within DriverShiftProvider');
  }
  return ctx;
}
