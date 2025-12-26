/**
 * AnalyticsService
 *
 * No-op analytics wrapper (Firebase Analytics removed).
 * All analytics calls are logged to console for debugging.
 */

import { useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";

export type AnalyticsParamValue = string | number | boolean | null | undefined;

export type AnalyticsParams = Record<string, AnalyticsParamValue>;

const isDev =
  (typeof __DEV__ !== "undefined" && __DEV__) ||
  process.env.NODE_ENV !== "production";

class AnalyticsService {
  /**
   * Idempotent initialization (no-op).
   */
  public async init(): Promise<void> {
    // No-op: analytics removed
    return Promise.resolve();
  }

  /**
   * Track a custom event (no-op, logs to console).
   */
  public async track(
    eventName: string,
    params?: AnalyticsParams
  ): Promise<void> {
    console.log("[Analytics] trackEvent:", eventName, params || {});
    return Promise.resolve();
  }

  /**
   * Track a screen view (no-op, logs to console).
   */
  public async screen(
    screenName: string,
    params?: AnalyticsParams
  ): Promise<void> {
    console.log("[Analytics] screen:", screenName, params || {});
    return Promise.resolve();
  }

  /**
   * Set or clear the current user ID (no-op, logs to console).
   */
  public async identify(userId: string | null): Promise<void> {
    console.log("[Analytics] identifyUser:", userId);
    return Promise.resolve();
  }

  /**
   * Set user properties (no-op, logs to console).
   */
  public async setUserProperties(props: AnalyticsParams): Promise<void> {
    console.log("[Analytics] setUserProperties:", props);
    return Promise.resolve();
  }

  /**
   * Enable or disable analytics collection (no-op, logs to console).
   */
  public async setEnabled(enabled: boolean): Promise<void> {
    console.log("[Analytics] setEnabled:", enabled);
    return Promise.resolve();
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
