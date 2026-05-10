# Payment Email Fallback Fix

## Issue

Paystack payment initialization was failing because it couldn't find a valid user email. The backend was only checking Firebase Auth for the user's email, which might not be populated for all users.

## Solution

Implemented a multi-tier email lookup strategy with fallback:

1. **Primary**: Check Firebase Auth for user email (via `admin.auth().getUser(userId)`)
2. **Fallback**: Use `booking.userEmail` if stored in the booking document
3. **Error Handling**: Return clear error message if neither source has an email

## Changes Made

### 1. Backend - Vercel Functions

#### `api/paystack/bookings.ts`
- Updated `BookingData` interface to include optional `userEmail` field
- Modified `getUserEmail()` function to accept `booking` parameter
- Added fallback logic to use `booking.userEmail` if Firebase Auth email is unavailable
- Added comprehensive logging to debug email retrieval

#### `api/paystack/initialize.ts`
- Updated to pass `booking` object to `getUserEmail()`
- Added detailed logging for each step of the initialization process
- Enhanced error message when email is not found
- Logs checked sources (Firebase Auth and booking.userEmail)

### 2. Backend - Express (for reference)

Applied same changes to Express backend in `backend/src/payments/`:
- `bookings.repository.ts`: Updated `BookingData` interface
- `users.repository.ts`: Updated `getUserEmail()` with fallback logic
- `payments.routes.ts`: Pass booking to `getUserEmail()`, added logging

### 3. Mobile App

#### `src/types/booking.ts`
- Added optional `userEmail?: string` field to `Booking` type

#### `src/services/booking-service.ts`
- Updated `CreateBookingParams` to include optional `userEmail` field
- Modified `createBooking()` to store `userEmail` if provided
- Updated `getUserBookings()` and `getBookingById()` to include `userEmail` in returned data

#### `src/screens/customer/create-booking/create-booking-screen.tsx`
- Updated to pass `userEmail: user.email` when creating a booking
- Ensures new bookings have email stored for payment processing

## Email Lookup Flow

```
1. Backend receives: { bookingId }
2. Fetch booking from Firestore
3. Try to get email:
   ├─ Check Firebase Auth for userId
   │  ├─ ✅ Email found → Use it
   │  └─ ❌ Not found → Try fallback
   └─ Check booking.userEmail
      ├─ ✅ Email found → Use it
      └─ ❌ Not found → Return error
4. If email found, initialize Paystack
5. Return: { ok: true, authorizationUrl, reference }
```

## Benefits

1. **Backwards Compatible**: Works with existing bookings that don't have `userEmail`
2. **Forward Compatible**: New bookings store email for reliable payment processing
3. **Resilient**: Multiple fallback sources prevent payment failures
4. **Debuggable**: Comprehensive logging helps diagnose email issues
5. **Clear Errors**: Users get helpful error messages if email is missing

## Error Messages

### When Email Not Found
```json
{
  "ok": false,
  "error": "User email not found. Please ensure the user has an email address in their profile.",
  "details": "Email is required by Paystack to process payments."
}
```

### Backend Logs (for debugging)
```
[Backend Init] Looking up booking: booking123
[Backend Init] ✅ Booking found. UserId: user456 TotalPrice: 50.00
[Backend Init] Looking up user email for userId: user456
Fetching email from Firebase Auth for userId: user456
Found email in Firebase Auth: user@example.com
[Backend Init] ✅ Email found: user@example.com
[Backend Init] 🚀 Calling Paystack API...
```

## Testing Checklist

### New Bookings (with email)
- [ ] Create new booking with email populated
- [ ] Verify `userEmail` is stored in booking document
- [ ] Initiate payment - should succeed
- [ ] Check logs - should show email from booking fallback

### Legacy Bookings (without email)
- [ ] Test payment on old booking without `userEmail` field
- [ ] Should fall back to Firebase Auth
- [ ] If Firebase Auth has email, payment succeeds
- [ ] If Firebase Auth missing email, should get clear error

### Error Cases
- [ ] User with no email in Firebase Auth or booking
- [ ] Should return clear error message
- [ ] Should log all checked sources

## Migration Notes

- **Existing bookings**: Will use Firebase Auth email (if available)
- **New bookings**: Will store email at creation time for reliable payments
- **No data migration needed**: System handles both old and new booking formats

## Deployment

The Vercel backend will automatically pick up these changes on next deployment. No additional environment variables or configuration needed.
