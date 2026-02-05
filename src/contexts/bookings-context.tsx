import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BOOKINGS_COLLECTION } from '@/lib/constants';
import type { Booking } from '@/types/booking';

interface BookingsState {
  bookings: Booking[];
  loading: boolean;
  error: string | null;
  lastUpdatedAt: number | null;
}

interface BookingsContextValue extends BookingsState {
  /**
   * Subscribe to user's bookings. Call this when screen mounts.
   * Returns unsubscribe function.
   */
  subscribeToUserBookings: (userId: string) => Unsubscribe | null;
  /**
   * Manually refresh bookings (for pull-to-refresh).
   * When using onSnapshot, this is rarely needed.
   */
  refreshBookings: () => void;
  /**
   * Add a booking to the store optimistically (before Firestore sync).
   */
  addBookingOptimistically: (booking: Booking) => void;
  /**
   * Update a booking in the store optimistically.
   */
  updateBookingOptimistically: (bookingId: string, updates: Partial<Booking>) => void;
  /**
   * Remove a booking from the store optimistically.
   */
  removeBookingOptimistically: (bookingId: string) => void;
}

const BookingsContext = createContext<BookingsContextValue | undefined>(undefined);

const BOOKINGS_LIMIT = 20;

export const BookingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<BookingsState>({
    bookings: [],
    loading: false,
    error: null,
    lastUpdatedAt: null,
  });

  const unsubscribeRef = useRef<Unsubscribe | null>(null);

  const subscribeToUserBookings = useCallback((userId: string): Unsubscribe | null => {
    if (!userId) {
      console.warn('[BookingsStore] Cannot subscribe without userId');
      setState({
        bookings: [],
        loading: false,
        error: null,
        lastUpdatedAt: null,
      });
      return null;
    }

    // Clean up previous subscription if any
    if (unsubscribeRef.current) {
      console.log('[BookingsStore] Cleaning up previous subscription');
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    console.log('[BookingsStore] Setting up realtime subscription for user:', userId);
    setState((prev) => ({ ...prev, loading: true, error: null }));

    const bookingsRef = collection(db, BOOKINGS_COLLECTION);
    const q = query(
      bookingsRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(BOOKINGS_LIMIT)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        console.log(`[BookingsStore] Received snapshot with ${snapshot.docs.length} bookings`);
        
        const bookings: Booking[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as Partial<Omit<Booking, 'id'>>;
          return {
            id: docSnap.id,
            userId: data.userId ?? '',
            date: data.date ?? '',
            windowId: data.windowId as any,
            windowLabel: data.windowLabel ?? '',
            location: data.location ?? '',
            items: data.items ?? [],
            totalPrice: data.totalPrice ?? 0,
            status: (data.status ?? 'pending') as Booking['status'],
            createdAt: (data.createdAt as Booking['createdAt']) ?? null,
            type: (data.type ?? 'one_off') as any,
            recurrence: data.recurrence as any,
            payment: data.payment ?? { status: 'unpaid' },
          };
        });

        setState({
          bookings,
          loading: false,
          error: null,
          lastUpdatedAt: Date.now(),
        });
      },
      (error) => {
        console.error('[BookingsStore] Snapshot error:', error);
        setState((prev) => ({
          ...prev,
          loading: false,
          error: 'Failed to load bookings. Please try again.',
        }));
      }
    );

    unsubscribeRef.current = unsubscribe;
    return unsubscribe;
  }, []);

  const refreshBookings = useCallback(() => {
    // When using onSnapshot, this is a no-op since Firestore handles updates.
    // We keep this method for compatibility and pull-to-refresh UX.
    console.log('[BookingsStore] Manual refresh requested (onSnapshot handles updates automatically)');
    setState((prev) => ({ ...prev, lastUpdatedAt: Date.now() }));
  }, []);

  const addBookingOptimistically = useCallback((booking: Booking) => {
    console.log('[BookingsStore] Adding booking optimistically:', booking.id);
    setState((prev) => ({
      ...prev,
      bookings: [booking, ...prev.bookings],
      lastUpdatedAt: Date.now(),
    }));
  }, []);

  const updateBookingOptimistically = useCallback((bookingId: string, updates: Partial<Booking>) => {
    console.log('[BookingsStore] Updating booking optimistically:', bookingId);
    setState((prev) => ({
      ...prev,
      bookings: prev.bookings.map((b) =>
        b.id === bookingId ? { ...b, ...updates } : b
      ),
      lastUpdatedAt: Date.now(),
    }));
  }, []);

  const removeBookingOptimistically = useCallback((bookingId: string) => {
    console.log('[BookingsStore] Removing booking optimistically:', bookingId);
    setState((prev) => ({
      ...prev,
      bookings: prev.bookings.filter((b) => b.id !== bookingId),
      lastUpdatedAt: Date.now(),
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        console.log('[BookingsStore] Cleaning up subscription on unmount');
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);

  const value: BookingsContextValue = {
    ...state,
    subscribeToUserBookings,
    refreshBookings,
    addBookingOptimistically,
    updateBookingOptimistically,
    removeBookingOptimistically,
  };

  return <BookingsContext.Provider value={value}>{children}</BookingsContext.Provider>;
};

export const useBookings = () => {
  const context = useContext(BookingsContext);
  if (!context) {
    throw new Error('useBookings must be used within a BookingsProvider');
  }
  return context;
};
