# Firebase Cloud Functions

Firestore-triggered push notifications for CleanCityApp.

## Quick Start

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Deploy to Firebase
npm run deploy
```

## Functions

### `onJobAssigned`
- **Trigger:** `jobs/{jobId}` document update
- **Condition:** `assignedWorkerId` changes from null to a UID
- **Action:** Sends push notification to assigned worker

### `onBookingConfirmed`
- **Trigger:** `bookings/{bookingId}` document update
- **Condition:** `status` changes to `"confirmed"`
- **Action:** Sends push notification to customer

## Development

```bash
# Watch mode (rebuild on changes)
npm run build -- --watch

# View logs
firebase functions:log

# Test locally (requires Firebase Emulator)
npm run serve
```

## Dependencies

- `firebase-admin` - Firebase Admin SDK
- `firebase-functions` - Firebase Cloud Functions SDK

## Notes

- Functions use Node.js 18
- Push tokens are stored in `profiles/{uid}.expoPushToken`
- Notifications respect `notificationPreferences.enabled` if present

