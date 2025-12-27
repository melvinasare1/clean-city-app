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

## Local Development

```bash
npm install
npm start
```

Server will run on `http://localhost:3000`

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

