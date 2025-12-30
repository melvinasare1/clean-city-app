# Daily Scheduled Reminders Setup Guide

Complete guide for implementing daily scheduled reminder notifications in CleanCityApp.

## 📁 Files Created/Modified

### App-side Files

1. **`src/lib/reminders.ts`** - Core reminder scheduling logic
2. **`src/contexts/auth-context.tsx`** - Integrated reminder loading on login
3. **`src/lib/reminders-example-ui.tsx`** - Example UI code for settings screen

### Backend Files

4. **`railway-push-server/server.js`** - Added `/cron/daily-reminders` endpoint
5. **`railway-push-server/package.json`** - Added `firebase-admin` dependency
6. **`railway-push-server/README.md`** - Updated with cron endpoint documentation

## 🔧 How It Works

### 1. Local Scheduled Notifications (Primary Method)

1. User enables daily reminder in settings
2. App requests notification permissions (if needed)
3. App schedules a local daily notification using `expo-notifications`
4. Settings saved to Firestore: `profiles/{uid}.reminders`
5. On app restart/login, settings are loaded and reminder is rescheduled
6. Notification fires daily at the specified time

### 2. Server-Driven Reminders (Optional Backup)

1. External cron service calls `/cron/daily-reminders` every hour
2. Server queries Firestore for users with `reminders.dailyEnabled = true` and matching time
3. Server sends push notifications via Expo Push Service
4. More reliable than local scheduling (works even if app is uninstalled/reinstalled)

## 📊 Firestore Document Structure

### User Profile Document

**Collection:** `profiles`  
**Document ID:** `{userId}` (Firebase Auth UID)

```json
{
  "email": "user@example.com",
  "role": "customer",
  "expoPushToken": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "reminders": {
    "dailyEnabled": true,
    "hour": 9,
    "minute": 0,
    "notificationId": "abc123",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Fields:**
- `dailyEnabled`: `boolean` - Whether reminders are enabled
- `hour`: `number` (0-23) - Hour of day
- `minute`: `number` (0-59) - Minute of hour
- `notificationId`: `string | null` - Local notification identifier (for tracking)
- `updatedAt`: `string` - ISO timestamp of last update

## 🚀 Setup Steps

### 1. App-side (Already Integrated)

✅ **Done automatically:**
- Reminder functions created in `src/lib/reminders.ts`
- Auth context loads reminders on login
- No additional setup needed

### 2. Add UI to Your Settings Screen

Copy the example code from `src/lib/reminders-example-ui.tsx` or use the hook:

```typescript
import { useReminderSettings } from '@/lib/reminders-example-ui';

function SettingsScreen() {
  const { settings, loading, enable, disable, enabled } = useReminderSettings();
  
  // ... your UI code
}
```

### 3. Test Local Scheduling

1. **Run the app:**
   ```bash
   yarn start
   ```

2. **Enable a reminder:**
   - Navigate to settings
   - Toggle daily reminder ON
   - Set a time (e.g., 9:00 AM)
   - Grant notification permissions when prompted

3. **Verify in Firestore:**
   - Check `profiles/{userId}.reminders` in Firebase Console
   - Should see `dailyEnabled: true`, `hour: 9`, `minute: 0`

4. **Test notification:**
   - Set reminder time to 1-2 minutes from now
   - Wait for notification
   - Or use Expo's notification testing tools

### 4. Optional: Setup Server-Driven Reminders

#### Step 1: Configure Railway Backend

1. **Add environment variables in Railway:**
   - `CRON_SECRET` - Generate with: `openssl rand -hex 32`
   - `FIREBASE_SERVICE_ACCOUNT_JSON` - Your Firebase service account JSON (as string)

2. **Get Firebase Service Account:**
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Project Settings → Service Accounts
   - Click "Generate New Private Key"
   - Copy the entire JSON content

3. **Set in Railway:**
   - Add `FIREBASE_SERVICE_ACCOUNT_JSON` environment variable
   - Paste the entire JSON as the value

#### Step 2: Setup External Cron

Use a service like [cron-job.org](https://cron-job.org) or [EasyCron](https://www.easycron.com):

1. **Create new cron job:**
   - URL: `https://your-railway-url.railway.app/cron/daily-reminders`
   - Method: `POST`
   - Headers: `X-CRON-SECRET: <your-cron-secret>`
   - Schedule: Every hour at minute 0 (`0 * * * *`)

2. **Test manually:**
   ```bash
   curl -X POST https://your-railway-url.railway.app/cron/daily-reminders \
     -H "X-CRON-SECRET: your-secret"
   ```

## 📝 Code Examples

### Enable Daily Reminder

