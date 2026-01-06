# Push Notification Testing Guide

Complete guide for testing push notifications to verify they trigger, display, and update badges correctly.

## 🎯 Testing Goals

1. ✅ **Trigger notification** - Verify the notification is sent
2. ✅ **Receive notification** - See it appear on device
3. ✅ **Badge update** - See badge count increase

## 📱 Prerequisites

### Required:
- **Physical device** (iOS or Android) - Simulators/emulators don't support push notifications
- **App installed** with push notification permissions granted
- **User logged in** with valid `expoPushToken` stored in Firestore
- **Internet connection**

### Verify Setup:
1. Check user has push token in Firestore:
   ```javascript
   // In Firebase Console: profiles/{userId}
   {
     "expoPushToken": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
   }
   ```

2. Check notification permissions:
   - iOS: Settings → Notifications → Your App → Allow Notifications
   - Android: Usually granted automatically, check Settings → Apps → Your App → Notifications

## 🧪 Testing Methods

### Method 1: Admin Push Screen (Recommended - Easiest)

**Best for:** Quick testing, immediate feedback, testing badge updates

#### Steps:

1. **Login as admin user:**
   - User must have `role: "admin"` in `profiles/{uid}`

2. **Navigate to Admin Push screen:**
   - Should appear automatically if you're admin
   - Or navigate manually if needed

3. **Test Single User Notification:**
   - Select "Single User" mode
   - Enter your user UID or email
   - Click "Load User Token"
   - Verify token is found (shows "✓ Token found")
   - Enter:
     - **Title:** "Test Notification"
     - **Body:** "This is a test notification to verify push notifications are working"
     - **Data:** (optional) `{"type": "test", "testId": "123"}`
   - Click "Send Notification"

4. **Verify Results:**
   - ✅ Admin screen shows "✓ Success"
   - ✅ Device receives notification
   - ✅ Badge count increases
   - ✅ Notification appears in notification center

#### Expected Behavior:

**When App is in Foreground:**
- Alert appears on screen
- Badge count increases
- Notification appears in notification center

**When App is in Background:**
- Notification appears in notification center
- Badge count increases
- Sound plays (if enabled in device settings)

**When App is Closed:**
- Notification appears in notification center
- Badge count increases
- Sound plays (if enabled in device settings)

### Method 2: Firebase Cloud Functions (Real Triggers)

**Best for:** Testing actual business logic triggers (job assigned, booking confirmed)

#### Test Job Assigned Notification:

1. **Create/Update a job in Firestore:**
   ```javascript
   // In Firebase Console: jobs/{jobId}
   {
     "assignedWorkerId": "your-user-uid-here",
     "status": "assigned"
   }
   ```

2. **Or update existing job:**
   ```javascript
   // Change assignedWorkerId from null to your UID
   {
     "assignedWorkerId": null  // Before
   }
   // Then update to:
   {
     "assignedWorkerId": "your-user-uid-here"  // After
   }
   ```

3. **Verify:**
   - ✅ Check Functions logs in Firebase Console
   - ✅ Should see: "Job assigned to worker"
   - ✅ Should see: "Push notification sent to worker"
   - ✅ Device receives notification
   - ✅ Badge count increases

#### Test Booking Confirmed Notification:

1. **Create/Update a booking in Firestore:**
   ```javascript
   // In Firebase Console: bookings/{bookingId}
   {
     "customerId": "your-user-uid-here",
     "status": "pending"  // Initially pending
   }
   ```

2. **Update status to confirmed:**
   ```javascript
   {
     "status": "confirmed"  // Change to confirmed
   }
   ```

3. **Verify:**
   - ✅ Check Functions logs in Firebase Console
   - ✅ Should see: "Booking confirmed"
   - ✅ Should see: "Push notification sent to customer"
   - ✅ Device receives notification
   - ✅ Badge count increases

### Method 3: Direct Expo Push API (Advanced)

**Best for:** Testing without app UI, debugging token issues

#### Steps:

1. **Get your Expo push token:**
   - From Firestore: `profiles/{uid}.expoPushToken`
   - Or from app logs when registering

2. **Send test notification via curl:**
   ```bash
   curl -X POST https://exp.host/--/api/v2/push/send \
     -H "Content-Type: application/json" \
     -H "Accept: application/json" \
     -d '{
       "to": "ExponentPushToken[YOUR_TOKEN_HERE]",
       "title": "Test Notification",
       "body": "Testing push notifications",
       "sound": "default",
       "badge": 1,
       "data": {"type": "test"}
     }'
   ```

3. **Verify:**
   - ✅ Response shows success
   - ✅ Device receives notification
   - ✅ Badge updates

## 🔍 Verifying Badge Updates

### iOS:
1. **Check app icon badge:**
   - Look at app icon on home screen
   - Should show red badge with number

2. **Check notification center:**
   - Swipe down from top
   - Notification should appear
   - Badge count should match

3. **Programmatically check:**
   ```typescript
   import * as Notifications from 'expo-notifications';
   
   const badgeCount = await Notifications.getBadgeCountAsync();
   console.log('Current badge count:', badgeCount);
   ```

### Android:
1. **Check notification drawer:**
   - Swipe down from top
   - Notification should appear
   - App icon may show badge (depends on launcher)

2. **Check app icon:**
   - Some Android launchers show badges
   - Not all devices support this

## 🐛 Troubleshooting

