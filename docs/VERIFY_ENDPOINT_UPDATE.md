# Verify Endpoint Update

## Changes Made

Updated the payment verification to better handle responses and provide clearer debugging information.

### 1. Endpoint Changed

**Before:**
```
POST /verify
Body: { bookingId, reference }
```

**After:**
```
POST /api/paystack/verify
Body: { bookingId }
```

### 2. Enhanced Response Handling

**Key Improvements:**
- Read response as text first (prevents JSON parse errors)
- Log raw response for debugging
- Gracefully handle non-JSON responses
- Preserve original error messages

**Implementation:**
```typescript
export async function verifyBookingPaymentWithBackend(bookingId: string) {
  const base = (process.env.EXPO_PUBLIC_API_URL || "").replace(/\/$/, "");
  const url = `${base}/api/paystack/verify`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookingId }),
  });

  // Read as text first
  const text = await res.text();

  // 👇 THIS WILL TELL US EXACTLY WHAT IS COMING BACK
  console.log("[Verify] status:", res.status);
  console.log("[Verify] raw:", text.slice(0, 200));

  // Parse safely
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(`Verify returned non-JSON (status ${res.status}): ${text.slice(0, 120)}`);
  }

  if (!res.ok || json?.ok === false) {
    throw new Error(json?.error || `Verify failed (status ${res.status})`);
  }

  return json; // { ok:true, paid:true/false, ... }
}
```

### 3. Simplified Function Signature

**Before:**
```typescript
verifyBookingPayment(bookingId: string, reference: string, throwOnError?: boolean)
```

**After:**
```typescript
verifyBookingPayment(bookingId: string, throwOnError?: boolean)
```

The `reference` parameter is no longer needed since the backend only requires `bookingId`.

### 4. Updated All Calls

**File: `src/screens/customer/my-bookings/my-bookings-screen.tsx`**

**Before:**
```typescript
verifyBookingPayment(booking.id, booking.payment.reference!, false)
```

**After:**
```typescript
verifyBookingPayment(booking.id, false)
```

## Console Output

When verification runs, you'll now see:

```
============================================================
[Verify] 📍 PAYMENT VERIFICATION REQUEST
[Verify] Base URL: https://clean-city-backend-plum.vercel.app
[Verify] Full URL: https://clean-city-backend-plum.vercel.app/api/paystack/verify
[Verify] Expected path: /api/paystack/verify
[Verify] Request body: { bookingId: "abc123" }
============================================================
[Verify] status: 200
[Verify] raw: {"ok":true,"paid":true,"status":"success"}
[Verify] Parsed JSON: { ok: true, paid: true, status: "success" }
[Verify] ✅ Success - paid: true
```

If backend returns non-JSON:
```
[Verify] status: 500
[Verify] raw: Internal Server Error
[Verify] ❌ Failed to parse JSON: SyntaxError...
Error: Verify returned non-JSON (status 500): Internal Server Error
```

## Benefits

✅ **Better debugging** - See exact response from backend
✅ **No crashes** - Handles non-JSON responses gracefully
✅ **Clear errors** - Shows status code and response content
✅ **Simpler API** - Removed unused `reference` parameter
✅ **Correct endpoint** - Now calls `/api/paystack/verify`

## Backend Expected Response

Your backend at `/api/paystack/verify` should return:

```json
{
  "ok": true,
  "paid": true,
  "status": "success"
}
```

Or for unpaid:
```json
{
  "ok": true,
  "paid": false,
  "status": "pending"
}
```

Or for errors:
```json
{
  "ok": false,
  "error": "Booking not found"
}
```

## Testing

1. Make a payment
2. Open My Bookings
3. Check console for verify logs
4. Should see:
   - Full URL being called
   - Raw response text
   - Parsed JSON
   - Success/error message

This will help diagnose any issues with the verify endpoint!
