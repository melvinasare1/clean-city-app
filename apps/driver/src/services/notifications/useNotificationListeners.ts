import { useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import type {
  Notification,
  NotificationResponse,
} from 'expo-notifications';
import { trackEvent } from '@/services/analytics';

type NotificationData = Record<string, unknown> | null;

export interface UseNotificationListenersResult {
  lastNotification: Notification | null;
  lastResponse: NotificationResponse | null;
  lastData: NotificationData;
}

/**
 * Hook to subscribe to Expo notification events.
 *
 * - Logs `push_received` when a notification is received in the foreground
 * - Logs `push_opened` when a notification is tapped
 * - Safely extracts a limited, non-PII payload (e.g. `screen`, `campaign`)
 * - Returns the last notification / response / data for consumers
 *
 * Safe to mount once in the root of the app.
 */
export const useNotificationListeners = (): UseNotificationListenersResult => {
  const [lastNotification, setLastNotification] = useState<Notification | null>(null);
  const [lastResponse, setLastResponse] = useState<NotificationResponse | null>(null);
  const [lastData, setLastData] = useState<NotificationData>(null);

  useEffect(() => {
    const receivedSub = Notifications.addNotificationReceivedListener(
      (notification) => {
        setLastNotification(notification);

        const rawData = notification.request.content.data ?? null;
        const data = (rawData && typeof rawData === 'object'
          ? (rawData as Record<string, unknown>)
          : null) as NotificationData;

        setLastData(data);

        const analyticsPayload: Record<string, string> = {};
        const screen = data?.screen;
        const campaign = data?.campaign;

        if (typeof screen === 'string') {
          analyticsPayload.screen = screen;
        }
        if (typeof campaign === 'string') {
          analyticsPayload.campaign = campaign;
        }

        trackEvent('push_received', analyticsPayload).catch(() => {});
      }
    );

    const responseSub =
      Notifications.addNotificationResponseReceivedListener((response) => {
        setLastResponse(response);

        const rawData = response.notification.request.content.data ?? null;
        const data = (rawData && typeof rawData === 'object'
          ? (rawData as Record<string, unknown>)
          : null) as NotificationData;

        setLastData(data);

        const analyticsPayload: Record<string, string> = {};
        const screen = data?.screen;
        const campaign = data?.campaign;

        if (typeof screen === 'string') {
          analyticsPayload.screen = screen;
        }
        if (typeof campaign === 'string') {
          analyticsPayload.campaign = campaign;
        }

        trackEvent('push_opened', analyticsPayload).catch(() => {});
      });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, []);

  return {
    lastNotification,
    lastResponse,
    lastData,
  };
};


