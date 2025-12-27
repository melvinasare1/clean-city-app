// Push notification setup using Expo Notifications + Expo Push Service
// Saves Expo push tokens to Firestore for backend notification delivery

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Configure notification handler for foreground notifications
 * This ensures notifications show when app is in foreground
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Set up Android notification channel (safe to call on iOS)
 */
export const setupNotificationChannel = async (): Promise<void> => {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      description: 'Default notification channel',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }
};

/**
 * Request push notification permissions
 * Returns true if granted, false otherwise
 */
export const requestPushPermissions = async (): Promise<boolean> => {
  if (!Device.isDevice) {
    console.log('Push notifications are not available on simulators/emulators');
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  if (existingStatus === 'granted') {
    return true;
  }

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
};

/**
 * Get Expo push token using EAS project ID from app.json
 */
export const getExpoPushToken = async (): Promise<string | null> => {
  if (!Device.isDevice) {
    console.log('Expo push tokens are not available on simulators/emulators');
    return null;
  }

  try {
    // Get project ID from app.json extra.eas.projectId
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;

    if (!projectId) {
      console.warn('EAS projectId not found in app.json. Push notifications may not work.');
      // Fallback: try without projectId (may work in some cases)
      const response = await Notifications.getExpoPushTokenAsync();
      return response.data ?? null;
    }

    const response = await Notifications.getExpoPushTokenAsync({ projectId });
    return response.data ?? null;
  } catch (error) {
    console.error('Error getting Expo push token:', error);
    return null;
  }
};

/**
 * Save Expo push token to Firestore under profiles/{uid}
 * Updates the expoPushToken field
 */
export const savePushTokenToFirestore = async (
  userId: string,
  token: string
): Promise<void> => {
  try {
    const userRef = doc(db, 'profiles', userId);
    await updateDoc(userRef, {
      expoPushToken: token,
      pushTokenUpdatedAt: new Date().toISOString(),
    });
    console.log('Push token saved to Firestore for user:', userId);
  } catch (error) {
    console.error('Error saving push token to Firestore:', error);
    throw error;
  }
};

/**
 * Register for push notifications and save token to Firestore
 * This is the main function to call after user authentication
 * 
 * @param userId - Firebase Auth user ID
 * @returns The Expo push token if successful, null otherwise
 */
export const registerForPushNotifications = async (
  userId: string
): Promise<string | null> => {
  try {
    // Setup Android channel (safe on iOS)
    await setupNotificationChannel();

    // Request permissions
    const hasPermission = await requestPushPermissions();
    if (!hasPermission) {
      console.log('Push notification permission denied');
      return null;
    }

    // Get Expo push token
    const token = await getExpoPushToken();
    if (!token) {
      console.log('Failed to get Expo push token');
      return null;
    }

    // Save to Firestore
    await savePushTokenToFirestore(userId, token);

    return token;
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return null;
  }
};

/**
 * Remove push token from Firestore (call on logout)
 */
export const removePushTokenFromFirestore = async (
  userId: string
): Promise<void> => {
  try {
    const userRef = doc(db, 'profiles', userId);
    await updateDoc(userRef, {
      expoPushToken: null,
      pushTokenUpdatedAt: null,
    });
    console.log('Push token removed from Firestore for user:', userId);
  } catch (error) {
    console.error('Error removing push token from Firestore:', error);
    // Don't throw - this is cleanup, shouldn't block logout
  }
};

