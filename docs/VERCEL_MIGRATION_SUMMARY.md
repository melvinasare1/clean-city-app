# Vercel Migration Summary

## ✅ Completed Changes

### 1. New Vercel API Routes Created

All routes are in the `/api` directory:

- ✅ `api/health.ts` - Health check endpoint
- ✅ `api/push.ts` - Push notification endpoint (supports single token and batch tokens)
- ✅ `api/paystack/initialize.ts` - Paystack transaction initialization
- ✅ `api/paystack/verify.ts` - Paystack transaction verification
- ✅ `api/paystack/webhook.ts` - Paystack webhook handler with signature verification

### 2. App Code Updates

- ✅ `src/lib/apiBase.ts` - New helper for API URL management
- ✅ `src/lib/pushSender.ts` - Updated to use `/api/push` and `apiBase` helper
- ✅ `src/services/payments.ts` - Updated to use `/api/paystack/*` routes and `apiBase` helper

### 3. Configuration Files

- ✅ `vercel.json` - Vercel configuration for serverless functions
- ✅ `api/package.json` - Dependencies for Vercel API routes
- ✅ `eas.json` - Updated Railway URL placeholder to Vercel

### 4. Documentation

- ✅ `api/README.md` - API documentation
- ✅ `MIGRATION_TO_VERCEL.md` - Migration guide

## 📋 Testing Checklist

### Pre-Deployment

- [ ] Install Vercel CLI: `npm i -g vercel`
- [ ] Set up Vercel project (via CLI or dashboard)
- [ ] Configure environment variables in Vercel:
  - [ ] `ADMIN_SECRET` (optional)
  - [ ] `PAYSTACK_SECRET_KEY` (required)
  - [ ] `CLIENT_APP_URL` (optional)
  - [ ] `FIREBASE_SERVICE_ACCOUNT_JSON` (optional, for webhook Firestore writes)

### Deployment

- [ ] Deploy to Vercel: `vercel` or connect GitHub repo
- [ ] Note your Vercel deployment URL (e.g., `https://your-app.vercel.app`)

### Post-Deployment Testing

1. **Health Check**
   ```bash
   curl https://your-app.vercel.app/api/health
   ```
   Expected: `{ "ok": true, "service": "vercel-backend", "timestamp": "..." }`

2. **Push Notification (Single)**
   - Open Admin screen in app
   - Load a user token
   - Send a test notification
   - Verify: Success message, receipt/ticket in response

3. **Push Notification (Batch)**
   - In Admin screen, switch to "All Users" mode
   - Send notification to all users
   - Verify: Success count matches users with tokens

4. **Paystack Initialize**
   - Create a booking in the app
   - Complete payment flow
   - Verify: `authorization_url` is returned and opens Paystack checkout

5. **Paystack Verify**
   - After completing a test payment, verify the transaction
   - Verify: Status, amount, and reference are returned correctly

6. **Paystack Webhook**
   - Complete a test payment
   - Check Vercel function logs for webhook event
   - Verify: Transaction saved to Firestore (if Firebase Admin configured)
   - Verify: Booking status updated to "completed" (if payment successful)

### App Configuration

- [ ] Update `EXPO_PUBLIC_API_URL` in EAS secrets:
  ```bash
  eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value "https://your-app.vercel.app" --type string
  ```
  Or update existing:
  ```bash
  eas secret:update --name EXPO_PUBLIC_API_URL --value "https://your-app.vercel.app"
  ```

- [ ] Update Paystack webhook URL in Paystack dashboard:
  ```
  https://your-app.vercel.app/api/paystack/webhook
  ```

- [ ] Rebuild app with new environment variable:
  ```bash
  eas build --platform ios --profile production
  eas build --platform android --profile production
  ```

## 🔄 Endpoint Mapping

| Old (Railway) | New (Vercel) | Status |
|---------------|--------------|--------|
| `POST /push` | `POST /api/push` | ✅ Updated |
| `POST /api/payments/initialize` | `POST /api/paystack/initialize` | ✅ Updated |
| `GET /api/payments/verify` | `GET /api/paystack/verify` | ✅ Updated |
| `POST /api/payments/webhook` | `POST /api/paystack/webhook` | ✅ Created |

## 📝 Notes

- Firebase Functions (`functions/src/index.ts`) remain unchanged - they call Expo Push API directly
- The old Railway backend (`railway-push-server/`) can be kept for reference but is no longer used
- All API calls now use the centralized `apiBase.ts` helper for consistency
- Webhook signature verification reconstructs the raw body from parsed JSON (should work, but if issues occur, may need Vercel bodyParser configuration)

## 🚨 Important

1. **Environment Variables**: Make sure all required env vars are set in Vercel before testing
2. **Webhook Signature**: If webhook signature verification fails, the JSON stringification approach may need adjustment
3. **Firebase Admin**: Webhook Firestore writes are optional - if not configured, webhook will still return 200 but won't write to Firestore
4. **CORS**: Vercel functions should handle CORS automatically, but verify if you encounter issues

## 🆘 Troubleshooting

### Push notifications not working
- Check `EXPO_PUBLIC_API_URL` is set correctly
- Verify Vercel function logs for errors
- Check Expo push token format

### Paystack initialize fails
- Verify `PAYSTACK_SECRET_KEY` is set in Vercel
- Check Vercel function logs
- Verify request format matches expected schema

### Webhook signature verification fails
- Check that `PAYSTACK_SECRET_KEY` matches Paystack dashboard
- Verify webhook URL in Paystack dashboard matches Vercel deployment
- Check Vercel function logs for signature comparison

