# Railway Push Notification Server

Simple Express server to send push notifications via Expo Push Service.

## Deployment to Railway

1. **Create a new Railway project:**
   - Go to [Railway](https://railway.app)
   - Create a new project
   - Connect your GitHub repo or deploy from this directory

2. **Deploy:**
   - Railway will auto-detect Node.js
   - Set the start command: `node server.js`
   - Railway will automatically set the `PORT` environment variable

3. **Test the deployment:**
   ```bash
   curl https://your-railway-url.railway.app/health
   ```

## API Endpoints

### POST /push

Send a push notification to a single device.

**Request:**
```json
{
  "to": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "title": "Hello",
  "body": "This is a test notification",
  "data": {
    "screen": "home",
    "campaign": "test"
  }
}
```

**Response:**
```json
{
  "success": true,
  "receipt": {
    "status": "ok"
  },
  "message": "Notification sent successfully"
}
```

### POST /push/batch

Send push notifications to multiple devices.

**Request:**
```json
{
  "tokens": [
    "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
    "ExponentPushToken[yyyyyyyyyyyyyyyyyyyyyy]"
  ],
  "title": "Hello",
  "body": "This is a batch notification",
  "data": {
    "screen": "home"
  }
}
```

### POST /cron/daily-reminders

Send daily reminder notifications to all users with reminders enabled at the current time.

**Headers:**
- `X-CRON-SECRET`: Your cron secret (set via `CRON_SECRET` environment variable)

**Note:** This endpoint requires Firebase Admin SDK to read from Firestore. See "Daily Reminders Setup" below.

**Response:**
```json
{
  "success": true,
  "message": "Processed 5 reminder(s)",
  "count": 5,
  "stats": {
    "sent": 5,
    "failed": 0,
    "noToken": 2,
    "errors": []
  },
  "time": "9:00"
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "ok": true,
  "service": "push-notification-server",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Environment Variables

- `PORT` - Server port (default: 3000, Railway sets this automatically)
- `CRON_SECRET` - Secret for authenticating cron requests (required for `/cron/daily-reminders`)
- `FIREBASE_SERVICE_ACCOUNT_JSON` - Firebase service account JSON as a string (optional, for daily reminders)
- `GOOGLE_APPLICATION_CREDENTIALS` - Path to Firebase service account JSON file (optional, alternative to above)

## Daily Reminders Setup

The `/cron/daily-reminders` endpoint requires Firebase Admin SDK to read user reminder settings from Firestore.

### 1. Get Firebase Service Account

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to Project Settings → Service Accounts
4. Click "Generate New Private Key"
5. Download the JSON file

### 2. Configure on Railway

**Option A: Environment Variable (Recommended)**
- In Railway, add environment variable `FIREBASE_SERVICE_ACCOUNT_JSON`
- Paste the entire JSON file content as the value

**Option B: File Upload**
- Upload the JSON file to Railway
- Set `GOOGLE_APPLICATION_CREDENTIALS` to the file path

### 3. Set Cron Secret

- Add `CRON_SECRET` environment variable in Railway
- Use a strong random string (e.g., generate with `openssl rand -hex 32`)

### 4. Schedule Cron Job

Use an external cron service (e.g., [cron-job.org](https://cron-job.org), [EasyCron](https://www.easycron.com)) to call:

```
POST https://your-railway-url.railway.app/cron/daily-reminders
Headers:
  X-CRON-SECRET: <your-cron-secret>
```

**Recommended schedule:** Every hour at minute 0 (e.g., `0 * * * *`)

This will check for users with reminders at the current hour/minute and send notifications.

## Local Development

```bash
npm install
npm start
```

Server will run on `http://localhost:3000`

For local testing with daily reminders:
1. Set `CRON_SECRET` environment variable
2. Set `FIREBASE_SERVICE_ACCOUNT_JSON` or `GOOGLE_APPLICATION_CREDENTIALS`
3. Test the endpoint:
   ```bash
   curl -X POST http://localhost:3000/cron/daily-reminders \
     -H "X-CRON-SECRET: your-secret"
   ```

## Usage Example

```javascript
// From your backend or a script
const response = await fetch('https://your-railway-url.railway.app/push', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    to: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
    title: 'New Booking',
    body: 'You have a new booking request',
    data: {
      screen: 'bookings',
      bookingId: '123'
    }
  })
});

const result = await response.json();
console.log(result);
```

