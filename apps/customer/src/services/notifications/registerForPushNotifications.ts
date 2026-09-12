import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { trackEvent } from '@/services/analytics';

let hasAttemptedThisSession = false;
let cachedToken: string | null = null;

/**
 * Register the current device for Expo push notifications.
 *
 * - Returns null on simulators/emulators
 * - Requests permissions (no-op if already granted)
 * - Returns null if permission is denied
 * - Fetches and caches an Expo push token
 * - Sets up Android notification channel
 * - Logs analytics events for permission flow (but never logs the token)
 */
export const registerForPushNotifications = async (): Promise<string | null> => {
  if (hasAttemptedThisSession) {
    return cachedToken;
  }

  hasAttemptedThisSession = true;

  // High-level "user opted in" attempt
  trackEvent('push_opt_in_attempt').catch(() => {
    // Swallow analytics errors
  });

  try {
    if (!Device.isDevice) {
      // Expo push tokens are not available on simulators/emulators
      return null;
    }

    let existingStatus = (await Notifications.getPermissionsAsync()).status;

    if (existingStatus !== 'granted') {
      // We are about to show the permission prompt
      trackEvent('push_permission_requested').catch(() => {});

      const requestResult = await Notifications.requestPermissionsAsync();
      existingStatus = requestResult.status;

      if (existingStatus !== 'granted') {
        trackEvent('push_permission_denied').catch(() => {});
        return null;
      }

      trackEvent('push_permission_granted').catch(() => {});
    } else {
      // Already granted earlier (possibly a previous session)
      trackEvent('push_permission_granted').catch(() => {});
    }

    // Fetch Expo push token
    let projectId: string | undefined;

    // Prefer EAS projectId if available
    // @ts-expect-error: easConfig is available at runtime in managed apps using EAS
    projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;

    let token: string | null = null;

    if (projectId) {
      const response = await Notifications.getExpoPushTokenAsync({ projectId });
      token = response.data ?? null;
    } else {
      const response = await Notifications.getExpoPushTokenAsync();
      token = response.data ?? null;
    }

    cachedToken = token;

    // Configure Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    return cachedToken;
  } catch (error) {
    if (__DEV__) {
      console.warn('Error registering for push notifications', error);
    }
    return null;
  }
};


