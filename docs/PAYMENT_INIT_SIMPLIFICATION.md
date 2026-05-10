# Payment Initialization Simplification

## Summary

Simplified the mobile Paystack payment initialization to send only `bookingId` to the backend. The backend now handles all payment details lookup including booking information and user email.

## Changes Made

### 1. Backend (Vercel Functions)

#### New Files
- **`api/paystack/bookings.ts`**: Helper functions to fetch booking and user data from Firebase
  - `getBookingById(bookingId)`: Fetches booking from Firestore
  - `getUserEmail(userId)`: Fetches user email from Firebase Auth

#### Modified Files
- **`api/paystack/initialize.ts`**: Updated payment initialization endpoint
  - **Before**: Accepted `{ email, amount, metadata }`
  - **After**: Accepts only `{ bookingId }`
  - Looks up booking details and user email automatically
  - Returns `{ ok: true, authorizationUrl, reference }` on success
  - Returns `{ ok: false, error: "..." }` on failure

- **`api/README.md`**: Updated API documentation to reflect new contract

### 2. Backend (Express - for reference)

Created equivalent implementations in the Express backend (in `backend/src/payments/`):
- `bookings.repository.ts`
- `users.repository.ts`
- Updated `payments.routes.ts` to accept only `{ bookingId }`

**Note**: The Express backend is not currently deployed. The Vercel serverless functions are the active backend.

### 3. Mobile App (React Native/Expo)

#### Modified Files
- **`src/services/payments.ts`**:
  - Updated `InitializePaymentRequest` interface to only require `bookingId`
  - Updated `InitializePaymentResponse` interface to include `ok: boolean`
  - Fixed endpoint URL to use `/api/paystack/initialize` (was incorrectly using `/api/payments/initialize`)
  - Removed client-side email and amount parameters

- **`src/services/booking-service.ts`**:
  - Updated `initiatePaymentForBooking()` function signature:
    - **Before**: `initiatePaymentForBooking(bookingId: string, userEmail: string)`
    - **After**: `initiatePaymentForBooking(bookingId: string)`
  - Removed client-side email validation
  - Simplified payment initialization call to only pass `bookingId`

- **`src/screens/customer/create-booking/create-booking-screen.tsx`**:
  - Removed `user.email` check before payment initialization
  - Updated function call to `initiatePaymentForBooking(bookingId)` (removed `userEmail` parameter)

- **`src/screens/customer/my-bookings/my-bookings-screen.tsx`**:
  - Updated function call to `initiatePaymentForBooking(bookingId)` (removed `userEmail` parameter)

## API Contract

### Request
```json
POST /api/paystack/initialize
{
  "bookingId": "booking123"
}
```

### Response (Success)
```json
{
  "ok": true,
  "authorizationUrl": "https://checkout.paystack.com/...",
  "reference": "ref_xyz123"
}
```

### Response (Error)
```json
{
  "ok": false,
  "error": "Booking not found"
}
```

## Benefits

1. **Simplified Client Code**: Mobile app no longer needs to:
   - Check for user email before initiating payment
   - Calculate or pass amount to backend
   - Build metadata object

2. **Improved Security**: 
   - User email comes from authenticated Firebase Auth (not client-provided)
   - Payment amount comes from trusted Firestore booking (not client-provided)
   - Prevents amount manipulation attacks

3. **Single Source of Truth**: 
   - All payment details derived from bookingId
   - No risk of mismatched amounts between client and server

4. **Better Error Handling**: 
   - Backend validates booking exists and isn't already paid
   - Backend validates user email exists
   - Consistent error response format with `ok: false`

## Flow

1. User clicks "Pay Now" on booking
2. Mobile app calls `initiatePaymentForBooking(bookingId)`
3. Mobile service calls `POST /api/paystack/initialize` with `{ bookingId }`
4. Backend:
   - Looks up booking in Firestore
   - Validates booking exists and isn't paid
   - Looks up user email from Firebase Auth
   - Calls Paystack API to initialize transaction
   - Returns `{ ok: true, authorizationUrl, reference }`
5. Mobile app opens `authorizationUrl` in browser
6. User completes payment on Paystack
7. Paystack webhook updates Firestore booking status
8. Mobile app Firestore listener detects payment status change
9. UI automatically updates to show "Paid" status

## Webhook + Firestore Listener

The payment verification flow relies on:
- **Paystack Webhook** (`/api/paystack/webhook`): Receives payment events and updates Firestore
- **Firestore Listener** (mobile app): Listens to booking document changes and updates UI
- **Verify Button** (fallback): Manual verification if webhook fails or is delayed

## Testing Checklist

- [ ] Create new booking and initiate payment
- [ ] Verify only `bookingId` is sent to backend (check network logs)
- [ ] Verify backend looks up booking and user email correctly
- [ ] Verify Paystack authorization URL opens correctly
- [ ] Complete payment on Paystack
- [ ] Verify webhook updates Firestore booking status to "paid"
- [ ] Verify mobile app UI updates automatically via Firestore listener
- [ ] Test error cases:
  - [ ] Invalid bookingId
  - [ ] Already paid booking
  - [ ] User without email
- [ ] Verify fallback "Verify Payment" button still works

## Migration Notes

- The endpoint URL was corrected from `/api/payments/initialize` to `/api/paystack/initialize`
- This aligns with the Vercel migration documented in `MIGRATION_TO_VERCEL.md`
- Client-side currency conversions and amount calculations have been removed
- All payment amounts are now calculated on the backend from the booking's `totalPrice`
