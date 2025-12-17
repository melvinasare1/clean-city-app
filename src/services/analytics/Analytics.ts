/**
 * AnalyticsService
 *
 * Cross-platform analytics wrapper:
 * - Web: Firebase Web SDK (`firebase/analytics`)
 * - iOS/Android: React Native Firebase (`@react-native-firebase/analytics`)
 *
 * NOTE:
 * - Native analytics requires a custom dev/EAS build (NOT Expo Go).
 * - Ensure the following are installed and configured:
 *   - `@react-native-firebase/app`
 *   - `@react-native-firebase/analytics`
 *   - Expo config plugins added in `app.json`.
 */

import { useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Platform } from "react-native";
import firebaseApp from "@/services/firebase/firebase-config";

export type AnalyticsParamValue = string | number | boolean | null | undefined;

export type AnalyticsParams = Record<string, AnalyticsParamValue>;

const MAX_EVENT_NAME_LENGTH = 40;

const BLOCKED_PII_KEYS = [
  "email",
  "phone",
  "name",
  "address",
  "dob",
  "card",
  "pan",
  "token",
  "password",
] as const;

const isDev =
  (typeof __DEV__ !== "undefined" && __DEV__) ||
  process.env.NODE_ENV !== "production";

class AnalyticsService {
  private initialized = false;
  private initializing: Promise<void> | null = null;
  // Firebase Analytics instance (web)
  private webAnalytics: unknown | null = null;
  // React Native Firebase analytics instance (native)
  private nativeAnalytics: any | null = null;

