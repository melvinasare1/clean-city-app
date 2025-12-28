/**
 * Push notification sender
 * Wrapper for Railway backend POST /push endpoint
 */

const API_URL = process.env.EXPO_PUBLIC_API_URL || '';
const ADMIN_SECRET = process.env.EXPO_PUBLIC_ADMIN_SECRET || '';

export interface PushNotificationParams {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

export interface PushNotificationResponse {
  success: boolean;
  receipt?: any;
  message?: string;
  error?: string;
  details?: any;
}

/**
 * Send a push notification via Railway backend
 * 
 * @param params - Push notification parameters
 * @returns Promise resolving to response from backend
 */
export const sendPush = async (
  params: PushNotificationParams
): Promise<PushNotificationResponse> => {
  if (!API_URL) {
    return {
      success: false,
      error: 'EXPO_PUBLIC_API_URL not configured',
    };
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add admin secret header if configured
    if (ADMIN_SECRET) {
      headers['X-ADMIN-SECRET'] = ADMIN_SECRET;
    }

    const response = await fetch(`${API_URL}/push`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        to: params.to,
        title: params.title,
        body: params.body,
        data: params.data || {},
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.error || 'Failed to send notification',
        details: result,
      };
    }

    return {
      success: true,
      receipt: result.receipt,
      message: result.message || 'Notification sent successfully',
    };
  } catch (error) {
    console.error('Error sending push notification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

