# Weekly Scheduled Reminders Setup Guide

Complete guide for implementing weekly scheduled reminder notifications for rubbish collection in CleanCityApp.

## 📁 Files Created/Modified

### App-side Files

1. **`src/lib/reminders.ts`** - Added weekly reminder functions
2. **`src/contexts/auth-context.tsx`** - Integrated weekly reminder loading on login
3. **`src/lib/reminders-example-ui.tsx`** - Added example UI code for weekly reminder settings

### Backend Files

4. **`railway-push-server/server.js`** - Added `/cron/weekly-reminders` endpoint

## 🔧 How It Works

### 1. Local Scheduled Notifications (Primary Method)

1. User enables weekly reminder in settings
2. App requests notification permissions (if needed)
3. App schedules a local weekly notification using `expo-notifications`
4. Settings saved to Firestore: `profiles/{uid}.weeklyReminders`
5. On app restart/login, settings are loaded and reminder is rescheduled
6. Notification fires weekly on the specified weekday at the specified time

### 2. Server-Driven Reminders (Optional Backup)

1. External cron service calls `/cron/weekly-reminders` every hour
2. Server queries Firestore for users with `weeklyReminders.weeklyEnabled = true` and matching weekday/time
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
  },
  "weeklyReminders": {
    "weeklyEnabled": true,
    "weekday": 1,
    "hour": 9,
    "minute": 0,
    "notificationId": "def456",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Weekly Reminder Fields:**
- `weeklyEnabled`: `boolean` - Whether weekly reminders are enabled
- `weekday`: `number` (1-7) - Day of week (1 = Monday, 2 = Tuesday, ..., 7 = Sunday)
- `hour`: `number` (0-23) - Hour of day
- `minute`: `number` (0-59) - Minute of hour
- `notificationId`: `string | null` - Local notification identifier (for tracking)
- `updatedAt`: `string` - ISO timestamp of last update

**Weekday Mapping:**
- Our format: 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday, 7 = Sunday
- Expo's format (internal): 1 = Sunday, 2 = Monday, ..., 7 = Saturday
- The code automatically maps between these formats

## 🚀 Setup Steps

### 1. App-side (Already Integrated)

✅ **Done automatically:**
- Weekly reminder functions created in `src/lib/reminders.ts`
- Auth context loads weekly reminders on login
- No additional setup needed

### 2. Add UI to Your Settings Screen

Copy the example code from `src/lib/reminders-example-ui.tsx` or use the hook:

```typescript
import { useWeeklyReminderSettings } from '@/lib/reminders-example-ui';

function SettingsScreen() {
  const { settings, loading, enable, disable, enabled } = useWeeklyReminderSettings();
  
  // Example: Enable reminder for Monday at 9:00 AM
  const handleEnable = async () => {
    const id = await enable(1, 9, 0); // weekday=1 (Monday), hour=9, minute=0
    if (id) {
      console.log('Weekly reminder enabled!');
    }
  };
  
  // ... your UI code
}
```

### 3. Test Local Scheduling

1. **Run the app:**
   ```bash
   npm start
   # or
   yarn start
   ```

2. **Enable a reminder:**
   - Navigate to settings
   - Toggle weekly reminder ON
   - Select a weekday (e.g., Monday = 1)
   - Set a time (e.g., 9:00 AM)
   - Grant notification permissions when prompted

3. **Verify in Firestore:**
   - Check `profiles/{userId}.weeklyReminders` in Firebase Console
   - Should see `weeklyEnabled: true`, `weekday: 1`, `hour: 9`, `minute: 0`

4. **Test notification:**
   - Set reminder to today's weekday and a time 1-2 minutes from now
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
   - URL: `https://your-railway-url.railway.app/cron/weekly-reminders`
   - Method: `POST`
   - Headers: `X-CRON-SECRET: <your-cron-secret>`
   - Schedule: Every hour at minute 0 (`0 * * * *`)

2. **Test manually:**
   ```bash
   curl -X POST https://your-railway-url.railway.app/cron/weekly-reminders \
     -H "X-CRON-SECRET: your-secret"
   ```

## 📝 Code Examples

### Enable Weekly Reminder

```typescript
import { enableWeeklyReminder } from '@/lib/reminders';

// Enable reminder for Monday at 9:00 AM
// weekday: 1 = Monday, 2 = Tuesday, ..., 7 = Sunday
const handleEnable = async () => {
  const notificationId = await enableWeeklyReminder(1, 9, 0);
  if (notificationId) {
    console.log('Weekly reminder enabled!');
  } else {
    console.log('Failed - check permissions');
  }
};
```

### Disable Weekly Reminder

```typescript
import { disableWeeklyReminder } from '@/lib/reminders';

const handleDisable = async () => {
  await disableWeeklyReminder();
  console.log('Weekly reminder disabled');
};
```

### Get Current Settings

```typescript
import { getCurrentWeeklyReminderSettings } from '@/lib/reminders';

const loadSettings = async () => {
  if (!user?.id) return;
  const settings = await getCurrentWeeklyReminderSettings(user.id);
  console.log('Weekly reminder enabled:', settings?.weeklyEnabled);
  console.log('Weekday:', settings?.weekday); // 1-7
  console.log('Time:', settings?.hour, ':', settings?.minute);
};
```

### Using the Hook

```typescript
import { useWeeklyReminderSettings } from '@/lib/reminders-example-ui';

function MySettingsScreen() {
  const { settings, loading, enable, disable, enabled } = useWeeklyReminderSettings();
  
  return (
    <View>
      <Switch
        value={enabled}
        onValueChange={(value) => {
          if (value) {
            enable(1, 9, 0); // Monday at 9 AM
          } else {
            disable();
          }
        }}
      />
      {settings && (
        <Text>
          Reminder: {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][settings.weekday - 1]} at {settings.hour}:{settings.minute.toString().padStart(2, '0')}
        </Text>
      )}
    </View>
  );
}
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
   npm start
   # Then press 'i' for iOS or 'a' for Android
   
   # For production build
   eas build --platform ios
   # Or use TestFlight/Play Store
   ```

2. **Enable reminder:**
   - Open app and log in
   - Navigate to settings
   - Enable weekly reminder
   - Select today's weekday (for quick testing)
   - Set time to 1-2 minutes from now

3. **Verify:**
   - Check Firestore: `profiles/{userId}.weeklyReminders` should have `weeklyEnabled: true`
   - Wait for notification
   - Notification should appear at scheduled time

4. **Test rescheduling:**
   - Close app completely
   - Reopen app and log in
   - Weekly reminder should be rescheduled automatically
   - Check Firestore to confirm settings persisted

5. **Test disable:**
   - Disable reminder in settings
   - Check Firestore: `weeklyEnabled` should be `false`
   - Notification should not fire next week

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
- Wrong weekday selected

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

### Weekday Confusion

**Remember:**
- Our format: 1 = Monday, 7 = Sunday
- The code automatically converts to Expo's format internally
- Always use 1-7 in your UI code

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
2. **Test on a physical device** with a reminder set for today's weekday and 1-2 minutes out
3. **Verify Firestore persistence** after app restart
4. **Optional:** Set up server-driven reminders for reliability
5. **Customize notification content** in `reminders.ts` if needed

## 📚 Key Functions

### `enableWeeklyReminder(weekday, hour, minute)`
- Requests permissions if needed
- Schedules weekly notification
- Saves to Firestore
- Returns notification ID or null
- **Parameters:**
  - `weekday`: 1-7 (1 = Monday, 7 = Sunday)
  - `hour`: 0-23
  - `minute`: 0-59

### `disableWeeklyReminder()`
- Cancels scheduled notification
- Updates Firestore
- Gets current user from auth context

### `loadWeeklyReminderSettingsAndReschedule(userId)`
- Loads settings from Firestore
- Reschedules if enabled
- Called automatically on login

### `getCurrentWeeklyReminderSettings(userId)`
- Returns current settings from Firestore
- Useful for UI display

## 🔐 Security Notes

- Local notifications are device-specific
- Server-driven reminders require:
  - `CRON_SECRET` environment variable
  - Firebase Admin SDK credentials
  - Firestore read permissions for server
- Never expose `CRON_SECRET` in client code

## 📖 API Reference

### Server Endpoint: `POST /cron/weekly-reminders`

**Headers:**
- `X-CRON-SECRET`: Your cron secret (required)

**Response:**
```json
{
  "success": true,
  "message": "Processed 5 weekly reminder(s)",
  "count": 5,
  "stats": {
    "sent": 5,
    "failed": 0,
    "noToken": 0,
    "errors": []
  },
  "weekday": 1,
  "time": "9:00"
}
```

**Query Logic:**
- Finds users where `weeklyReminders.weeklyEnabled = true`
- Matches current weekday (1-7, where 1=Monday, 7=Sunday)
- Matches current hour and minute
- Sends push notifications to matching users

## 🆚 Daily vs Weekly Reminders

Both reminder types can coexist:
- **Daily reminders**: `profiles/{uid}.reminders`
- **Weekly reminders**: `profiles/{uid}.weeklyReminders`
- Users can enable both independently
- Each has its own notification ID and settings

