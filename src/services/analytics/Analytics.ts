/**
 * AnalyticsService
 *
 * Aptabase analytics wrapper for CleanCityApp.
 * Uses @aptabase/react-native for event tracking.
 *
 * NOTE:
 * - Only strings and numbers are allowed in custom properties (Aptabase requirement)
 * - Events are sent asynchronously in the background
 * - The SDK automatically enhances events with OS, app version, etc.
 */

import { trackEvent as aptabaseTrackEvent } from "@aptabase/react-native";
import { useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";

export type AnalyticsParamValue = string | number | boolean | null | undefined;

export type AnalyticsParams = Record<string, AnalyticsParamValue>;

const isDev =
  (typeof __DEV__ !== "undefined" && __DEV__) ||
  process.env.NODE_ENV !== "production";

/**
 * Filter and sanitize parameters to only include strings and numbers
 * (Aptabase requirement: only strings and numbers allowed)
 */
function sanitizeParams(
  params?: AnalyticsParams
): Record<string, string | number> | undefined {
  if (!params) {
    return undefined;
  }

  const sanitized: Record<string, string | number> = {};

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) {
      continue; // Skip null/undefined values
    }

    if (typeof value === "string" || typeof value === "number") {
      sanitized[key] = value;
    } else if (typeof value === "boolean") {
      // Convert boolean to number (0 or 1)
      sanitized[key] = value ? 1 : 0;
    }
    // Arrays and objects are skipped (Aptabase doesn't support them)
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

class AnalyticsService {
  private initialized = false;

  /**
   * Idempotent initialization.
   */
  public async init(): Promise<void> {
    if (this.initialized) {
      return;
    }
    // Aptabase is initialized in App.tsx, so we just mark as initialized
    this.initialized = true;
    return Promise.resolve();
  }

  /**
   * Track a custom event.
   */
  public async track(
    eventName: string,
    params?: AnalyticsParams
  ): Promise<void> {
    try {
      await this.init();
      const sanitizedParams = sanitizeParams(params);
      aptabaseTrackEvent(eventName, sanitizedParams);
      
      // Log in development and first few events in production for debugging
      if (isDev) {
        console.log("[Analytics] 📊 Event tracked:", eventName, sanitizedParams);
      }
      // trackEvent runs in the background, no need to await
    } catch (error) {
      console.error("[Analytics] ❌ Error tracking event:", eventName, error);
      // Don't silently fail - log errors even in production for debugging
    }
  }

  /**
   * Track a screen view using a screen_view event.
   */
  public async screen(
    screenName: string,
    params?: AnalyticsParams
  ): Promise<void> {
    try {
      await this.init();
      const screenParams = {
        screen_name: screenName,
        screen_class: screenName,
        ...sanitizeParams(params),
      };
      aptabaseTrackEvent("screen_view", screenParams);
    } catch (error) {
      if (isDev) {
        console.warn("[Analytics] Error tracking screen:", screenName, error);
      }
    }
  }

  /**
   * Set or clear the current user ID.
   * Note: Aptabase doesn't have a direct identify method, so we track it as an event.
   */
  public async identify(userId: string | null): Promise<void> {
    try {
      await this.init();
      if (userId) {
        aptabaseTrackEvent("user_identified", { userId });
      } else {
        aptabaseTrackEvent("user_logged_out");
      }
    } catch (error) {
      if (isDev) {
        console.warn("[Analytics] Error identifying user:", error);
      }
    }
  }

  /**
   * Set user properties.
   * Note: Aptabase doesn't have a direct setUserProperties method,
   * so we track it as an event with user properties.
   */
  public async setUserProperties(props: AnalyticsParams): Promise<void> {
    try {
      await this.init();
      const sanitizedProps = sanitizeParams(props);
      if (sanitizedProps && Object.keys(sanitizedProps).length > 0) {
        aptabaseTrackEvent("user_properties_updated", sanitizedProps);
      }
    } catch (error) {
      if (isDev) {
        console.warn("[Analytics] Error setting user properties:", error);
      }
    }
  }

  /**
   * Enable or disable analytics collection.
   * Note: Aptabase doesn't have a direct enable/disable method.
   * This is a no-op for now, but you could implement a flag to skip tracking.
   */
  public async setEnabled(enabled: boolean): Promise<void> {
    // No-op: Aptabase doesn't have a built-in enable/disable method
    // You could implement a flag here to conditionally skip tracking if needed
    if (isDev && !enabled) {
      console.log("[Analytics] Analytics collection disabled (no-op)");
    }
  }
}

export const Analytics = new AnalyticsService();

/**
 * Convenience wrapper for tracking events without touching the service instance.
 *
 * Example:
 *   await trackEvent('signup', { method: 'email' });
 */
export const trackEvent = (
  eventName: string,
  params?: AnalyticsParams
): Promise<void> => {
  return Analytics.track(eventName, params);
};

/**
 * Convenience wrapper for identifying users.
 *
 * Example:
 *   await identifyUser('user_123');
 *   await identifyUser(null); // Clear user
 */
export const identifyUser = (userId: string | null): Promise<void> => {
  return Analytics.identify(userId);
};

/**
 * Dev-only helper to quickly verify analytics wiring.
 * Safe to call from a debug button or console in development builds.
 */
export const testAnalytics = async (): Promise<void> => {
  if (!isDev) {
    return;
  }
  await trackEvent("analytics_test", { source: "dev_build" });
};

/**
 * Optional React Navigation helper.
 *
 * Usage inside a screen component:
 *
 *   trackScreenOnFocus('signup_screen');
 */
export const useTrackScreenOnFocus = (
  screenName: string,
  params?: AnalyticsParams
): void => {
  useFocusEffect(
    useCallback(() => {
      Analytics.screen(screenName, params).catch(() => {
        // Errors are already handled internally.
      });
    }, [screenName, JSON.stringify(params)])
  );
};

// Alias with the requested name (can be used directly in components).
export const trackScreenOnFocus = useTrackScreenOnFocus;

// ---------------------------------------------------------------------------
// Example usage (for reference only):
// ---------------------------------------------------------------------------
//
// import { Analytics, trackScreenOnFocus } from '../services/analytics';
//
// // Tracking signup
// await trackEvent('signup', { method: 'email' });
//
// // Tracking payment completed with amount/currency
// await trackEvent('payment_completed', {
//   amount: 4999,
//   currency: 'USD',
// });
//
// // Screen tracking inside a React Navigation screen component
// function SignupScreen() {
//   trackScreenOnFocus('signup_screen');
//   return <View>{/* ... */}</View>;
// }
//
// // Identify on login
// await Analytics.identify('user_123');
//
// // Clear on logout
// await Analytics.identify(null);
