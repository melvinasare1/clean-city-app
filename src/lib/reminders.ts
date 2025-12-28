// Daily and weekly scheduled reminder notifications using expo-notifications
// Stores reminder settings in Firestore for persistence across devices

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { doc, getDoc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from './firebase';
import { setupNotificationChannel, requestPushPermissions } from './push';

// Store the current notification IDs to track scheduled notifications
let currentNotificationId: string | null = null;
let currentWeeklyNotificationId: string | null = null;

export interface ReminderSettings {
  dailyEnabled: boolean;
  hour: number;
  minute: number;
  notificationId?: string;
  updatedAt: string;
}

export interface WeeklyReminderSettings {
  weeklyEnabled: boolean;
  weekday: number; // 1 = Monday, 2 = Tuesday, ..., 7 = Sunday
  hour: number;
  minute: number;
  notificationId?: string;
  updatedAt: string;
}

/**
 * Map weekday from our format (Mon=1, Sun=7) to Expo's format (Sun=1, Sat=7)
 * Expo uses: 1 = Sunday, 2 = Monday, ..., 7 = Saturday
 * We use: 1 = Monday, 2 = Tuesday, ..., 7 = Sunday
 */
const mapWeekdayToExpo = (weekday: number): number => {
  // Our weekday: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun
  // Expo weekday: 1=Sun, 2=Mon, 3=Tue, 4=Wed, 5=Thu, 6=Fri, 7=Sat
  if (weekday === 7) return 1; // Sunday: our 7 -> Expo's 1
  return weekday + 1; // Monday-Saturday: our 1-6 -> Expo's 2-7
};

/**
 * Get reminder settings from Firestore for a user
 */
const getReminderSettings = async (userId: string): Promise<ReminderSettings | null> => {
  try {
    const userRef = doc(db, 'profiles', userId);
    const snap = await getDoc(userRef);
    
    if (!snap.exists()) {
      return null;
    }

    const data = snap.data();
    const reminders = data.reminders as ReminderSettings | undefined;

    if (!reminders) {
      return null;
    }

    return reminders;
  } catch (error) {
    console.error('Error fetching reminder settings:', error);
    return null;
  }
};

/**
 * Save reminder settings to Firestore
 */
const saveReminderSettings = async (
  userId: string,
  settings: Partial<ReminderSettings>
): Promise<void> => {
  try {
    const userRef = doc(db, 'profiles', userId);
    
    // Build update object, removing undefined fields
    const cleanedSettings: any = {
      updatedAt: new Date().toISOString(),
    };
    
    if (settings.dailyEnabled !== undefined) cleanedSettings.dailyEnabled = settings.dailyEnabled;
    if (settings.hour !== undefined) cleanedSettings.hour = settings.hour;
    if (settings.minute !== undefined) cleanedSettings.minute = settings.minute;
    
    // Handle notificationId: if undefined or explicitly null, delete the field
    if (settings.notificationId === undefined) {
      // Don't update notificationId
    } else if (settings.notificationId === null) {
      cleanedSettings.notificationId = deleteField();
    } else {
      cleanedSettings.notificationId = settings.notificationId;
    }
    
    await updateDoc(userRef, {
      reminders: cleanedSettings,
    });
  } catch (error) {
    console.error('Error saving reminder settings:', error);
    throw error;
  }
};

/**
 * Cancel all scheduled notifications (cleanup)
 */
const cancelAllScheduledNotifications = async (): Promise<void> => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    currentNotificationId = null;
  } catch (error) {
    console.error('Error canceling scheduled notifications:', error);
  }
};

/**
 * Cancel a specific scheduled notification by ID
 */
const cancelScheduledNotification = async (notificationId: string): Promise<void> => {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    if (currentNotificationId === notificationId) {
      currentNotificationId = null;
    }
  } catch (error) {
    console.error('Error canceling scheduled notification:', error);
  }
};

/**
 * Enable daily reminder at a specific time
 * Requests permission if needed, schedules notification, and saves to Firestore
 * 
 * @param userId - Firebase Auth user ID
 * @param hour - Hour (0-23)
 * @param minute - Minute (0-59)
 * @returns The scheduled notification identifier, or null if failed
 */
