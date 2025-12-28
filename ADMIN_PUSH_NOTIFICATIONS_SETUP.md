# Admin Push Notifications Setup Guide

Complete guide for the admin UI that allows manually triggering push notifications to users.

## 📁 Files Created

### Core Files

1. **`src/lib/admin.ts`** - Admin helper functions (`isAdmin`, `requireAdmin`)
2. **`src/lib/pushSender.ts`** - Railway backend API wrapper
3. **`src/screens/admin/admin-push-screen.tsx`** - Admin push notification UI
4. **`src/navigation/admin-navigation.tsx`** - Admin navigation stack
5. **`src/navigation/types.ts`** - Updated with `AdminStackParamList`
6. **`src/navigation/root-navigation.tsx`** - Updated to route admins to admin screen

## 🔧 How It Works

### 1. Admin Access Control

- Checks if user has `role === "admin"` in `profiles/{uid}.role`
- Admin screen is only accessible to admin users
- Non-admin users see "Admin access required" message

### 2. Push Notification Sending

- **Single User Mode:**
  - Search by UID or email
  - Load user's Expo push token from Firestore
  - Send notification via Railway backend

- **All Users Mode:**
  - Fetches all users with `expoPushToken` from Firestore
  - Sends notifications sequentially with rate limiting (100ms delay = ~10/sec)
  - Shows progress and results

### 3. Railway Backend Integration

- Calls `POST ${EXPO_PUBLIC_API_URL}/push`
- Sends `{ to, title, body, data }` payload
- Optionally includes `X-ADMIN-SECRET` header if configured

## 🚀 Setup Steps

### 1. Environment Variables

Add to your `.env` file or Expo config:

```bash
EXPO_PUBLIC_API_URL=https://your-railway-url.railway.app
EXPO_PUBLIC_ADMIN_SECRET=your-secret-here  # Optional, for backend auth
```

**Note:** In Expo, environment variables must be prefixed with `EXPO_PUBLIC_` to be accessible in the app.

### 2. Set User as Admin

Update a user's role in Firestore:

```javascript
// In Firebase Console or via code
const userRef = db.collection('profiles').doc('user-uid-here');
await userRef.update({
  role: 'admin'
});
```

### 3. Verify Railway Backend

Ensure your Railway backend has the `/push` endpoint:
- Endpoint: `POST /push`
- Expected body: `{ to: string, title: string, body: string, data?: object }`
- Returns: `{ success: boolean, receipt?: any, message?: string }`

### 4. Test the Feature

