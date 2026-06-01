// Push notification setup using Expo Notifications + Expo Push Service
// Customers: profiles/{uid}. Drivers: drivers/{uid} only.

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { AppUserRole } from '@/contexts/auth-context';

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
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;

    if (!projectId) {
      console.warn('EAS projectId not found in app.json. Push notifications may not work.');
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

async function resolvePushTokenCollection(
  userId: string,
  roleHint?: AppUserRole | null
): Promise<'drivers' | 'profiles'> {
  if (roleHint === 'driver') {
    return 'drivers';
  }
  if (roleHint === 'customer' || roleHint === 'admin') {
    return 'profiles';
  }
  const driverSnap = await getDoc(doc(db, 'drivers', userId));
  if (driverSnap.exists() && driverSnap.data()?.role === 'driver') {
    return 'drivers';
  }
  return 'profiles';
}

/**
 * Save Expo push token to the correct collection (drivers or profiles).
 */
export const savePushTokenToFirestore = async (
  userId: string,
  token: string,
  roleHint?: AppUserRole | null
): Promise<void> => {
  try {
    const collection = await resolvePushTokenCollection(userId, roleHint);
    const userRef = doc(db, collection, userId);
    await setDoc(
      userRef,
      {
        expoPushToken: token,
        pushTokenUpdatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    console.log(`Push token saved to ${collection}/${userId}`);
  } catch (error) {
    console.error('Error saving push token to Firestore:', error);
    throw error;
  }
};

/**
 * Register for push notifications and save token to Firestore
 */
export const registerForPushNotifications = async (
  userId: string,
  roleHint?: AppUserRole | null
): Promise<string | null> => {
  try {
    await setupNotificationChannel();

    const hasPermission = await requestPushPermissions();
    if (!hasPermission) {
      console.log('Push notification permission denied');
      return null;
    }

    const token = await getExpoPushToken();
    if (!token) {
      console.log('Failed to get Expo push token');
      return null;
    }

    await savePushTokenToFirestore(userId, token, roleHint);

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
  userId: string,
  roleHint?: AppUserRole | null
): Promise<void> => {
  try {
    const collection = await resolvePushTokenCollection(userId, roleHint);
    const userRef = doc(db, collection, userId);
    await setDoc(
      userRef,
      {
        expoPushToken: null,
        pushTokenUpdatedAt: null,
      },
      { merge: true }
    );
    console.log(`Push token removed from ${collection}/${userId}`);
  } catch (error) {
    console.error('Error removing push token from Firestore:', error);
  }
};