export const enableDailyReminder = async (
  userId: string,
  hour: number,
  minute: number
): Promise<string | null> => {
  try {
    // Validate time
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      throw new Error('Invalid time: hour must be 0-23, minute must be 0-59');
    }

    // Ensure we're on a real device
    if (!Device.isDevice) {
      console.log('Scheduled notifications are not available on simulators/emulators');
      return null;
    }

    // Setup Android notification channel (safe on iOS)
    await setupNotificationChannel();

    // Request permissions if needed
    const hasPermission = await requestPushPermissions();
    if (!hasPermission) {
      console.log('Push notification permission denied - cannot schedule reminder');
      return null;
    }

    // Cancel any existing scheduled notification
    if (currentNotificationId) {
      try {
        await cancelScheduledNotification(currentNotificationId);
      } catch (err) {
        // If cancel fails, try canceling all (notification might not exist)
        await cancelAllScheduledNotifications();
      }
    }

    // Calculate next trigger time
    const now = new Date();
    const triggerTime = new Date();
    triggerTime.setHours(hour, minute, 0, 0);

    // If the time has already passed today, schedule for tomorrow
    if (triggerTime <= now) {
      triggerTime.setDate(triggerTime.getDate() + 1);
    }

    // Schedule daily notification
    // Using DailyTriggerInput for reliable daily scheduling
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Daily Reminder',
        body: 'Don\'t forget to check your bookings today!',
        sound: true,
        data: {
          type: 'daily_reminder',
        },
      },
      trigger: {
        hour,
        minute,
        repeats: true, // Daily repeat
      },
    });

    currentNotificationId = notificationId;

    // Save to Firestore
    await saveReminderSettings(userId, {
      dailyEnabled: true,
      hour,
      minute,
      notificationId,
    });

    console.log(`Daily reminder scheduled for ${hour}:${minute.toString().padStart(2, '0')}`);
    return notificationId;
  } catch (error) {
    console.error('Error enabling daily reminder:', error);
    return null;
  }
};

/**
 * Disable daily reminder
 * Cancels the scheduled notification and updates Firestore
 * 
 * @param userId - Firebase Auth user ID
 */
export const disableDailyReminder = async (userId: string): Promise<void> => {
  try {
    // Cancel scheduled notification
    if (currentNotificationId) {
      await cancelScheduledNotification(currentNotificationId);
    } else {
      // Try to get notification ID from Firestore
      const settings = await getReminderSettings(userId);
      if (settings?.notificationId) {
        try {
          await cancelScheduledNotification(settings.notificationId);
        } catch (err) {
          // Notification might not exist, that's okay
          console.log('Could not cancel notification (may not exist):', err);
        }
      }
    }

    // Update Firestore
    await saveReminderSettings(userId, {
      dailyEnabled: false,
      hour: 0,
      minute: 0,
      notificationId: null, // Delete the field
    });

    currentNotificationId = null;
    console.log('Daily reminder disabled');
  } catch (error) {
    console.error('Error disabling daily reminder:', error);
    throw error;
  }
};

/**
 * Load reminder settings from Firestore and reschedule if enabled
 * Call this on app startup/login to restore reminders after reinstall or device change
 * 
 * @param userId - Firebase Auth user ID
 */
export const loadReminderSettingsAndReschedule = async (userId: string): Promise<void> => {
  try {
    // Ensure we're on a real device
    if (!Device.isDevice) {
      return;
    }

    // Get settings from Firestore
    const settings = await getReminderSettings(userId);

    if (!settings || !settings.dailyEnabled) {
      console.log('No reminder settings found or reminders are disabled');
      return;
    }

    // Check if we already have a scheduled notification
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    const hasExistingNotification = scheduledNotifications.some(
      (n) => n.identifier === settings.notificationId
    );

    // If notification exists and matches our settings, we're good
    if (hasExistingNotification && settings.notificationId) {
      currentNotificationId = settings.notificationId;
      console.log('Reminder already scheduled, no action needed');
      return;
    }

    // Reschedule the reminder (handles reinstall, device change, or missing notification)
    console.log('Rescheduling daily reminder...');
    const notificationId = await enableDailyReminder(userId, settings.hour, settings.minute);

    if (!notificationId) {
      console.warn('Failed to reschedule reminder - permission may be denied');
      // Update Firestore to reflect that reminder couldn't be scheduled
      await saveReminderSettings(userId, {
        dailyEnabled: false,
      });
    }
  } catch (error) {
    console.error('Error loading and rescheduling reminder:', error);
    // Don't throw - this shouldn't break the app
  }
};

