## Referral System

This document describes the credits-based referral system implemented in the app.

It covers:

- Firestore data model
- Signup behaviour when a referral code is present
- Reward logic triggered after a user completes their first paid booking
- Key service functions and where they live

---

## Firestore Schema

### `profiles/{userId}`

Existing user profile documents are extended with referral-related fields (we **do not** change the core model shape or remove fields):

- `referralCode: string`  
  - Every user gets a unique referral code generated at signup.  
  - Format: `CC-${uid.slice(0, 6).toUpperCase()}` (e.g. `CC-1A2B3C`).

- `referredBy?: string | null`  
  - The referral code that this user used at signup, if any.  
  - `null` if they did not use a code or the code was not provided.

- `creditBalance: number`  
  - Total referral credits the user has earned as a referrer.  
  - Always initialised to `0` at signup.

- `referralRewarded: boolean`  
  - Indicates whether the referral reward for this user (as a *referred* user) has already been paid out to their referrer.  
  - Used to enforce one-time payouts and avoid duplicates.  
  - Always initialised to `false` at signup.

> Note: these fields are written using `setDocAtPath` with `merge: true`, so they safely coexist with the existing profile structure.

### `referrals/{referredUserId}`

There is at most **one** referral document per referred user. The document ID is the `referredUserId` (the Firebase Auth UID of the user who signed up with a code).

Shape:

```ts
{
  referrerUserId: string;
  referrerReferralCode: string;
  referredUserId: string;
  referredEmail?: string;
  status: "pending" | "completed";
  rewardAmount: number;
  createdAt: Timestamp;
  completedAt?: Timestamp;
}
```

Semantics:

- **`pending`** – user has signed up with a valid code, but has **not yet** completed a paid booking.
- **`completed`** – the referred user has completed their first paid booking and the reward has been credited to the referrer’s `creditBalance`.

---

## Signup Flow (Referral Handling)

### Entry point

The main logic lives in:

- `src/contexts/auth-context.tsx` – `signup` function
- `src/services/referralService.ts` – `createReferralIfValid`

`signup` now accepts an optional `referralCode`:

```ts
signup(
  email: string,
  password: string,
  role?: AppUserRole | null,
  referralCode?: string | null
): Promise<void>
```

### Behaviour

When a user signs up:

1. **Create Firebase Auth user**
   - Standard `createUserWithEmailAndPassword` flow.

2. **Generate referral code for the new user**
   - `referralCode = CC-${uid.slice(0, 6).toUpperCase()}`.

3. **Create/update profile**
   - `profiles/{uid}` is written via `setDocAtPath` with:
     - `email`
     - `role`
     - `phone: null`
     - `location: null`
     - `referralCode: generatedReferralCode`
     - `referredBy: referralCode?.trim() || null`
     - `creditBalance: 0`
     - `referralRewarded: false`

4. **Create referral doc (if referral code is present & valid)**
   - If a **non-empty** `referralCode` was supplied:
     - `createReferralIfValid` searches `profiles` for a user with `referralCode` equal to the supplied code.
     - If no profile is found, **no referral doc is created** (but `referredBy` on the new profile still stores the provided code).
     - If a profile is found:
       - A new doc is written to `referrals/{newUserId}` with:
         - `referrerUserId`
         - `referrerReferralCode`
         - `referredUserId`
         - `referredEmail`
         - `status: "pending"`
         - `rewardAmount` (default constant, currently `10`)
         - `createdAt: serverTimestamp()`

Important constraints:

- **No rewards are granted at signup.**  
  The referral is only marked as `pending`; credits are granted **after** the first confirmed paid booking.

---

## Booking Reward Logic

### Entry point

Core logic lives in:

- `src/services/referralService.ts` – `rewardReferralIfEligible`
- `src/services/booking-service.ts` – `handleBookingPaymentSuccess`
- `src/screens/customer/payment/payment-callback-screen.tsx` – triggers reward after successful payment verification

### `rewardReferralIfEligible(referredUserId: string)`

This function:

- Runs inside a **Firestore transaction** to prevent race conditions.
- Reads:
  - `profiles/{referredUserId}`
  - `referrals/{referredUserId}`

It proceeds **only if**:

1. The user was referred: `referredBy` is non-null/non-empty.
2. `referralRewarded === false` on the referred user’s profile.
3. The referral document exists and `status === "pending"`.

If all conditions are met:

1. It loads the **referrer’s** profile (`profiles/{referrerUserId}`).
2. Adds `rewardAmount` from the referral document to the referrer’s `creditBalance`.
3. Updates the referral doc:
   - `status: "completed"`
   - `completedAt: serverTimestamp()`
4. Updates the referred user’s profile:
   - `referralRewarded: true`

Because this is a single Firestore transaction:

- The reward is **one-time** (idempotent).
- Multiple calls (or retries) will not double-credit: once `referralRewarded` is true or `status` is not `pending`, the function becomes a no-op.

---

## When Rewards Are Triggered

### Payment success → booking completed

Payments are processed via Paystack. When a payment is successful:

1. The backend Paystack webhook / transaction handler updates the `transactions` collection and sets the related booking’s `status` to `"completed"` in `bookings/{bookingId}`.
2. On the client, after Paystack redirects back, the app calls `verifyPayment(reference)` to confirm the payment status.

### Trigger point in the app

In `PaymentCallbackScreen` (`src/screens/customer/payment/payment-callback-screen.tsx`):

- After `verifyPayment(reference)` returns with `status === "success"`:

  - The referral reward helper is called via:
    - `handleBookingPaymentSuccess(referredUserId)`
    - `referredUserId` is resolved from:
      - `verifyResult.metadata?.userId` (from Paystack metadata), or
      - fallback to the currently logged-in `user.id`.

### `handleBookingPaymentSuccess`

Defined in `src/services/booking-service.ts`:

- Thin wrapper that:
  - Accepts `referredUserId`.
  - No-ops if the id is missing.
  - Calls `rewardReferralIfEligible(referredUserId)` and logs any errors.

This keeps all **referral-specific** business logic in `referralService.ts`, while `booking-service.ts` just knows *when* a booking is considered successfully paid.

---

## Summary of Rules

- **Every user has a unique referral code** on their profile.
- **New users can sign up using a referral code** (stored as `referredBy`).
- A **referral doc** is created at `referrals/{referredUserId}` with `status: "pending"` if the code is valid.
- **Reward credits are granted only after the referred user completes their first paid booking** (after payment verification / booking completion).
- **Credits are stored on the referrer’s profile** in `creditBalance`.
- **Each referred user can only trigger a reward once**, enforced by:
  - `referralRewarded` boolean on their profile.
  - Transactional updates of both the referral doc and both profiles.

This setup is intentionally explicit, MVP-friendly, and safe to call multiple times without risking duplicate rewards.


