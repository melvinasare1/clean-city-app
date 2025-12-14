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
  // Firebase Analytics instance (web-only)
  private analyticsInstance: unknown | null = null;

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
        if (Platform.OS !== "web") {
          if (isDev) {
            console.warn(
              "[Analytics] Firebase Analytics (web SDK) is only available on web; native will no-op."
            );
          }
          this.initialized = true;
          return;
        }

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

        this.analyticsInstance = analyticsModule.getAnalytics(firebaseApp);
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

      if (Platform.OS !== "web" || !this.analyticsInstance) {
        return;
      }

      const safeEventName = this.normalizeEventName(eventName);
      const sanitizedParams = this.sanitizeParams(params);

      const { logEvent } = await import("firebase/analytics");
      await logEvent(
        this.analyticsInstance as any,
        safeEventName,
        sanitizedParams
      );
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

      if (Platform.OS !== "web" || !this.analyticsInstance) {
        return;
      }

      const sanitizedParams = this.sanitizeParams(params);
      const baseParams = {
        screen_name: screenName,
        ...sanitizedParams,
      };

      const { logEvent } = await import("firebase/analytics");
      await logEvent(
        this.analyticsInstance as any,
        "screen_view" as any,
        baseParams
      );
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

      if (Platform.OS !== "web" || !this.analyticsInstance) {
        return;
      }

      const { setUserId } = await import("firebase/analytics");
      await setUserId(this.analyticsInstance as any, userId ?? null);
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

      if (Platform.OS !== "web" || !this.analyticsInstance) {
        return;
      }

      const sanitizedProps = this.sanitizeParams(props);

      const { setUserProperties } = await import("firebase/analytics");
      await setUserProperties(this.analyticsInstance as any, sanitizedProps);
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

      if (Platform.OS !== "web" || !this.analyticsInstance) {
        return;
      }

      const { setAnalyticsCollectionEnabled } = await import(
        "firebase/analytics"
      );
      await setAnalyticsCollectionEnabled(
        this.analyticsInstance as any,
        enabled
      );
    } catch (error) {
      this.handleError(error, "Failed to set analytics enabled state");
    }
  }

  /**
   * Helper to sanitize parameters:
   * - Removes blocked PII keys.
   * - Stringifies values to comply with GA4 expectations.
   */
  private sanitizeParams(params?: AnalyticsParams): Record<string, string> {
    if (!params) {
      return {};
    }

    const sanitized: Record<string, string> = {};
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

      // Stringify values for GA4.
      if (value === null) {
        sanitized[key] = "null";
      } else if (typeof value === "string") {
        sanitized[key] = value;
      } else {
        sanitized[key] = String(value);
      }
    }

    if (blockedFound.length > 0 && isDev) {
      console.warn("[Analytics] Blocked PII params:", blockedFound.join(", "));
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
