# Phase 2: Payment Verification & Webhook Integration

## Overview

This phase addresses critical UX issues from Phase 1 by implementing automatic payment verification, webhook integration, and preventing users from attempting to pay for already-paid bookings.

## Problems Solved

### Issue 1: Users Could Retry Payment on Already-Paid Bookings
**Problem:** After completing payment on Paystack, users could still click "Continue payment" and get an error from Paystack saying the booking was already paid. This caused confusion and made users think there was an issue with every payment.

**Solution:** 
- Added payment verification before allowing retry
- Automatic verification of pending payments when viewing bookings
- Clear UI indicators for payment status

### Issue 2: Payment Status Not Updated Automatically
**Problem:** Webhooks were updating `booking.status` instead of `booking.payment.status`, so payments remained marked as "initiated" even after successful completion.

**Solution:**
- Updated webhook handlers to properly update `booking.payment.status` to "paid"
- Implemented both Vercel and Backend webhook handlers
- Added automatic payment verification on screen focus

### Issue 3: No Feedback Loop for Completed Payments
**Problem:** Users had no way to know if their payment was successful without manually checking or contacting support.

**Solution:**
- Added clear payment status badges (✓ PAYMENT COMPLETED, ⚠ PAYMENT PENDING, ❌ PAYMENT REQUIRED)
- Automatic payment verification when viewing bookings
- Prevents duplicate payment attempts

## Implementation Details

### 1. Webhook Updates

#### Updated Files:
- `api/paystack/webhook.ts` (Vercel webhook handler)
- `backend/src/payments/transactions.repository.ts` (Backend webhook handler)

**Key Changes:**
```typescript
// Before (incorrect):
await firestore
  .collection('bookings')
  .doc(metadata.bookingId)
  .set({ status: 'completed' }, { merge: true });

// After (correct):
await firestore
  .collection('bookings')
  .doc(metadata.bookingId)
  .set({ payment: { status: 'paid' } }, { merge: true });
```

**How It Works:**
1. User completes payment on Paystack
2. Paystack sends webhook to `/api/paystack/webhook`
3. Webhook validates signature
4. Updates transaction in `transactions` collection
5. If payment successful, updates booking's `payment.status` to "paid"

### 2. Payment Verification Function

#### Added to: `src/services/booking-service.ts`

**New Function: `verifyBookingPayment(bookingId: string)`**

```typescript
export const verifyBookingPayment = async (bookingId: string): Promise<boolean> => {
  const booking = await getBookingById(bookingId);
  
  // If already marked as paid, no need to verify
  if (booking.payment.status === "paid") {
    return true;
  }

  // If no reference, payment hasn't been initiated
  if (!booking.payment.reference) {
    return false;
  }

  try {
    // Verify payment with Paystack
    const verifyResult = await verifyPayment(booking.payment.reference);
    
    if (verifyResult.status === "success") {
      // Mark booking as paid
      await markBookingAsPaid(bookingId);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error("Error verifying booking payment:", error);
    return false;
  }
};
```