```typescript
import { enableDailyReminder } from '@/lib/reminders';
import { useAuthContext } from '@/contexts/auth-context';

function MyComponent() {
  const { user } = useAuthContext();
  
  const handleEnable = async () => {
    if (!user?.id) return;
    
    const notificationId = await enableDailyReminder(user.id, 9, 0); // 9:00 AM
    if (notificationId) {
      console.log('Reminder enabled!');
    } else {
      console.log('Failed - check permissions');
    }
  };
}
```

### Disable Daily Reminder

```typescript
import { disableDailyReminder } from '@/lib/reminders';

const handleDisable = async () => {
  if (!user?.id) return;
  await disableDailyReminder(user.id);
};
```

### Get Current Settings

```typescript
import { getCurrentReminderSettings } from '@/lib/reminders';

const loadSettings = async () => {
  if (!user?.id) return;
  const settings = await getCurrentReminderSettings(user.id);
  console.log('Reminder enabled:', settings?.dailyEnabled);
  console.log('Time:', settings?.hour, ':', settings?.minute);
};
```

## 🧪 Testing on Physical Device

### Prerequisites

- Real iOS or Android device (simulators don't support scheduled notifications)
- App built with Expo dev client or TestFlight/Play Store build
- Notification permissions granted

### Test Steps

1. **Build and install app:**
   ```bash
   # For development
   yarn start
   # Then press 'i' for iOS or 'a' for Android
   
   # For production build
   eas build --platform ios
   # Or use TestFlight/Play Store
   ```

2. **Enable reminder:**
   - Open app and log in
   - Navigate to settings
   - Enable daily reminder
   - Set time to 1-2 minutes from now (for quick testing)

3. **Verify:**
   - Check Firestore: `profiles/{userId}.reminders` should have `dailyEnabled: true`
   - Wait for notification
   - Notification should appear at scheduled time

4. **Test rescheduling:**
   - Close app completely
   - Reopen app and log in
   - Reminder should be rescheduled automatically
   - Check Firestore to confirm settings persisted

5. **Test disable:**
   - Disable reminder in settings
   - Check Firestore: `dailyEnabled` should be `false`
   - Notification should not fire

## 🔍 Troubleshooting

### Reminder Not Scheduling

**Check:**
- ✅ Device is real (not simulator)
- ✅ Notification permissions granted
- ✅ User is logged in
- ✅ Firestore write permissions for `profiles/{uid}`
- ✅ Console logs for errors

**Debug:**
```typescript
// Check scheduled notifications
const scheduled = await Notifications.getAllScheduledNotificationsAsync();
console.log('Scheduled:', scheduled);
```

### Reminder Not Firing

**Possible causes:**
- App was force-closed (iOS may not fire notifications)
- Device is in Do Not Disturb mode
- Battery optimization disabled notifications (Android)
- Time zone changed

**Solution:** Use server-driven reminders as backup

### Permission Denied

**iOS:**
- User must grant permissions manually
- Check Settings → Notifications → Your App

**Android:**
- Permissions are usually granted automatically
- Check Settings → Apps → Your App → Notifications

### Firestore Permission Errors

**Fix:**
- Update Firestore security rules:
  ```javascript
  match /profiles/{userId} {
    allow read, write: if request.auth != null && request.auth.uid == userId;
  }
  ```

## ✅ Checklist

- [x] Local scheduled notifications implemented
- [x] Firestore persistence working
- [x] Auto-reschedule on login
- [x] Permission handling
- [x] Error handling (won't crash app)
- [x] Example UI code provided
- [x] Server-driven endpoint (optional)
- [x] Documentation complete

## 🎯 Next Steps

1. **Add UI to your settings screen** using the example code
2. **Test on a physical device** with a reminder set 1-2 minutes out
3. **Verify Firestore persistence** after app restart
4. **Optional:** Set up server-driven reminders for reliability
5. **Customize notification content** in `reminders.ts` if needed

## 📚 Key Functions

### `enableDailyReminder(userId, hour, minute)`
- Requests permissions if needed
- Schedules daily notification
- Saves to Firestore
- Returns notification ID or null

### `disableDailyReminder(userId)`
- Cancels scheduled notification
- Updates Firestore

### `loadReminderSettingsAndReschedule(userId)`
- Loads settings from Firestore
- Reschedules if enabled
- Called automatically on login

### `getCurrentReminderSettings(userId)`
- Returns current settings from Firestore
- Useful for UI display

## 🔐 Security Notes

- Local notifications are device-specific
- Server-driven reminders require:
  - `CRON_SECRET` environment variable
  - Firebase Admin SDK credentials
  - Firestore read permissions for server
- Never expose `CRON_SECRET` in client code

