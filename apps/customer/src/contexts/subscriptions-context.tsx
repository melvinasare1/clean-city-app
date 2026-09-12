import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import type { Unsubscribe } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import type { Subscription } from "@/types/subscription";
import { subscribeToUserSubscriptions } from "@/services/subscription-service";

interface SubscriptionsState {
  subscriptions: Subscription[];
  loading: boolean;
  error: string | null;
}

interface SubscriptionsContextValue extends SubscriptionsState {
  subscribeToUserSubscriptions: (userId: string) => Unsubscribe | null;
  refreshSubscriptions: () => void;
}

const SubscriptionsContext = createContext<SubscriptionsContextValue | undefined>(undefined);

export const SubscriptionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [state, setState] = useState<SubscriptionsState>({
    subscriptions: [],
    loading: false,
    error: null,
  });

  const unsubscribeRef = useRef<Unsubscribe | null>(null);

  const subscribe = useCallback((userId: string): Unsubscribe | null => {
    if (!userId) {
      setState({ subscriptions: [], loading: false, error: null });
      return null;
    }

    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    const unsubscribe = subscribeToUserSubscriptions(
      userId,
      (subscriptions) => {
        setState({
          subscriptions,
          loading: false,
          error: null,
        });
      },
      (err) => {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err?.message ?? "Failed to load subscriptions.",
        }));
      }
    );

    unsubscribeRef.current = unsubscribe;
    return unsubscribe;
  }, []);

  /** Real-time subscriptions for the signed-in user (app-wide, not tied to one tab). */
  useEffect(() => {
    if (!user?.id) {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      setState({ subscriptions: [], loading: false, error: null });
      return;
    }
    subscribe(user.id);
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [user?.id, subscribe]);

  const refreshSubscriptions = useCallback(() => {
    setState((prev) => ({ ...prev }));
  }, []);

  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);

  const value: SubscriptionsContextValue = {
    ...state,
    subscribeToUserSubscriptions: subscribe,
    refreshSubscriptions,
  };

  return (
    <SubscriptionsContext.Provider value={value}>
      {children}
    </SubscriptionsContext.Provider>
  );
};

export const useSubscriptions = () => {
  const context = useContext(SubscriptionsContext);
  if (!context) {
    throw new Error("useSubscriptions must be used within a SubscriptionsProvider");
  }
  return context;
};