/**
 * Get current reminder settings (from memory or Firestore)
 * Useful for UI to display current state
 */
export const getCurrentReminderSettings = async (
  userId: string
): Promise<ReminderSettings | null> => {
  return getReminderSettings(userId);
};

// ============================================================================
// WEEKLY REMINDER FUNCTIONS (Rubbish Collection Reminders)
// ============================================================================

/**
 * Get weekly reminder settings from Firestore for a user
 */
const getWeeklyReminderSettings = async (userId: string): Promise<WeeklyReminderSettings | null> => {
  try {
    const userRef = doc(db, 'profiles', userId);
    const snap = await getDoc(userRef);
    
    if (!snap.exists()) {
      return null;
    }

    const data = snap.data();
    const weeklyReminders = data.weeklyReminders as WeeklyReminderSettings | undefined;

    if (!weeklyReminders) {
      return null;
    }

    return weeklyReminders;
  } catch (error) {
    console.error('Error fetching weekly reminder settings:', error);
    return null;
  }
};

/**
 * Save weekly reminder settings to Firestore
 */
const saveWeeklyReminderSettings = async (
  userId: string,
  settings: Partial<WeeklyReminderSettings>
): Promise<void> => {
  try {
    const userRef = doc(db, 'profiles', userId);
    
    // Build update object, removing undefined fields
    const cleanedSettings: any = {
      updatedAt: new Date().toISOString(),
    };
    
    if (settings.weeklyEnabled !== undefined) cleanedSettings.weeklyEnabled = settings.weeklyEnabled;
    if (settings.weekday !== undefined) cleanedSettings.weekday = settings.weekday;
    if (settings.hour !== undefined) cleanedSettings.hour = settings.hour;
    if (settings.minute !== undefined) cleanedSettings.minute = settings.minute;
    
    // Handle notificationId: if undefined or explicitly null, delete the field
    if (settings.notificationId === undefined) {
      // Don't update notificationId
    } else if (settings.notificationId === null) {
      cleanedSettings.notificationId = deleteField();
    } else {
      cleanedSettings.notificationId = settings.notificationId;
    }
    
    await updateDoc(userRef, {
      weeklyReminders: cleanedSettings,
    });
  } catch (error) {
    console.error('Error saving weekly reminder settings:', error);
    throw error;
  }
};

/**
 * Cancel a specific weekly scheduled notification by ID
 */
const cancelWeeklyScheduledNotification = async (notificationId: string): Promise<void> => {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    if (currentWeeklyNotificationId === notificationId) {
      currentWeeklyNotificationId = null;
    }
  } catch (error) {
    console.error('Error canceling weekly scheduled notification:', error);
  }
};

/**
 * Enable weekly reminder at a specific weekday and time
 * Requests permission if needed, schedules notification, and saves to Firestore
 * 
 * @param weekday - Weekday (1 = Monday, 2 = Tuesday, ..., 7 = Sunday)
 * @param hour - Hour (0-23)
 * @param minute - Minute (0-59)
 * @returns The scheduled notification identifier, or null if failed
 */
export const enableWeeklyReminder = async (
  weekday: number,
  hour: number,
  minute: number
): Promise<string | null> => {
  try {
    // Get current user ID
    const { auth } = await import('./firebase');
    const userId = auth.currentUser?.uid;
    if (!userId) {
      console.error('No user logged in - cannot enable weekly reminder');
      return null;
    }

    // Validate inputs
    if (weekday < 1 || weekday > 7) {
      throw new Error('Invalid weekday: must be 1-7 (1=Monday, 7=Sunday)');
    }
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      throw new Error('Invalid time: hour must be 0-23, minute must be 0-59');
    }

    // Ensure we're on a real device
    if (!Device.isDevice) {
      console.log('Scheduled notifications are not available on simulators/emulators');
      return null;
    }

    // Setup Android notification channel (safe on iOS)
    await setupNotificationChannel();

    // Request permissions if needed
    const hasPermission = await requestPushPermissions();
    if (!hasPermission) {
      console.log('Push notification permission denied - cannot schedule reminder');
      return null;
    }

    // Cancel any existing weekly scheduled notification
    if (currentWeeklyNotificationId) {
      try {
        await cancelWeeklyScheduledNotification(currentWeeklyNotificationId);
      } catch (err) {
        // If cancel fails, try to get from Firestore
        const settings = await getWeeklyReminderSettings(userId);
        if (settings?.notificationId) {
          try {
            await cancelWeeklyScheduledNotification(settings.notificationId);
          } catch (err2) {
            console.log('Could not cancel existing notification (may not exist):', err2);
          }
        }
      }
    }

    // Map weekday to Expo's format
    const expoWeekday = mapWeekdayToExpo(weekday);

    // Schedule weekly notification
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Rubbish collection reminder',
        body: 'Time to book your rubbish collection for this week.',
        sound: true,
        data: {
          type: 'weekly_rubbish_reminder',
        },
      },
      trigger: {
        weekday: expoWeekday,
        hour,
        minute,
        repeats: true, // Weekly repeat
      },
    });

    currentWeeklyNotificationId = notificationId;

    // Save to Firestore
    await saveWeeklyReminderSettings(userId, {
      weeklyEnabled: true,
      weekday,
      hour,
      minute,
      notificationId,
    });

    const weekdayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    console.log(`Weekly reminder scheduled for ${weekdayNames[weekday - 1]} at ${hour}:${minute.toString().padStart(2, '0')}`);
    return notificationId;
  } catch (error) {
    console.error('Error enabling weekly reminder:', error);
    return null;
  }
};

