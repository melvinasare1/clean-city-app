# Remote pricing (Firestore)

Bin prices are loaded from Firestore so you can change them without shipping a new app build.

## Firestore document

| Collection | Document ID | Purpose |
|------------|-------------|---------|
| `config`   | `pricing`   | Bin unit prices and availability |

### Recommended structure (nested)

```json
{
  "currency": "GHS",
  "bins": {
    "smallBag": {
      "unitPrice": 0.2,
      "enabled": true
    },
    "standardBin": {
      "unitPrice": 20,
      "enabled": true
    },
    "wheelieBin": {
      "unitPrice": 35,
      "enabled": true
    }
  },
  "updatedAt": "<Firestore timestamp or ISO string>"
}
```

### Legacy flat structure (still supported)

```json
{
  "smallBag": 0.2,
  "standardBin": 20,
  "wheelieBin": 35
}
```

If the document is missing or Firestore denies read access, the app falls back to built-in defaults (same as the previous hardcoded values).

## Seed script (recommended)

From the repo root, with Firebase Admin credentials configured:

```bash
# Preview payload (no write)
npm run seed:pricing:dry-run

# Write config/pricing to Firestore
export FIREBASE_SERVICE_ACCOUNT_JSON='<paste service account JSON>'
npm run seed:pricing
```

Or run directly:

```bash
cd functions
export FIREBASE_SERVICE_ACCOUNT_JSON='...'
node ../scripts/seed-pricing-config.js
```

Custom JSON file:

```bash
cd functions
node ../scripts/seed-pricing-config.js --config ../scripts/my-pricing.json
```

Default payload lives in `scripts/pricing-config.default.json`. Edit that file (or pass `--config`) before seeding.

**Credentials:** same as Vercel/API — `FIREBASE_SERVICE_ACCOUNT_JSON` (JSON string) or `GOOGLE_APPLICATION_CREDENTIALS` (path to a `.json` file).

## Firebase Console setup (manual alternative)

1. Open [Firebase Console](https://console.firebase.google.com) → project **clean-city-app-f9d73**.
2. **Firestore Database** → **Start collection** (if needed).
3. Collection ID: `config` → Document ID: `pricing`.
4. Add fields from the nested example above and **Publish**.

Changes apply in real time while the app is open (listener on `config/pricing`).

## Security rules

Allow **read** for all clients (pricing is not secret). Restrict **write** to admins only.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /config/pricing {
      allow read: if true;
      allow write: if false; // manage via Firebase Console or Admin SDK
    }
  }
}
```

If you use role-based admin writes later:

```javascript
allow write: if request.auth != null
  && get(/databases/$(database)/documents/profiles/$(request.auth.uid)).data.role == 'admin';
```

Until `config/pricing` is readable, the booking screen will use defaults and you may see `[PricingService] Snapshot error` in dev logs.

**Fix:** deploy rules from the repo (includes public read for pricing):

```bash
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json npm run deploy:firestore-rules
```

Or paste the `match /config/pricing` block from `firestore.rules` into the Firebase Console → Firestore → Rules → Publish.

## Bin keys (do not rename without an app update)

| Key           | UI label        | Item ID        |
|---------------|-----------------|----------------|
| `smallBag`    | Small Bags      | `SMALL_BAG`    |
| `standardBin` | Standard Bins   | `STANDARD_BIN` |
| `wheelieBin`  | Wheelie Bins    | `WHEELIE_BIN`  |

Set `enabled: false` on a bin to hide it from the New Booking screen.

## App code

- Defaults: `src/lib/pricing.ts` → `DEFAULT_PRICING_CONFIG`
- Listener: `src/services/pricing-service.ts`
- React context: `src/contexts/pricing-context.tsx` → `usePricing()`
- UI: `src/screens/customer/new-booking-screen/new-booking-screen.tsx`

Payment APIs still receive `unitPrice` / `totalPrice` from the client at booking time; consider server-side price validation in a follow-up if you need tamper protection.
