import { useCallback, useEffect, useRef, useState } from 'react';
import {
  newPlacesSessionToken,
  suggestPlaces,
  type AddressSuggestion,
} from '@/lib/google-places-search';

export function usePickupSearch(query: string) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const sessionTokenRef = useRef(newPlacesSessionToken());
  const abortRef = useRef<AbortController | null>(null);

  // Places API (New) bills Autocomplete per session, not per keystroke, as
  // long as every suggestion request in the session reuses this token and
  // the session is then closed with one Place Details call using the same
  // token (see set-pickup-location-map.tsx's handleSelect). Call this only
  // after that Details call completes, or when abandoning a search (e.g. the
  // user switched to GPS instead) — never on every keystroke.
  const resetSession = useCallback(() => {
    sessionTokenRef.current = newPlacesSessionToken();
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    abortRef.current?.abort();

    if (trimmed.length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const handle = setTimeout(() => {
      setSearching(true);
      suggestPlaces(trimmed, sessionTokenRef.current, controller.signal)
        .then((results) => {
          if (!controller.signal.aborted) setSuggestions(results);
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          console.error('Address suggest failed:', err);
          setSuggestions([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 280);

    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [query]);

  return {
    suggestions,
    searching,
    sessionTokenRef,
    resetSession,
    clearSuggestions: () => setSuggestions([]),
  };
}
