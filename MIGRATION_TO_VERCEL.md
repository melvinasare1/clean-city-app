# Migration from Railway to Vercel

This document outlines the migration from Railway backend to Vercel serverless functions.

## Changes Made

### 1. New Vercel API Routes
- `/api/health` - Health check endpoint
- `/api/push` - Push notification endpoint (replaces `/push`)
- `/api/paystack/initialize` - Paystack initialization (replaces `/api/payments/initialize`)
- `/api/paystack/verify` - Paystack verification (replaces `/api/payments/verify`)
- `/api/paystack/webhook` - Paystack webhook handler

### 2. App Code Updates
- Created `src/lib/apiBase.ts` - Centralized API URL helper
- Updated `src/lib/pushSender.ts` - Now uses `/api/push` and `apiBase` helper
- Updated `src/services/payments.ts` - Now uses `/api/paystack/*` routes and `apiBase` helper

### 3. Endpoint Changes
| Old (Railway) | New (Vercel) |
|---------------|--------------|
| `POST /push` | `POST /api/push` |
| `POST /api/payments/initialize` | `POST /api/paystack/initialize` |
| `GET /api/payments/verify` | `GET /api/paystack/verify` |

## Setup Instructions

### 1. Deploy to Vercel

1. Install Vercel CLI (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. Deploy from project root:
   ```bash
   vercel
   ```

3. Or connect your GitHub repository to Vercel dashboard for automatic deployments.

### 2. Set Environment Variables in Vercel

In your Vercel project settings, add:

- `ADMIN_SECRET` (optional): Secret for push notification authentication
- `PAYSTACK_SECRET_KEY`: Your Paystack secret key
- `CLIENT_APP_URL` (optional): Default callback URL (defaults to `http://localhost:19006`)
- `FIREBASE_SERVICE_ACCOUNT_JSON` (optional): Firebase Admin service account JSON as a string (for webhook Firestore writes)

### 3. Update Expo App Configuration

1. Get your Vercel deployment URL (e.g., `https://your-app.vercel.app`)

2. Update EAS secrets:
   ```bash
   eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value "https://your-app.vercel.app" --type string
   ```

3. Or update `eas.json` directly (for development builds):
   ```json
   {
     "build": {
       "development": {
         "env": {
           "EXPO_PUBLIC_API_URL": "https://your-app.vercel.app"
         }
       }
     }
   }
   ```

### 4. Update Paystack Webhook URL

In your Paystack dashboard, update the webhook URL to:
```
https://your-app.vercel.app/api/paystack/webhook
```

## Testing Checklist

- [ ] `GET /api/health` returns `{ ok: true, service: "vercel-backend" }`
- [ ] Send a single push from Admin screen; confirm tickets + receipts show ok
- [ ] Paystack initialize returns `authorization_url`
- [ ] Verify endpoint returns success for a test reference
- [ ] Webhook endpoint accepts Paystack events (check Vercel logs)
- [ ] Update Expo EAS env var and rebuild TestFlight

## Notes

- Firebase Functions (`functions/src/index.ts`) remain unchanged - they call Expo Push API directly
- The old Railway backend (`railway-push-server/`) can be kept for reference but is no longer used
- All API calls now use the centralized `apiBase.ts` helper for consistency