  /**
   * Idempotent initialization.
   */
  public async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.initializing) {
      return this.initializing;
    }

    this.initializing = (async () => {
      try {
        if (Platform.OS === "web") {
          const analyticsModule = await import("firebase/analytics");

          // Some environments may not support analytics (e.g. missing window)
          let supported = true;
          if (typeof analyticsModule.isSupported === "function") {
            try {
              supported = await analyticsModule.isSupported();
            } catch {
              supported = false;
            }
          }

          if (!supported) {
            if (isDev) {
              console.warn(
                "[Analytics] Firebase Analytics is not supported in this environment."
              );
            }
            this.initialized = true;
            return;
          }

          this.webAnalytics = analyticsModule.getAnalytics(firebaseApp);
          this.initialized = true;
          return;
        }

        // Native (iOS / Android) – use React Native Firebase
        // Use dynamic import so web bundlers don't try to resolve native module.
        const rnAnalyticsModule = (await import(
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore - native-only module, not available on web type resolution
          "@react-native-firebase/analytics"
        )) as any;
        const analyticsInstance = rnAnalyticsModule.default?.();

        if (!analyticsInstance) {
          if (isDev) {
            console.warn(
              "[Analytics] Failed to initialize React Native Firebase analytics instance."
            );
          }
          this.initialized = true;
          return;
        }

        this.nativeAnalytics = analyticsInstance;
        this.initialized = true;
      } catch (error) {
        this.handleError(error, "Analytics init failed");
      } finally {
        this.initializing = null;
      }
    })();

    return this.initializing;
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
      const safeEventName = this.normalizeEventName(eventName);

      if (Platform.OS === "web" && this.webAnalytics) {
        const { logEvent } = await import("firebase/analytics");
        const sanitizedParams = this.sanitizeParamsForWeb(params);
        await logEvent(
          this.webAnalytics as any,
          safeEventName,
          sanitizedParams
        );
        return;
      }

      if (this.nativeAnalytics) {
        const sanitizedParams = this.sanitizeParamsForNative(params);
        await this.nativeAnalytics.logEvent(safeEventName, sanitizedParams);
        return;
      }
    } catch (error) {
      this.handleError(error, `Failed to track event "${eventName}"`);
    }
  }

  /**
   * Track a screen view using GA4 `screen_view` event.
   */
  public async screen(
    screenName: string,
    params?: AnalyticsParams
  ): Promise<void> {
    try {
      await this.init();
      const normalizedName = screenName;

      if (Platform.OS === "web" && this.webAnalytics) {
        const { logEvent } = await import("firebase/analytics");
        const sanitizedParams = this.sanitizeParamsForWeb(params);
        const baseParams = {
          screen_name: normalizedName,
          ...sanitizedParams,
        };
        await logEvent(
          this.webAnalytics as any,
          "screen_view" as any,
          baseParams
        );
        return;
      }

      if (this.nativeAnalytics) {
        await this.nativeAnalytics.logScreenView({
          screen_name: normalizedName,
          screen_class: normalizedName,
        });
        return;
      }
    } catch (error) {
      this.handleError(error, `Failed to track screen "${screenName}"`);
    }
  }

  /**
   * Set or clear the current user ID.
   */
  public async identify(userId: string | null): Promise<void> {
    try {
      await this.init();
      const id = userId ?? null;

      if (Platform.OS === "web" && this.webAnalytics) {
        const { setUserId } = await import("firebase/analytics");
        await setUserId(this.webAnalytics as any, id);
        return;
      }

      if (this.nativeAnalytics) {
        await this.nativeAnalytics.setUserId(id);
        return;
      }
    } catch (error) {
      this.handleError(error, "Failed to identify user");
    }
  }

  /**
   * Set user properties (GA4 expects string values, so we stringify).
   */
  public async setUserProperties(props: AnalyticsParams): Promise<void> {
    try {
      await this.init();
      const sanitizedPropsForUsers = this.sanitizeUserProperties(props);

      if (Platform.OS === "web" && this.webAnalytics) {
        const { setUserProperties } = await import("firebase/analytics");
        await setUserProperties(
          this.webAnalytics as any,
          sanitizedPropsForUsers
        );
        return;
      }

      if (this.nativeAnalytics) {
        await this.nativeAnalytics.setUserProperties(sanitizedPropsForUsers);
        return;
      }
    } catch (error) {
      this.handleError(error, "Failed to set user properties");
    }
  }

  /**
   * Enable or disable analytics collection.
   */
  public async setEnabled(enabled: boolean): Promise<void> {
    try {
      await this.init();
      if (Platform.OS === "web" && this.webAnalytics) {
        const { setAnalyticsCollectionEnabled } = await import(
          "firebase/analytics"
        );
        await setAnalyticsCollectionEnabled(this.webAnalytics as any, enabled);
        return;
      }

      if (this.nativeAnalytics) {
        await this.nativeAnalytics.setAnalyticsCollectionEnabled(enabled);
        return;
      }
    } catch (error) {
      this.handleError(error, "Failed to set analytics enabled state");
    }
  }

  /**
   * Helper to sanitize parameters:
   * - Removes blocked PII keys.
   * - Stringifies values to comply with GA4 expectations.
   */
  private filterAndReportParams(
    params?: AnalyticsParams
  ): Record<string, Exclude<AnalyticsParamValue, undefined>> {
    if (!params) {
      return {};
    }

    const filtered: Record<
      string,
      Exclude<AnalyticsParamValue, undefined>
    > = {};
    const blockedFound: string[] = [];

    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) {
        continue;
      }

      const lowerKey = key.toLowerCase();
      const isBlocked = BLOCKED_PII_KEYS.some(
        (blocked) => lowerKey === blocked || lowerKey.includes(blocked)
      );

      if (isBlocked) {
        blockedFound.push(key);
        continue;
      }

      filtered[key] = value as Exclude<AnalyticsParamValue, undefined>;
    }

    if (blockedFound.length > 0 && isDev) {
      console.warn("[Analytics] Blocked PII params:", blockedFound.join(", "));
    }

    return filtered;
  }

  /**
   * Web sanitization: stringifies everything (GA4 limitation for params).
   */
  private sanitizeParamsForWeb(
    params?: AnalyticsParams
  ): Record<string, string> {
    const filtered = this.filterAndReportParams(params);
    const sanitized: Record<string, string> = {};

    for (const [key, value] of Object.entries(filtered)) {
      if (value === null) {
        sanitized[key] = "null";
      } else if (typeof value === "string") {
        sanitized[key] = value;
      } else {
        sanitized[key] = String(value);
      }
    }

    return sanitized;
  }

  /**
   * Native sanitization: keep numbers/strings, convert booleans, drop null/objects.
   */
  private sanitizeParamsForNative(
    params?: AnalyticsParams
  ): Record<string, string | number> {
    const filtered = this.filterAndReportParams(params);
    const sanitized: Record<string, string | number> = {};

    for (const [key, value] of Object.entries(filtered)) {
      if (value === null) {
        // Skip nulls for native analytics params
        continue;
      }

      if (typeof value === "boolean") {
        // Represent booleans as 0/1
        sanitized[key] = value ? 1 : 0;
      } else if (typeof value === "number" || typeof value === "string") {
        sanitized[key] = value;
      }
      // Arrays/objects are ignored
    }

    return sanitized;
  }

  /**
   * User properties: strings only, consistent across web & native.
   */
  private sanitizeUserProperties(
    props?: AnalyticsParams
  ): Record<string, string> {
    const filtered = this.filterAndReportParams(props);
    const sanitized: Record<string, string> = {};

    for (const [key, value] of Object.entries(filtered)) {
      if (value === null) {
        sanitized[key] = "null";
      } else if (typeof value === "string") {
        sanitized[key] = value;
      } else if (typeof value === "boolean") {
        sanitized[key] = value ? "true" : "false";
      } else {
        sanitized[key] = String(value);
      }
    }

    return sanitized;
  }

  /**
   * Normalize event names to snake_case and trim to GA4 limits.
   */
  private normalizeEventName(rawName: string): string {
    const original = rawName;

    let name = rawName.trim();

    if (!name) {
      if (isDev) {
        console.warn(
          '[Analytics] Empty event name provided, falling back to "event"'
        );
      }
      return "event";
    }

    // Replace non-alphanumeric characters with underscores.
    name = name.replace(/[^a-zA-Z0-9]+/g, "_");

    // Insert underscore before camelCase transitions.
    name = name.replace(/([a-z0-9])([A-Z])/g, "$1_$2");

    // Collapse multiple underscores and trim.
    name = name.replace(/_+/g, "_").replace(/^_+|_+$/g, "");

    // GA4 requires lowercase.
    name = name.toLowerCase();

    // Must start with a letter in GA4; prefix if needed.
    if (!/^[a-z]/.test(name)) {
      name = `e_${name}`;
    }

    // Enforce max length.
    if (name.length > MAX_EVENT_NAME_LENGTH) {
      const truncated = name.slice(0, MAX_EVENT_NAME_LENGTH);
      if (isDev) {
        console.warn(
          `[Analytics] Event name "${name}" exceeds ${MAX_EVENT_NAME_LENGTH} chars, truncating to "${truncated}"`
        );
      }
      name = truncated;
    }

    if (name !== original && isDev) {
      console.warn(
        `[Analytics] Normalized event name from "${original}" to "${name}"`
      );
    }

    return name;
  }

  /**
   * Centralized error handling: warn in dev, swallow in production.
   */
  private handleError(error: unknown, context: string): void {
    if (isDev) {
      console.warn("[Analytics] Error:", context, error);
    }
    // In production, silently no-op. Do not throw.
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