**Features:**
- Checks if booking is already marked as paid (avoids unnecessary API calls)
- Verifies payment with Paystack API
- Updates booking if payment is successful
- Returns boolean indicating payment status
- Error-safe (doesn't throw, returns false on error)

### 3. Automatic Payment Verification on Screen Focus

#### Updated: `src/screens/customer/my-bookings/my-bookings-screen.tsx`

**Enhancement to `fetchBookings()` function:**

```typescript
const fetchBookings = useCallback(async () => {
    // ... fetch bookings ...
    
    // Automatically verify payments for bookings with "initiated" status
    const verificationPromises = data
        .filter(booking => booking.payment.status === "initiated" && booking.payment.reference)
        .map(booking => verifyBookingPayment(booking.id));
    
    if (verificationPromises.length > 0) {
        console.log(`Verifying ${verificationPromises.length} pending payments...`);
        await Promise.all(verificationPromises);
        // Refetch bookings to get updated payment statuses
        const updatedData = await getUserBookings(user.id);
        setBookings(updatedData);
    }
}, [user?.id]);
```

**How It Works:**
1. User navigates to My Bookings screen
2. Bookings are fetched from Firestore
3. System identifies bookings with "initiated" payment status
4. Automatically verifies each initiated payment with Paystack
5. Updates bookings that are found to be paid
6. Refetches bookings to show updated statuses
7. User sees accurate payment status without manual action

### 4. Pre-Payment Verification

#### Updated: `handleContinuePayment()` in My Bookings screen

**Before allowing payment retry:**

```typescript
const handleContinuePayment = useCallback(async (booking: Booking) => {
    // First, verify if payment is already completed
    const isAlreadyPaid = await verifyBookingPayment(booking.id);
    
    if (isAlreadyPaid) {
        Alert.alert(
            'Payment completed',
            'This booking has already been paid for. The page will refresh to show the updated status.',
            [{ text: 'OK', onPress: () => fetchBookings() }]
        );
        return;
    }

    // Continue with payment flow...
}, [user?.email, fetchBookings]);
```

**Benefits:**
- Prevents users from seeing Paystack error pages
- Provides clear feedback about payment status
- Automatically refreshes to show updated status
- Improves user confidence in the payment system

### 5. Enhanced UI for Payment Status

#### Visual Indicators:

**Paid Bookings:**
```
✓ PAYMENT COMPLETED (Green badge)
```

**Pending Payments:**
```
⚠ PAYMENT PENDING (Orange badge)
+ "Continue payment" button
```

**Unpaid Bookings:**
```
❌ PAYMENT REQUIRED (Red badge)
+ "Continue payment" button
```

## Complete Payment Flow

### Scenario 1: Successful Payment
1. User creates booking → `payment: { status: "unpaid" }`
2. Payment initialized → `payment: { status: "initiated", reference: "CC_xxx", authorizationUrl: "..." }`
3. User completes payment on Paystack → Paystack sends webhook
4. Webhook handler updates → `payment: { status: "paid" }`
5. User returns to app → Sees "✓ PAYMENT COMPLETED"
6. No "Continue payment" button shown

### Scenario 2: Abandoned Payment (Auto-Recovery)
1. User creates booking and starts payment
2. User closes Paystack page without completing
3. Booking remains with `payment: { status: "initiated" }`
4. User returns to My Bookings later
5. System auto-verifies → Checks Paystack API
6. If payment actually completed:
   - Updates booking to "paid"
   - Shows "✓ PAYMENT COMPLETED"
7. If payment not completed:
   - Shows "⚠ PAYMENT PENDING"
   - User can click "Continue payment"

### Scenario 3: Prevented Duplicate Payment
1. User completed payment successfully
2. Webhook hasn't fired yet or failed
3. User clicks "Continue payment"
4. System verifies payment status first
5. Finds payment is already completed
6. Shows alert: "This booking has already been paid for"
7. Refreshes screen to show updated status
8. User never sees Paystack error

### Scenario 4: Failed Payment Retry
1. User's payment failed or was declined
2. System keeps booking with `payment: { status: "initiated" }`
3. User returns to My Bookings
4. Auto-verification checks status (still not paid)
5. Shows "⚠ PAYMENT PENDING" 
6. User clicks "Continue payment"
7. System verifies (still not paid)
8. Opens new payment session with Paystack
9. User can complete payment

## Webhook Setup

### Paystack Webhook Configuration

1. **Go to Paystack Dashboard**
   - Navigate to Settings → Webhooks

2. **Add Webhook URL**
   - Production: `https://your-domain.com/api/paystack/webhook`
   - Development: Use ngrok or similar to expose local endpoint

3. **Events to Listen For**
   - `charge.success` - Payment completed successfully
   - `charge.failed` - Payment failed
   - `charge.abandoned` - Payment was abandoned

4. **Test Webhook**
   - Use Paystack's webhook testing tool
   - Check server logs to verify receipt
   - Verify booking payment status updates

### Webhook Security

**Signature Verification:**
```typescript
const hash = crypto
  .createHmac('sha512', PAYSTACK_SECRET_KEY)
  .update(rawBody)
  .digest('hex');

if (hash !== signature) {
  return res.status(400).json({ error: 'Invalid signature' });
}
```

**Features:**
- Validates all incoming webhooks
- Rejects requests with invalid signatures
- Prevents unauthorized payment status updates
- Logs all webhook events for debugging

## Error Handling

### Graceful Degradation

**If Webhook Fails:**
- Payment verification on screen focus acts as fallback
- User can manually trigger verification by clicking "Continue payment"
- System never shows incorrect payment status

**If Verification API Fails:**
- Doesn't crash the app
- Logs error for debugging
- Shows last known payment status
- User can retry later

**If Payment Reference Missing:**
- Treats as "unpaid"
- Allows user to initialize new payment
- No confusion or error messages

## Testing Checklist

### Test Case 1: Successful Payment Flow
- [ ] Create booking
- [ ] Complete payment on Paystack
- [ ] Wait for webhook (should be instant)
- [ ] Navigate to My Bookings
- [ ] Verify "✓ PAYMENT COMPLETED" shows
- [ ] Verify no "Continue payment" button

### Test Case 2: Abandoned Payment Recovery
- [ ] Create booking
- [ ] Start payment but close Paystack page
- [ ] Navigate to My Bookings
- [ ] Verify auto-verification runs
- [ ] If payment actually completed, status updates
- [ ] If not, "⚠ PAYMENT PENDING" shows

### Test Case 3: Prevented Duplicate Payment
- [ ] Complete payment successfully
- [ ] Before webhook fires, click "Continue payment"
- [ ] Verify alert: "This booking has already been paid for"
- [ ] Verify page refreshes
- [ ] Verify updated status shows

### Test Case 4: Payment Retry
- [ ] Create booking with failed payment
- [ ] Navigate to My Bookings
- [ ] Click "Continue payment"
- [ ] System verifies (not paid)
- [ ] Paystack page opens
- [ ] Complete payment
- [ ] Return to app
- [ ] Verify status updates

### Test Case 5: Webhook Processing
- [ ] Complete payment on Paystack
- [ ] Check server logs for webhook receipt
- [ ] Verify transaction saved to `transactions` collection
- [ ] Verify booking updated in `bookings` collection
- [ ] Verify `payment.status` changed to "paid"

## Monitoring & Debugging

### Key Logs to Watch

**Webhook Received:**
```
Paystack webhook event: charge.success { reference: 'CC_xxx', status: 'success' }
Updated booking xxx payment status to paid
```

**Auto-Verification:**
```
Verifying 2 pending payments...
Verified payment for booking xxx: paid
```

**Manual Verification:**
```
Verifying payment status for booking: xxx
Payment completed - refreshing booking list
```

### Common Issues

**Issue: Webhook not firing**
- Check Paystack dashboard for webhook failures
- Verify webhook URL is correct and accessible
- Check for signature validation errors

**Issue: Payment shows as pending but actually completed**
- Verify webhook is updating `payment.status`, not `status`
- Check if webhook URL is correctly configured
- Manual verification should catch this on screen focus

**Issue: User can still click "Continue payment" on paid booking**
- Check if `verifyBookingPayment` is being called
- Verify payment status in Firestore
- Check console logs for verification results

## Files Modified

1. `api/paystack/webhook.ts` - Fixed webhook to update payment.status
2. `backend/src/payments/transactions.repository.ts` - Fixed transaction handler
3. `src/services/booking-service.ts` - Added verifyBookingPayment function
4. `src/screens/customer/my-bookings/my-bookings-screen.tsx` - Added auto-verification and UI improvements

## Summary

✅ **Webhooks properly update payment status**
✅ **Automatic payment verification on screen focus**
✅ **Pre-payment verification prevents duplicate attempts**
✅ **Clear UI indicators for payment status**
✅ **Error-safe implementation with graceful degradation**
✅ **Improved user confidence in payment system**
✅ **MVP-ready payment flow with good UX**

This implementation ensures users have a smooth payment experience without confusion, duplicate attempts, or error screens. The combination of webhooks and automatic verification provides redundancy and reliability.