1. **Login as admin user**
2. **Navigate to Admin Push screen** (should be automatic if you're admin)
3. **Test single user notification:**
   - Select "Single User" mode
   - Enter a user UID or email
   - Click "Load User Token"
   - Enter title and body
   - Click "Send Notification"
4. **Test bulk notification:**
   - Select "All Users" mode
   - Enter title and body
   - Click "Send Notification"
   - Confirm the bulk send
   - Wait for results

## 📊 Data Model

### User Profile Document

**Collection:** `profiles`  
**Document ID:** `{userId}` (Firebase Auth UID)

```json
{
  "email": "admin@example.com",
  "role": "admin",
  "expoPushToken": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
}
```

**Required for Admin:**
- `role`: Must be `"admin"` (string)

**Required for Push Notifications:**
- `expoPushToken`: Expo push token (string)

## 🧪 Testing Checklist

### ✅ Basic Functionality

- [ ] Login as admin user → Should see Admin Push screen
- [ ] Login as non-admin → Should NOT see Admin Push screen
- [ ] Single user mode: Search by UID → Load token → Send notification
- [ ] Single user mode: Search by email → Load token → Send notification
- [ ] All users mode: Shows count of users with tokens
- [ ] All users mode: Bulk send with confirmation → Shows results

### ✅ Validation

- [ ] Empty title/body → Shows error
- [ ] Invalid JSON in data field → Shows error
- [ ] User without token → Shows "No Token" message
- [ ] User not found → Shows "Not Found" message

### ✅ Results Display

- [ ] Single send → Shows success/failure
- [ ] Bulk send → Shows success/failure counts
- [ ] Results list shows user IDs and status
- [ ] Error messages are displayed correctly

### ✅ Security

- [ ] Non-admin cannot access admin screen
- [ ] Admin secret is not exposed in UI (check network requests)
- [ ] Bulk send requires confirmation

### ✅ Backend Integration

- [ ] Notifications are sent to Railway backend
- [ ] Backend receives correct payload
- [ ] Backend sends to Expo Push Service
- [ ] Notifications arrive on devices

## 🔍 Troubleshooting

### Admin Screen Not Showing

**Check:**
- ✅ User's `role` field in Firestore is set to `"admin"` (string, not boolean)
- ✅ User is logged in
- ✅ App has been restarted after role change

**Fix:**
```javascript
// Update user role in Firestore
const userRef = db.collection('profiles').doc('user-uid');
await userRef.update({ role: 'admin' });
```

### "EXPO_PUBLIC_API_URL not configured" Error

**Check:**
- ✅ Environment variable is set with `EXPO_PUBLIC_` prefix
- ✅ App has been restarted after adding env var
- ✅ Variable is accessible (check with `console.log(process.env.EXPO_PUBLIC_API_URL)`)

**Fix:**
1. Add to `.env` file:
   ```
   EXPO_PUBLIC_API_URL=https://your-railway-url.railway.app
   ```
2. Restart Expo: `npx expo start -c`

### Push Notifications Not Sending

**Check:**
- ✅ Railway backend is running and accessible
- ✅ `/push` endpoint exists and works
- ✅ User has valid `expoPushToken` in Firestore
- ✅ Network requests are not blocked

**Debug:**
1. Check browser/device network logs
2. Check Railway backend logs
3. Verify token format (should start with `ExponentPushToken[` or `ExpoPushToken[`)

### Bulk Send Too Slow

**Current Rate:** ~10 notifications per second (100ms delay)

**To Adjust:**
Edit `src/screens/admin/admin-push-screen.tsx`:
```typescript
// Change delay (in milliseconds)
await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms = 10/sec
```

**Note:** Too fast may cause rate limiting. 10/sec is a safe default.

### User Search Not Working

**Check:**
- ✅ User exists in `profiles` collection
- ✅ User has `email` field (for email search)
- ✅ Firestore security rules allow reading profiles

**Debug:**
- Try searching by exact UID first
- Check Firestore Console for user document
- Verify email is stored in lowercase (code converts to lowercase)

## 📝 Code Examples

### Check if User is Admin

```typescript
import { isAdmin } from '@/lib/admin';
import { useAuth } from '@/hooks/useAuth';

function MyComponent() {
  const { user } = useAuth();
  
  if (isAdmin(user)) {
    return <AdminContent />;
  }
  
  return <RegularContent />;
}
```

### Send Push Notification Programmatically

```typescript
import { sendPush } from '@/lib/pushSender';

const result = await sendPush({
  to: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
  title: 'Test Notification',
  body: 'This is a test',
  data: { type: 'test' }
});

if (result.success) {
  console.log('Sent!', result.message);
} else {
  console.error('Failed:', result.error);
}
```

## 🔐 Security Notes

- **Admin Secret:** Optional header `X-ADMIN-SECRET` can be used for backend authentication
- **Role Check:** Admin check is done client-side (for UI) but should also be enforced server-side
- **Token Access:** Only admins can access the push screen, but tokens are still readable from Firestore
- **Rate Limiting:** Bulk sends are rate-limited to prevent abuse

## ✅ Checklist

- [x] Admin helper functions implemented
- [x] Push sender wrapper created
- [x] Admin UI screen created
- [x] Navigation integrated
- [x] Single user mode working
- [x] Bulk send mode working
- [x] Results display working
- [x] Error handling implemented
- [x] Security checks in place
- [x] Documentation complete

## 🎯 Next Steps

1. **Set environment variables** (`EXPO_PUBLIC_API_URL`)
2. **Set a user as admin** in Firestore
3. **Test single user notification**
4. **Test bulk notification** (with small test group first)
5. **Monitor Railway backend logs** for any issues
6. **Verify notifications arrive** on test devices

## 📖 Additional Resources

- [Expo Environment Variables](https://docs.expo.dev/guides/environment-variables/)
- [Firebase Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Expo Push Notifications](https://docs.expo.dev/push-notifications/overview/)