### Notification Not Appearing

**Check:**
- ✅ Device is real (not simulator)
- ✅ Push token is valid and in Firestore
- ✅ Notification permissions granted
- ✅ App is not in "Do Not Disturb" mode
- ✅ Device has internet connection

**Debug:**
1. Check Functions logs (if using Cloud Functions)
2. Check admin screen results (if using admin UI)
3. Verify token format: Should start with `ExponentPushToken[` or `ExpoPushToken[`
4. Test token directly with Expo API (Method 3)

### Badge Not Updating

**Check:**
- ✅ `shouldSetBadge: true` in notification handler
- ✅ Notification is actually received
- ✅ App has badge permission (iOS)

**Fix:**
1. Verify notification handler configuration:
   ```typescript
   Notifications.setNotificationHandler({
     handleNotification: async () => ({
       shouldShowAlert: true,
       shouldPlaySound: false,
       shouldSetBadge: true, // Must be true
     }),
   });
   ```

2. Manually set badge for testing:
   ```typescript
   await Notifications.setBadgeCountAsync(1);
   ```

3. Clear badge:
   ```typescript
   await Notifications.setBadgeCountAsync(0);
   ```

### Token Not Found

**Check:**
- ✅ User is logged in
- ✅ Push notification registration ran successfully
- ✅ Token is saved to Firestore: `profiles/{uid}.expoPushToken`

**Fix:**
1. Re-register for push notifications:
   - Logout and login again
   - Or call `registerForPushNotifications()` manually

2. Check Firestore:
   - Verify token exists in `profiles/{uid}`
   - Verify token format is correct

### Functions Not Triggering

**Check:**
- ✅ Functions are deployed
- ✅ Document path matches exactly: `jobs/{jobId}` or `bookings/{bookingId}`
- ✅ Document is being updated (not just created)
- ✅ For jobs: `assignedWorkerId` actually changed
- ✅ For bookings: `status` actually changed to `"confirmed"`

**Debug:**
1. Check Functions logs in Firebase Console
2. Look for debug/info messages
3. Verify document changes in Firestore Console

## 📋 Complete Testing Checklist

### Setup
- [ ] Physical device ready
- [ ] App installed with permissions
- [ ] User logged in
- [ ] Push token in Firestore
- [ ] Notification handler configured

### Test 1: Admin Push Screen
- [ ] Login as admin
- [ ] Navigate to Admin Push screen
- [ ] Load user token successfully
- [ ] Send test notification
- [ ] See success message
- [ ] Receive notification on device
- [ ] Badge count increases
- [ ] Notification appears in notification center

### Test 2: Job Assigned Trigger
- [ ] Create/update job with `assignedWorkerId`
- [ ] Check Functions logs show trigger
- [ ] Receive notification on device
- [ ] Badge count increases
- [ ] Notification has correct title/body

### Test 3: Booking Confirmed Trigger
- [ ] Create/update booking with `status: "confirmed"`
- [ ] Check Functions logs show trigger
- [ ] Receive notification on device
- [ ] Badge count increases
- [ ] Notification has correct title/body

### Test 4: Badge Updates
- [ ] Send multiple notifications
- [ ] Verify badge count increases each time
- [ ] Clear badge and verify it resets
- [ ] Test badge persists after app restart

### Test 5: Different App States
- [ ] App in foreground → Notification shows alert + badge
- [ ] App in background → Notification in center + badge
- [ ] App closed → Notification in center + badge

## 🎯 Quick Test Script

Here's a quick test you can run:

1. **Open app on physical device**
2. **Login as admin**
3. **Go to Admin Push screen**
4. **Send test notification to yourself:**
   - Title: "Test Badge Update"
   - Body: "Testing badge count"
   - Data: `{"type": "test", "count": 1}`
5. **Verify:**
   - Notification appears
   - Badge shows "1"
6. **Send another notification:**
   - Change data to: `{"type": "test", "count": 2}`
7. **Verify:**
   - Badge shows "2" (or increments)
8. **Clear badge:**
   ```typescript
   // In app console or add button
   await Notifications.setBadgeCountAsync(0);
   ```

## 💡 Pro Tips

1. **Test on both iOS and Android** - Behavior can differ
2. **Test with app in different states** - Foreground, background, closed
3. **Check notification center** - Some notifications only appear there
4. **Monitor Functions logs** - See exactly what's happening server-side
5. **Use admin screen for quick tests** - Fastest way to test
6. **Test badge persistence** - Close and reopen app, badge should persist
7. **Test multiple notifications** - Verify badge increments correctly

## 🔗 Useful Commands

### Check current badge count:
```typescript
const count = await Notifications.getBadgeCountAsync();
console.log('Badge count:', count);
```

### Set badge count manually:
```typescript
await Notifications.setBadgeCountAsync(5);
```

### Clear badge:
```typescript
await Notifications.setBadgeCountAsync(0);
```

### Get all scheduled notifications:
```typescript
const scheduled = await Notifications.getAllScheduledNotificationsAsync();
console.log('Scheduled:', scheduled);
```

## ✅ Success Criteria

You'll know push notifications are working correctly when:
- ✅ Notifications appear on device
- ✅ Badge count updates
- ✅ Notifications persist in notification center
- ✅ Functions logs show successful sends
- ✅ Admin screen shows success
- ✅ Works in all app states (foreground, background, closed)

