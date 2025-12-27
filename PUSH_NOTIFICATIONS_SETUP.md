# Push Notifications Setup Guide

This document describes the complete push notification setup using Expo Notifications + Expo Push Service with a Railway backend.

## 📁 Files Created/Modified

### App-side Files

1. **`src/lib/push.ts`** - Push notification registration and Firestore integration
2. **`src/contexts/auth-context.tsx`** - Updated to register push tokens on login

### Backend Files

3. **`railway-push-server/server.js`** - Express server for sending notifications
4. **`railway-push-server/package.json`** - Backend dependencies
5. **`railway-push-server/README.md`** - Backend deployment guide

## 🔧 How It Works

### 1. App Registration Flow

1. User logs in via Firebase Auth
2. `onAuthStateChanged` fires in `AuthProvider`
3. `registerForPushNotifications(userId)` is called automatically
4. App requests push notification permissions
5. Expo push token is fetched using EAS project ID from `app.json`
6. Token is saved to Firestore under `profiles/{uid}.expoPushToken`
7. On logout, token is removed from Firestore

### 2. Notification Tap Handling

- Already handled by `useNotificationListeners` hook in `App.tsx`
- Logs notification taps to analytics
- Extracts `screen` and `campaign` from notification data
- Can be extended to route to specific screens

### 3. Sending Notifications

- Railway backend calls Expo Push Service API
- Backend reads tokens from Firestore (you'll need to add this)
- Sends notifications via `/push` endpoint

## 📊 Firestore Document Structure

### User Profile Document

**Collection:** `profiles`  
**Document ID:** `{userId}` (Firebase Auth UID)

```json
{
  "email": "user@example.com",
  "role": "customer",
  "phone": "+1234567890",
  "location": "New York",
  "expoPushToken": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "pushTokenUpdatedAt": "2024-01-01T00:00:00.000Z",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Note:** The `expoPushToken` field is automatically added/updated when the user logs in and grants push notification permissions.

## 🚀 Deployment Steps

### Railway Backend Deployment

1. **Navigate to the server directory:**
   ```bash
   cd railway-push-server
   ```

2. **Install dependencies (optional, Railway does this automatically):**
   ```bash
   npm install
   ```

3. **Deploy to Railway:**
   - Go to [Railway](https://railway.app)
   - Create a new project
   - Connect your GitHub repo or deploy from the `railway-push-server` directory
   - Railway will auto-detect Node.js and run `npm start`
   - Note your Railway URL (e.g., `https://your-app.railway.app`)

4. **Test the health endpoint:**
   ```bash
   curl https://your-app.railway.app/health
   ```

### App-side (No deployment needed)

The app-side code is already integrated. Just ensure:

1. **EAS project ID is in `app.json`:**
   ```json
   {
     "extra": {
       "eas": {
         "projectId": "16248649-26d4-431e-a380-a40be65350a0"
       }
     }
   }
   ```
   ✅ Already configured

2. **Dependencies are installed:**
   ```bash
   yarn install
   ```
   ✅ `expo-notifications`, `expo-device`, `expo-constants` are already in `package.json`

## 📝 Usage Examples

### Sending a Notification from Your Backend

```javascript
// Example: Send notification when a new booking is created
const { getDoc } = require('firebase-admin/firestore');
const admin = require('firebase-admin');

// Initialize Firebase Admin (if not already done)
// admin.initializeApp();

async function sendBookingNotification(userId, bookingId) {
  // Get user's push token from Firestore
  const userDoc = await admin.firestore().collection('profiles').doc(userId).get();
  const pushToken = userDoc.data()?.expoPushToken;

  if (!pushToken) {
    console.log('User has no push token');
    return;
  }

  // Send via Railway backend
  const response = await fetch('https://your-app.railway.app/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: pushToken,
      title: 'New Booking',
      body: 'You have a new booking request',
      data: {
        screen: 'bookings',
        bookingId: bookingId,
      },
    }),
  });

  const result = await response.json();
  console.log('Notification sent:', result);
}
```

### Sending to Multiple Users

```javascript
async function sendBatchNotification(userIds, title, body) {
  // Get all push tokens
  const tokens = [];
  for (const userId of userIds) {
    const userDoc = await admin.firestore().collection('profiles').doc(userId).get();
    const token = userDoc.data()?.expoPushToken;
    if (token) {
      tokens.push(token);
    }
  }

  if (tokens.length === 0) {
    console.log('No push tokens found');
    return;
  }

  // Send batch notification
  const response = await fetch('https://your-app.railway.app/push/batch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tokens,
      title,
      body,
      data: {
        screen: 'home',
      },
    }),
  });

  const result = await response.json();
  console.log(`Sent ${result.count} notifications`);
}
```

## 🧪 Testing

### Test Push Registration

1. Run the app:
   ```bash
   yarn start
   ```

2. Log in with a test account
3. Grant push notification permissions when prompted
4. Check Firestore console - you should see `expoPushToken` in the user's profile document

### Test Notification Sending

1. Get a push token from Firestore
2. Send a test notification:
   ```bash
   curl -X POST https://your-app.railway.app/push \
     -H "Content-Type: application/json" \
     -d '{
       "to": "ExponentPushToken[YOUR_TOKEN_HERE]",
       "title": "Test",
       "body": "This is a test notification",
       "data": {"screen": "home"}
     }'
   ```

3. You should receive the notification on your device

## 🔍 Troubleshooting

### Token Not Saving to Firestore

- Check that user is logged in
- Check Firestore permissions (user must be able to write to `profiles/{uid}`)
- Check console logs for errors

### Notifications Not Received

- Verify token is correct in Firestore
- Check that app has notification permissions
- Ensure you're testing on a real device (not simulator)
- Check Railway server logs for errors
- Verify Expo Push Service is responding (check Railway response)

### Permission Denied

- User must grant permissions manually
- On iOS, permissions are one-time
- On Android, permissions can be revoked in settings

## 📚 Key Code Files

### `src/lib/push.ts`

Main push notification utilities:
- `registerForPushNotifications(userId)` - Register and save token
- `removePushTokenFromFirestore(userId)` - Remove token on logout
- `setupNotificationChannel()` - Android channel setup
- `getExpoPushToken()` - Get Expo push token

### `src/contexts/auth-context.tsx`

Auth lifecycle integration:
- Automatically registers push tokens on login
- Removes tokens on logout
- Error handling ensures auth flow isn't broken

### `railway-push-server/server.js`

Backend endpoints:
- `POST /push` - Send single notification
- `POST /push/batch` - Send batch notifications
- `GET /health` - Health check

## ✅ Checklist

- [x] Push token registration on login
- [x] Token saved to Firestore
- [x] Token removed on logout
- [x] Notification handler for foreground
- [x] Notification tap handling
- [x] Railway backend server
- [x] Health check endpoint
- [x] Batch notification support

## 🎯 Next Steps

1. Deploy Railway backend
2. Test push registration in app
3. Test sending notifications via Railway
4. Integrate notification sending into your booking/payment flows
5. Add routing logic in `useNotificationListeners` to navigate based on notification data