/**
 * Disable weekly reminder
 * Cancels the scheduled notification and updates Firestore
 */
export const disableWeeklyReminder = async (): Promise<void> => {
  try {
    // Get current user ID
    const { auth } = await import('./firebase');
    const userId = auth.currentUser?.uid;
    if (!userId) {
      console.error('No user logged in - cannot disable weekly reminder');
      return;
    }

    // Cancel scheduled notification
    if (currentWeeklyNotificationId) {
      await cancelWeeklyScheduledNotification(currentWeeklyNotificationId);
    } else {
      // Try to get notification ID from Firestore
      const settings = await getWeeklyReminderSettings(userId);
      if (settings?.notificationId) {
        try {
          await cancelWeeklyScheduledNotification(settings.notificationId);
        } catch (err) {
          // Notification might not exist, that's okay
          console.log('Could not cancel notification (may not exist):', err);
        }
      }
    }

    // Update Firestore
    await saveWeeklyReminderSettings(userId, {
      weeklyEnabled: false,
      weekday: 1,
      hour: 0,
      minute: 0,
      notificationId: null, // Delete the field
    });

    currentWeeklyNotificationId = null;
    console.log('Weekly reminder disabled');
  } catch (error) {
    console.error('Error disabling weekly reminder:', error);
    throw error;
  }
};

/**
 * Load weekly reminder settings from Firestore and reschedule if enabled
 * Call this on app startup/login to restore reminders after reinstall or device change
 * 
 * @param userId - Firebase Auth user ID
 */
export const loadWeeklyReminderSettingsAndReschedule = async (userId: string): Promise<void> => {
  try {
    // Ensure we're on a real device
    if (!Device.isDevice) {
      return;
    }

    // Get settings from Firestore
    const settings = await getWeeklyReminderSettings(userId);

    if (!settings || !settings.weeklyEnabled) {
      console.log('No weekly reminder settings found or reminders are disabled');
      return;
    }

    // Check if we already have a scheduled notification
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    const hasExistingNotification = scheduledNotifications.some(
      (n) => n.identifier === settings.notificationId
    );

    // If notification exists and matches our settings, we're good
    if (hasExistingNotification && settings.notificationId) {
      currentWeeklyNotificationId = settings.notificationId;
      console.log('Weekly reminder already scheduled, no action needed');
      return;
    }

    // Reschedule the reminder (handles reinstall, device change, or missing notification)
    console.log('Rescheduling weekly reminder...');
    const notificationId = await enableWeeklyReminder(settings.weekday, settings.hour, settings.minute);

    if (!notificationId) {
      console.warn('Failed to reschedule weekly reminder - permission may be denied');
      // Update Firestore to reflect that reminder couldn't be scheduled
      await saveWeeklyReminderSettings(userId, {
        weeklyEnabled: false,
      });
    }
  } catch (error) {
    console.error('Error loading and rescheduling weekly reminder:', error);
    // Don't throw - this shouldn't break the app
  }
};

/**
 * Get current weekly reminder settings (from Firestore)
 * Useful for UI to display current state
 */
export const getCurrentWeeklyReminderSettings = async (
  userId: string
): Promise<WeeklyReminderSettings | null> => {
  return getWeeklyReminderSettings(userId);
};

