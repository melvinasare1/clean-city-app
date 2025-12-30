import * as Notifications from 'expo-notifications';

// Configure how notifications are handled when received in the foreground.
// This is the single place where notification behavior is configured.
// Imported in App.tsx to ensure it runs on app startup.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true, // Enable badge to help ensure notifications are working
  }),
});


