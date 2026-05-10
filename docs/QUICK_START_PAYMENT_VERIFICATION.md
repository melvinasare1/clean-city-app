# Quick Start: Payment Verification Setup

## What Was Fixed

✅ Users can no longer be prompted to pay for already-paid bookings
✅ App verifies payment status with your backend before showing payment CTAs
✅ "Continue Payment" button hidden for paid bookings
✅ Clear "✓ PAID" badge shown for completed payments

## Configuration Required

### 1. Backend URL

Check your `.env` file has the correct backend URL:

```bash
EXPO_PUBLIC_API_URL=https://clean-city-backend-plum.vercel.app/
```

**Important:** This should point to your **separate Paystack backend**, not the web app.

### 2. Backend Endpoint

Your backend must have this endpoint:

```
POST /verify
Body: { bookingId: string, reference: string }
Response: { ok: boolean, paid: boolean }
```

Example backend response:
```json
{
  "ok": true,
  "paid": true,
  "status": "success",
  "message": "Payment verified"
}
```

## How It Works

### On My Bookings Screen Load
1. Fetches bookings from Firestore
2. Finds bookings with `payment.reference` but not marked as paid
3. Shows "Checking payment status..." indicator
4. Calls `POST /verify` for each booking
5. If backend returns `paid: true`:
   - Updates Firestore: `payment.status = "paid"`, `payment.paidAt = timestamp`
   - Refreshes UI to show "✓ PAID" badge
   - Hides "Continue Payment" button

### When User Clicks "Continue Payment"
1. **First**, verifies payment status with backend
2. If backend says already paid:
   - Shows alert: "Already Paid ✅"
   - Does NOT open Paystack
   - Refreshes booking list
3. If not paid:
   - Opens Paystack authorization URL
   - User can complete payment

## Testing

### Test Already Paid Booking
1. Complete a payment on Paystack
2. Open My Bookings
3. Should see "Checking payment status..." briefly
4. Status updates to "✓ PAID"
5. No "Continue Payment" button

### Test Trying to Repay
1. On a paid booking, click "Continue Payment" (if somehow visible)
2. Should see: "Already Paid ✅"
3. Paystack should NOT open
4. Booking list refreshes

### Check Console Logs
Open React Native debugger and look for:
```
[Auto-verify] Found X bookings with references, verifying...
[Verify] Calling backend verify endpoint: https://...
[Verify] Response: { ok: true, paid: true }
[Verify Booking] ✅ Booking abc123 marked as paid
```

## Troubleshooting

### "Connection Error" When Verifying
- Check internet connection
- Verify `EXPO_PUBLIC_API_URL` is correct
- Check backend is running and accessible

### Payment Still Shows as Unpaid
- Check console logs for verification response
- Verify backend returns `{ ok: true, paid: true }`
- Check Firestore update didn't fail

### "Continue Payment" Button Still Shows After Payment
- Verify backend `/verify` endpoint is returning correct response
- Check console logs: `[Verify] Response: ...`
- Try pulling down to refresh bookings list

## Files Modified (App Only)

1. `src/services/payments.ts` - Added `verifyBookingPaymentWithBackend()`
2. `src/services/booking-service.ts` - Updated `verifyBookingPayment()` to call backend
3. `src/screens/customer/my-bookings/my-bookings-screen.tsx` - Added auto-verify and updated UI
4. `src/types/booking.ts` - Added `paidAt` field

**No backend files were modified.**

## Summary

The app now:
- ✅ Calls your separate backend to verify payments
- ✅ Updates Firestore when payments are confirmed
- ✅ Shows clear "✓ PAID" status for paid bookings
- ✅ Hides payment CTAs for already-paid bookings
- ✅ Prevents users from seeing Paystack errors
- ✅ Provides comprehensive logging for debugging

**Result:** Professional UX with no confusion for users!
