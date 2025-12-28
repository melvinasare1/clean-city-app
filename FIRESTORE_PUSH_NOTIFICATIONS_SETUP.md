# Firestore-Triggered Push Notifications Setup Guide

Complete guide for implementing Firestore-triggered push notifications using Firebase Cloud Functions.

## 📁 Files Created

### Functions Directory

1. **`functions/package.json`** - Dependencies and scripts
2. **`functions/tsconfig.json`** - TypeScript configuration
3. **`functions/src/index.ts`** - Cloud Functions implementation
4. **`functions/.gitignore`** - Git ignore rules
5. **`firebase.json`** - Firebase project configuration

## 🔧 How It Works

### 1. Job Assigned Notification

**Trigger:** `jobs/{jobId}` document `onUpdate`

**Condition:** `assignedWorkerId` changes from `null`/`undefined` to a UID (or changes to a different UID)

**Action:**
- Reads worker's Expo push token from `profiles/{workerId}.expoPushToken`
- Checks `notificationPreferences.enabled` (if present)
- Sends push notification:
  - **Title:** "New job assigned"
  - **Body:** "You've been assigned a new rubbish collection job."
  - **Data:** `{ type: "job_assigned", jobId }`

### 2. Booking Confirmed Notification

**Trigger:** `bookings/{bookingId}` document `onUpdate`

**Condition:** `status` changes to `"confirmed"` (from any other status)

**Action:**
- Reads customer's Expo push token from `profiles/{customerId}.expoPushToken`
- Checks `notificationPreferences.enabled` (if present)
- Sends push notification:
  - **Title:** "Booking confirmed"
  - **Body:** "Your rubbish collection booking has been confirmed."
  - **Data:** `{ type: "booking_confirmed", bookingId }`

## 📊 Firestore Data Model

### User Profile Document

**Collection:** `profiles`  
**Document ID:** `{userId}` (Firebase Auth UID)

