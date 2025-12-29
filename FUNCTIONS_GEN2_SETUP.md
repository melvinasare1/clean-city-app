# Firebase Cloud Functions Gen 2 Setup Guide

Complete guide for deploying Firestore-triggered push notifications using Firebase Cloud Functions Gen 2.

## 📁 Files Modified

1. **`functions/src/index.ts`** - Updated to Gen 2 with `onDocumentUpdated`
2. **`functions/package.json`** - Updated `firebase-functions` to v5.0.0
3. **`functions/tsconfig.json`** - Already configured correctly

## 🔧 What Changed (Gen 1 → Gen 2)

### Key Differences

- **Import:** `firebase-functions/v2/firestore` instead of `firebase-functions`
- **Trigger:** `onDocumentUpdated()` instead of `.onUpdate()`
- **Event Type:** `event.data.before/after` instead of `change.before/after`
- **Options:** Global options via `setGlobalOptions()`
- **Logger:** `logger` from `firebase-functions` instead of `functions.logger`

### Configuration

- **Runtime:** Node.js 20
- **Region:** europe-west2 (London)
- **Memory:** 256MiB
- **Timeout:** 60 seconds

## 🚀 Deployment Steps

### 1. Install Dependencies

```bash
cd functions
npm install
```

This will install:
- `firebase-admin` ^12.0.0
- `firebase-functions` ^5.0.0 (Gen 2)

### 2. Build TypeScript

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `lib/` directory.

### 3. Deploy Functions

```bash
# From project root
firebase deploy --only functions

# Or from functions directory
cd ..
firebase deploy --only functions
```

### 4. Verify Deployment

Check Firebase Console:
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Navigate to **Functions**
4. You should see:
   - `onJobAssigned` (Gen 2, europe-west2)
   - `onBookingConfirmed` (Gen 2, europe-west2)

## 📊 Data Model

### User Document

**Collection:** `users`  
**Document ID:** `{uid}` (Firebase Auth UID)

```json
{
  "expoPushToken": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "notificationPreferences": {
    "enabled": true
  }
}
```

**Fields:**
- `expoPushToken`: `string | null` - Expo push token (required for notifications)
- `notificationPreferences.enabled`: `boolean` (optional) - If `false`, notifications are skipped

### Job Document

**Collection:** `jobs`  
**Document ID:** `{jobId}`

