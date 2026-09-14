# Data store strategy: Firestore vs Realtime Database

Clean City uses **two Firebase databases** in the same project (`clean-city-app-f9d73`). They are not interchangeable. Pick the store by **access pattern**, not by which client is calling.

This document locks the split before location writers and customer trip tracking are built on top of it.

## Decision

| Store | Holds | Why |
| --- | --- | --- |
| **Cloud Firestore** | Bookings, subscriptions, driver profiles, payments, early-access signups, free-pickup records; customer profiles when they exist | Structured documents, low-frequency writes, query-heavy reads (lists, filters, joins by `userId` / `driverId` / status). |
| **Realtime Database** | Live driver presence, live GPS, in-progress trip location mirror | High-frequency updates, `onDisconnect()`, and cheap per-path listeners. Not used for queries or business records. |

Do **not** write continuous GPS or heartbeat presence to Firestore. Do **not** move bookings, profiles, subscriptions, or payments into RTDB.

## Firestore (system of record)

| Collection | Role | Why Firestore |
| --- | --- | --- |
| **bookings** | Create, assign, accept/decline, `in_progress`, complete/cancel. Status and `userId` / `driverId` live here. | Structured, query-heavy, low-frequency writes. |
| **subscriptions** | Plans, collection cadence, billing state. | Structured, query-heavy, low-frequency writes. |
| **drivers** | Driver identity, approval, contact, push tokens (`drivers/{uid}`). | Structured, query-heavy, low-frequency writes. |
| **payments** | Paystack references, amounts, verification. | Durable, structured records that may need future querying/export; low write volume makes them effectively free regardless of store. |
| **products** | Store catalog (bins, liners). | Structured catalog; admin writes, public reads. |
| **orders** | Physical-goods store checkouts (cart items, delivery address, MoMo payment). **Not** bookings/jobs. | Structured, query by `userId`; do not reuse the booking schema. |
| **early_access_signups** | Waitlist / early-access signups. | Durable, structured records that may need future querying/export; low write volume makes them effectively free regardless of store. |
| **free-pickup** | Referral / complimentary pickup records. | Durable, structured records that may need future querying/export; low write volume makes them effectively free regardless of store. |

**Config:** `config` (including `config/pricing`) is being removed as part of the move to dynamic pricing. Do not treat it as a long-lived store.

**Customer profiles:** there is no customer-profiles collection yet. When it is added, it belongs in Firestore alongside `drivers` — same reasoning as the rest of this table (low-frequency, structured, needs queries). Today customer fields still live on `profiles/{uid}` and related docs; that is a transitional layout, not an RTDB candidate.

Typical write rate: human actions (book, pay, go on shift, accept a job). Typical read: indexes and `where` queries.

## Realtime Database (live state only)

Three client-facing paths. Nothing else should be added without updating this doc and `database.rules.json`.

### `/presence/{driverId}`

Online flag for a driver.

```
{
  "online": true,
  "lastSeen": <RTDB server timestamp>
}
```

When a driver goes online, the driver client writes `{ online: true, lastSeen: serverTimestamp }` and registers:

```
onDisconnect().set({ online: false, lastSeen: serverTimestamp })
```

so a crash or dropped connection corrects presence without a Firestore write.

### `/driverLocations/{driverId}`

Continuous GPS **while the driver is online**.

```
{
  "lat": <number>,
  "lng": <number>,
  "updatedAt": <RTDB server timestamp>
}
```

Written on a short interval (about 5–10 seconds) by the driver client. **Customers never read this path.** Admin live maps read it together with `/presence`.

### `/activeTripLocation/{bookingId}`

Mirror of the **assigned driver’s** current location, keyed by **booking id** so the customer app can subscribe without access to `/driverLocations`.

Written **only** while that booking’s Firestore status is `in_progress`. When the booking leaves `in_progress`, the node is removed (or equivalent) so the customer listener goes idle.

Payload must include `userId` (the booking customer). RTDB rules cannot query Firestore, so ownership is enforced from fields on this node:

```
{
  "userId": "<booking.userId>",
  "driverId": "<booking.driverId>",
  "lat": <number>,
  "lng": <number>,
  "updatedAt": <RTDB server timestamp>
}
```

The customer app should start the RTDB listener after Firestore already shows `in_progress` (when this node is created). Subscribing to an empty path is denied, because rules cannot prove `userId` until the node exists.

**Writers:** not the customer client. Not a generic driver write to arbitrary booking ids. The intended writer is a privileged path (Admin SDK / Cloud Function, or a later tightly-scoped driver write) that copies from `/driverLocations/{driverId}` only for the in-progress booking. That writer is **out of scope for this pass**.

## Who can access RTDB

| Path | Driver | Customer | Admin |
| --- | --- | --- | --- |
| `/presence/{uid}` | Write (and read) **own** uid only | No | Read all |
| `/driverLocations/{uid}` | Write (and read) **own** uid only | No | Read all |
| `/activeTripLocation/{bookingId}` | No client write in these rules | Read only if `userId` on the node equals `auth.uid` | Read all |

Admin in RTDB rules is **not** `profiles/{uid}.role` (that is Firestore). Client admin reads are allowed when any of these is true:

- `auth.token.admin === true` or `auth.token.role === 'admin'` (Auth custom claims)
- `/admins/{uid} === true` (seeded with the Admin SDK; clients cannot write this node)

The Admin SDK bypasses RTDB rules entirely and can read/write all three paths for a live admin map or the future trip-location mirror.

## Security rules file

Rules live in [`database.rules.json`](../database.rules.json) and are wired in [`firebase.json`](../firebase.json). Deploy with:

```bash
npm run deploy:database-rules
```

Default is deny. `/locations/{driverId}` is **not** part of this architecture; use `/driverLocations/{driverId}`.

## Implementation status

| Piece | Status |
| --- | --- |
| This architecture + RTDB rules | Done (this pass) |
| Driver `/presence` + `onDisconnect` | Exists in the driver app; keep aligned with `/presence/{driverId}` |
| Driver GPS → `/driverLocations` | **Not in this pass** |
| Mirror → `/activeTripLocation` while `in_progress` | **Not in this pass** |
| Customer listener on `/activeTripLocation/{bookingId}` | **Not in this pass** |
| Stripe Card checkout on Schedule Pickup **and** Cart | **Follow-up** — both screens currently show Card as disabled “Coming soon”. Enable them together when Stripe goes live. |

Booking assign/accept/decline, driver profiles, and payments stay on Firestore regardless of later RTDB writers.
