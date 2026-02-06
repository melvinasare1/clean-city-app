# Vercel Backend API Routes

This directory contains Vercel serverless functions for CleanCityApp.

## Endpoints

### `GET /api/health`
Health check endpoint.

**Response:**
```json
{
  "ok": true,
  "service": "vercel-backend",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### `POST /api/push`
Send push notifications via Expo Push Service.

**Request:**
```json
{
  "to": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "title": "Hello",
  "body": "This is a test notification",
  "data": {
    "screen": "home"
  }
}
```

Or batch mode:
```json
{
  "tokens": ["ExponentPushToken[...]", "ExponentPushToken[...]"],
  "title": "Hello",
  "body": "This is a batch notification",
  "data": {}
}
```

**Headers (optional):**
- `X-ADMIN-SECRET`: Admin secret for authentication (if `ADMIN_SECRET` env var is set)

**Response:**
```json
{
  "success": true,
  "receipt": {...},
  "ticket": {...},
  "message": "Notification sent successfully"
}
```

### `POST /api/paystack/initialize`
Initialize a Paystack transaction (simplified).

**Request:**
```json
{
  "bookingId": "booking456"
}
```

**Response:**
```json
{
  "ok": true,
  "authorizationUrl": "https://checkout.paystack.com/...",
  "reference": "..."
}
```

**Notes:**
- Backend looks up booking details and user email automatically
- Returns error with `ok: false` if booking not found or already paid

### `GET /api/paystack/verify?reference=...`
Verify a Paystack transaction.

**Response:**
```json
{
  "status": "success",
  "reference": "...",
  "amount": 100.50,
  "currency": "GHS",
  "statusMessage": "Successful",
  "metadata": {...},
  "rawPaystack": {...}
}
```

### `POST /api/paystack/webhook`
Paystack webhook endpoint for transaction events.

**Headers:**
- `x-paystack-signature`: Paystack webhook signature

**Note:** This endpoint validates the signature and optionally writes to Firestore if Firebase Admin is configured.

## Environment Variables

Set these in your Vercel project settings:

- `ADMIN_SECRET` (optional): Secret for `/api/push` authentication
- `PAYSTACK_SECRET_KEY`: Your Paystack secret key
- `CLIENT_APP_URL` (optional): Default callback URL for Paystack (defaults to `http://localhost:19006`)
- `FIREBASE_SERVICE_ACCOUNT_JSON` (optional): Firebase Admin service account JSON as a string, for webhook Firestore writes

## Deployment

1. Connect your repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy - Vercel will automatically detect and deploy the `/api` routes

## Migration from Railway

- Old endpoint: `POST /push` → New: `POST /api/push`
- Old endpoint: `POST /api/payments/initialize` → New: `POST /api/paystack/initialize`
- Old endpoint: `GET /api/payments/verify` → New: `GET /api/paystack/verify`

Update `EXPO_PUBLIC_API_URL` in your Expo app to point to your Vercel domain.