```json
{
  "email": "user@example.com",
  "role": "customer",
  "expoPushToken": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "notificationPreferences": {
    "enabled": true
  },
  "pushTokenUpdatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Fields:**
- `expoPushToken`: `string | null` - Expo push token (required for notifications)
- `notificationPreferences.enabled`: `boolean` (optional) - If `false`, notifications are skipped

### Booking Document

**Collection:** `bookings`  
**Document ID:** `{bookingId}`

```json
{
  "userId": "customer-uid-123",
  "date": "2024-01-15",
  "status": "pending",
  "totalPrice": 50,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**Fields:**
- `userId`: `string` - Customer's Firebase Auth UID (used to find push token)
- `status`: `string` - Booking status (`"pending"` | `"confirmed"` | `"cancelled"` | etc.)

### Job Document

**Collection:** `jobs`  
**Document ID:** `{jobId}`

```json
{
  "assignedWorkerId": "worker-uid-456",
  "bookingId": "booking-123",
  "status": "assigned",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**Fields:**
- `assignedWorkerId`: `string | null` - Worker's Firebase Auth UID (set when job is assigned)
- `bookingId`: `string` (optional) - Related booking ID
- `status`: `string` (optional) - Job status

## 🚀 Setup Steps

### 1. Install Firebase CLI

```bash
npm install -g firebase-tools
```

### 2. Login to Firebase

```bash
firebase login
```

### 3. Initialize Functions (if not already done)

```bash
cd functions
npm install
cd ..
```

### 4. Build Functions

```bash
cd functions
npm run build
cd ..
```

### 5. Deploy Functions

```bash
firebase deploy --only functions
```

Or deploy specific functions:

```bash
firebase deploy --only functions:onJobAssigned
firebase deploy --only functions:onBookingConfirmed
```

### 6. Verify Deployment

Check the Firebase Console:
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Navigate to **Functions**
4. You should see:
   - `onJobAssigned`
   - `onBookingConfirmed`

## 🧪 Testing

### Test 1: Job Assigned Notification

1. **Create or update a job document in Firestore:**

   ```javascript
   // In Firebase Console or via code
   const jobRef = db.collection('jobs').doc('test-job-123');
   await jobRef.set({
     assignedWorkerId: 'worker-uid-456', // Worker's Firebase Auth UID
     bookingId: 'booking-123',
     status: 'assigned',
     createdAt: admin.firestore.FieldValue.serverTimestamp()
   });
   ```

2. **Verify:**
   - Check Functions logs in Firebase Console
   - Worker should receive push notification on their device
   - Logs should show: "Push notification sent to worker {workerId} for job {jobId}"

### Test 2: Booking Confirmed Notification

1. **Update a booking document in Firestore:**

   ```javascript
   // In Firebase Console or via code
   const bookingRef = db.collection('bookings').doc('test-booking-123');
   await bookingRef.update({
     status: 'confirmed' // Change from 'pending' to 'confirmed'
   });
   ```

2. **Verify:**
   - Check Functions logs in Firebase Console
   - Customer should receive push notification on their device
   - Logs should show: "Push notification sent to customer {customerId} for booking {bookingId}"

### Test 3: Notification Preferences

1. **Disable notifications for a user:**

   ```javascript
   const userRef = db.collection('profiles').doc('user-uid-123');
   await userRef.update({
     notificationPreferences: {
       enabled: false
     }
   });
   ```

2. **Trigger a notification (job assigned or booking confirmed)**
3. **Verify:**
   - No notification sent
   - Logs should show: "Notifications disabled for user: {userId}"

### Test 4: Missing Push Token

1. **Remove push token from a user:**

   ```javascript
   const userRef = db.collection('profiles').doc('user-uid-123');
   await userRef.update({
     expoPushToken: null
   });
   ```

2. **Trigger a notification**
3. **Verify:**
   - No notification sent
   - Logs should show: "No Expo push token found for user: {userId}"

## 📝 Code Examples

### Manual Testing via Firebase Console

1. **Go to Firestore Database in Firebase Console**
2. **Create/Update a job:**
   - Collection: `jobs`
   - Document ID: `test-job-1`
   - Fields:
     - `assignedWorkerId`: `"worker-uid-here"`
     - `status`: `"assigned"`

3. **Create/Update a booking:**
   - Collection: `bookings`
   - Document ID: `test-booking-1`
   - Fields:
     - `userId`: `"customer-uid-here"`
     - `status`: `"confirmed"`

### Viewing Function Logs

```bash
# View all function logs
firebase functions:log

# View logs for specific function
firebase functions:log --only onJobAssigned
firebase functions:log --only onBookingConfirmed

# Follow logs in real-time
firebase functions:log --follow
```

## 🔍 Troubleshooting

### Functions Not Deploying

**Check:**
- ✅ Firebase CLI is installed and logged in
- ✅ You have the correct project selected: `firebase use <project-id>`
- ✅ Functions build successfully: `cd functions && npm run build`
- ✅ Node version matches `package.json` engines (Node 18)

**Fix:**
```bash
firebase use --add  # Select your project
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

### Notifications Not Sending

**Check:**
- ✅ Function is deployed and active
- ✅ Function logs show execution (check Firebase Console)
- ✅ User has valid `expoPushToken` in `profiles/{uid}`
- ✅ `notificationPreferences.enabled` is not `false`
- ✅ Expo push token format is correct (starts with `ExponentPushToken[` or `ExpoPushToken[`)

**Debug:**
1. Check Functions logs in Firebase Console
2. Look for error messages or warnings
3. Verify user document has `expoPushToken` field
4. Test Expo push token manually using Expo's API

### Function Not Triggering

**Check:**
- ✅ Document path matches exactly: `jobs/{jobId}` or `bookings/{bookingId}`
- ✅ Document is being updated (not just created)
- ✅ For jobs: `assignedWorkerId` actually changed
- ✅ For bookings: `status` actually changed to `"confirmed"`

**Debug:**
- Check Functions logs for debug messages
- Verify document changes in Firestore Console
- Test with a simple update to trigger the function

### Permission Errors

**Check Firestore Security Rules:**
```javascript
// Allow functions to read user profiles
match /profiles/{userId} {
  allow read: if request.auth != null;
  // Or allow service account (functions run as service account)
  allow read: if true; // For functions only
}
```

**Note:** Cloud Functions run with admin privileges, so they can read any document regardless of security rules.

## 📚 Function Details

### `onJobAssigned`

**Trigger:** `jobs/{jobId}` onUpdate

**Logic:**
1. Compares `before.assignedWorkerId` and `after.assignedWorkerId`
2. Triggers if:
   - Was unassigned (`null`/`undefined`/empty) and now assigned (has UID)
   - OR worker changed (different UID)
3. Gets worker's push token from `profiles/{assignedWorkerId}`
4. Sends notification if token exists and preferences allow

### `onBookingConfirmed`

**Trigger:** `bookings/{bookingId}` onUpdate

**Logic:**
1. Compares `before.status` and `after.status`
2. Triggers if status changed to `"confirmed"`
3. Gets customer's push token from `profiles/{userId}`
4. Sends notification if token exists and preferences allow

### `sendExpoPush`

**Helper function** that:
- Accepts single token or array of tokens
- Validates token format
- Sends to Expo Push Service API
- Handles errors gracefully
- Logs results

### `getUserPushToken`

**Helper function** that:
- Reads user document from `profiles/{userId}`
- Checks `notificationPreferences.enabled`
- Returns `expoPushToken` or `null`
- Handles errors gracefully

## 🔐 Security Notes

- Cloud Functions run with **admin privileges** (bypass Firestore security rules)
- Functions can read any Firestore document
- Functions use Firebase Admin SDK (server-side only)
- No client-side Firebase Messaging required
- Expo push tokens are stored in Firestore (encrypted at rest)

## ✅ Checklist

- [x] Functions code implemented
- [x] TypeScript configuration
- [x] Package.json with dependencies
- [x] Firebase.json configuration
- [x] Job assigned trigger
- [x] Booking confirmed trigger
- [x] Push token validation
- [x] Notification preferences check
- [x] Error handling
- [x] Logging
- [x] Documentation

## 🎯 Next Steps

1. **Deploy functions** using `firebase deploy --only functions`
2. **Test job assignment** by creating/updating a job document
3. **Test booking confirmation** by updating a booking status
4. **Monitor logs** in Firebase Console
5. **Verify notifications** arrive on devices
6. **Add notification preferences UI** (optional) to let users opt-out

## 📖 Additional Resources

- [Firebase Cloud Functions Documentation](https://firebase.google.com/docs/functions)
- [Expo Push Notifications API](https://docs.expo.dev/push-notifications/sending-notifications/)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)