```json
{
  "assignedWorkerId": "worker-uid-123",
  "status": "assigned",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**Fields:**
- `assignedWorkerId`: `string | null` - Worker's Firebase Auth UID (set when job is assigned)

### Booking Document

**Collection:** `bookings`  
**Document ID:** `{bookingId}`

```json
{
  "customerId": "customer-uid-456",
  "status": "confirmed",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**Fields:**
- `customerId`: `string` - Customer's Firebase Auth UID
- `status`: `string` - Booking status (`"pending"` | `"confirmed"` | etc.)

## 🧪 Testing Checklist

### ✅ Prerequisites

- [ ] Firebase project is on **Blaze plan** (required for Cloud Functions)
- [ ] User documents exist in `users/{uid}` collection
- [ ] Users have valid `expoPushToken` in their documents
- [ ] Functions are deployed successfully

### ✅ Test 1: Job Assigned Notification

1. **Create a job document:**
   ```javascript
   // In Firebase Console or via code
   const jobRef = db.collection('jobs').doc('test-job-123');
   await jobRef.set({
     assignedWorkerId: null, // Initially unassigned
     status: 'pending'
   });
   ```

2. **Assign the job to a worker:**
   ```javascript
   await jobRef.update({
     assignedWorkerId: 'worker-uid-here' // Assign to worker
   });
   ```

3. **Verify:**
   - [ ] Check Functions logs in Firebase Console
   - [ ] Logs should show: "Job assigned to worker"
   - [ ] Logs should show: "Push notification sent to worker"
   - [ ] Worker receives push notification on device
   - [ ] Notification title: "New job assigned"
   - [ ] Notification body: "You've been assigned a new rubbish collection job."
   - [ ] Notification data: `{ type: "job_assigned", jobId: "test-job-123" }`

### ✅ Test 2: Job Reassigned Notification

1. **Update job with different worker:**
   ```javascript
   await jobRef.update({
     assignedWorkerId: 'different-worker-uid' // Change worker
   });
   ```

2. **Verify:**
   - [ ] New worker receives notification
   - [ ] Previous worker does NOT receive notification (only on assignment change)

### ✅ Test 3: Booking Confirmed Notification

1. **Create a booking document:**
   ```javascript
   const bookingRef = db.collection('bookings').doc('test-booking-123');
   await bookingRef.set({
     customerId: 'customer-uid-here',
     status: 'pending'
   });
   ```

2. **Confirm the booking:**
   ```javascript
   await bookingRef.update({
     status: 'confirmed' // Change to confirmed
   });
   ```

3. **Verify:**
   - [ ] Check Functions logs in Firebase Console
   - [ ] Logs should show: "Booking confirmed"
   - [ ] Logs should show: "Push notification sent to customer"
   - [ ] Customer receives push notification on device
   - [ ] Notification title: "Booking confirmed"
   - [ ] Notification body: "Your rubbish collection booking has been confirmed."
   - [ ] Notification data: `{ type: "booking_confirmed", bookingId: "test-booking-123" }`

### ✅ Test 4: No Duplicate Notifications

1. **Update booking status to "confirmed" again:**
   ```javascript
   await bookingRef.update({
     status: 'confirmed' // Already confirmed
   });
   ```

2. **Verify:**
   - [ ] No notification sent (status didn't change)
   - [ ] Logs show: "Booking status change did not trigger confirmation"

### ✅ Test 5: User Without Token

1. **Create user without expoPushToken:**
   ```javascript
   const userRef = db.collection('users').doc('user-without-token');
   await userRef.set({
     // No expoPushToken field
   });
   ```

2. **Trigger notification (job assigned or booking confirmed)**
3. **Verify:**
   - [ ] No notification sent
   - [ ] Logs show: "No Expo push token found for user"

### ✅ Test 6: Notifications Disabled

1. **Update user with notifications disabled:**
   ```javascript
   const userRef = db.collection('users').doc('user-uid');
   await userRef.update({
     notificationPreferences: {
       enabled: false
     }
   });
   ```

2. **Trigger notification**
3. **Verify:**
   - [ ] No notification sent
   - [ ] Logs show: "Notifications disabled for user"

## 🔍 Troubleshooting

### Functions Not Deploying

**Check:**
- ✅ Firebase CLI is installed: `firebase --version`
- ✅ You're logged in: `firebase login`
- ✅ Correct project selected: `firebase use <project-id>`
- ✅ Project is on Blaze plan
- ✅ TypeScript compiles: `cd functions && npm run build`

**Fix:**
```bash
firebase login
firebase use --add  # Select your project
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

### Functions Not Triggering

**Check:**
- ✅ Functions are deployed and active
- ✅ Document path matches exactly: `jobs/{jobId}` or `bookings/{bookingId}`
- ✅ Document is being updated (not just created)
- ✅ For jobs: `assignedWorkerId` actually changed
- ✅ For bookings: `status` actually changed to `"confirmed"`

**Debug:**
1. Check Functions logs in Firebase Console
2. Look for debug/info messages
3. Verify document changes in Firestore Console
4. Test with a simple update

### Notifications Not Sending

**Check:**
- ✅ User has valid `expoPushToken` in `users/{uid}`
- ✅ Token format is correct (starts with `ExponentPushToken[` or `ExpoPushToken[`)
- ✅ `notificationPreferences.enabled` is not `false`
- ✅ Expo Push Service is accessible
- ✅ Function logs show no errors

**Debug:**
1. Check Functions logs for errors
2. Verify token format in Firestore
3. Test token manually with Expo Push API
4. Check Expo Push Service status

### "User document not found" Error

**Check:**
- ✅ User document exists in `users/{uid}` collection (not `profiles/{uid}`)
- ✅ User ID matches exactly
- ✅ Firestore security rules allow function access (functions run with admin privileges)

**Note:** If your app uses `profiles/{uid}` instead of `users/{uid}`, update the `getUserPushToken` function in `functions/src/index.ts`:

```typescript
const userDoc = await db.doc(`profiles/${userId}`).get(); // Change from users to profiles
```

### TypeScript Compilation Errors

**Check:**
- ✅ Node.js version is 20: `node --version`
- ✅ TypeScript is installed: `npm list typescript`
- ✅ All dependencies installed: `npm install`

**Fix:**
```bash
cd functions
rm -rf node_modules package-lock.json
npm install
npm run build
```

## 📝 Function Details

### `onJobAssigned`

**Trigger:** `jobs/{jobId}` document update

**Condition:**
- `assignedWorkerId` changes from `null`/`undefined`/empty to a UID
- OR `assignedWorkerId` changes to a different UID

**Action:**
1. Gets worker's push token from `users/{assignedWorkerId}`
2. Checks `notificationPreferences.enabled`
3. Sends push notification if token exists and enabled

### `onBookingConfirmed`

**Trigger:** `bookings/{bookingId}` document update

**Condition:**
- `status` changes to `"confirmed"` (from any other status)

**Action:**
1. Gets customer's push token from `users/{customerId}`
2. Checks `notificationPreferences.enabled`
3. Sends push notification if token exists and enabled

### `sendExpoPush`

**Helper function** that:
- Validates Expo push token format
- Sends POST request to Expo Push Service
- Handles errors gracefully (doesn't crash function)
- Logs results

### `getUserPushToken`

**Helper function** that:
- Reads user document from `users/{uid}`
- Checks `notificationPreferences.enabled`
- Returns `expoPushToken` or `null`
- Handles errors gracefully

## 🔐 Security Notes

- Functions run with **admin privileges** (bypass Firestore security rules)
- Functions can read any Firestore document
- No client-side code required
- Expo push tokens are stored in Firestore (encrypted at rest)
- Functions are server-side only

## ✅ Checklist

- [x] Functions updated to Gen 2
- [x] Node.js 20 configured
- [x] Region set to us-central1
- [x] Memory set to 256MiB
- [x] Timeout set to 60s
- [x] Job assigned trigger implemented
- [x] Booking confirmed trigger implemented
- [x] Expo push helper function
- [x] User token fetching with preferences check
- [x] Error handling
- [x] Logging
- [x] Documentation

## 🎯 Next Steps

1. **Deploy functions** using `firebase deploy --only functions`
2. **Test job assignment** by updating a job document
3. **Test booking confirmation** by updating a booking status
4. **Monitor logs** in Firebase Console
5. **Verify notifications** arrive on devices

## 📖 Additional Resources

- [Firebase Cloud Functions Gen 2 Documentation](https://firebase.google.com/docs/functions/2nd-gen)
- [Expo Push Notifications API](https://docs.expo.dev/push-notifications/sending-notifications/)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)

## ⚠️ Important Notes

1. **Data Model:** This implementation uses `users/{uid}` as specified. If your app uses `profiles/{uid}`, update the `getUserPushToken` function.

2. **Booking Field:** This implementation uses `customerId` as specified. If your app uses `userId`, update the `onBookingConfirmed` function.

3. **Blaze Plan:** Cloud Functions require a Firebase Blaze (pay-as-you-go) plan. Free Spark plan does not support Cloud Functions.

4. **Billing:** Functions are billed per invocation and compute time. Monitor usage in Firebase Console.

