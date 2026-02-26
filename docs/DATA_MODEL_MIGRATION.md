# Firestore data model: users / customers / drivers separation

This document describes the target Firestore structure and the safe migration path. No existing data is deleted; authentication and existing flows remain intact.

## Target structure

| Collection   | Purpose |
|-------------|--------|
| **users/**  | Identity only (auth-linked): `uid`, `email`, `role`, `createdAt`, `updatedAt`. Operational fields are moved out over time; do not delete them until migration is confirmed. |
| **customers/** | Customer-specific data. Document ID = Firebase Auth UID. `userId` = uid. |
| **drivers/**   | Driver-specific data. Document ID = Firebase Auth UID. `userId` = uid, `isActive` (default true). |
| **admins/**    | Optional, for future use. |

## Migration endpoint

**POST /api/dev/migrate-users**

- Reads from a **source collection** (default: `users`). If your app currently stores mixed roles in `profiles`, call with body `{ "sourceCollection": "profiles" }` or set env `MIGRATE_USERS_SOURCE=profiles`.
- For each document: `role === "customer"` → create `customers/{uid}`; `role === "driver"` → create `drivers/{uid}`.
- Does **not** delete or modify source documents. Does **not** overwrite existing `customers/` or `drivers/` documents.
- **Blocked in production** (`NODE_ENV === "production"`).
- Returns `{ "ok": true, "migrated": number }` or `{ "ok": false, "error": string }`.

Run locally (or in a non-production environment):

```bash
curl -X POST http://localhost:3000/api/dev/migrate-users
# Or with profiles as source:
curl -X POST http://localhost:3000/api/dev/migrate-users -H "Content-Type: application/json" -d '{"sourceCollection":"profiles"}'
```

## Backend behavior after migration

- **Driver endpoints** (e.g. GET /api/drivers, POST /api/jobs/assign, start-shift, end-shift, jobs/start, jobs/complete): validate that the driver exists in the **drivers** collection (with fallback to **profiles** for backward compatibility) and that `isActive === true`.
- **Customer-related lookups** (e.g. push token for subscription reminders): try **customers** first, then **profiles**.
- **Payments, subscriptions, jobs**: continue to reference `userId` (Firebase Auth UID). No change to job `assignedTo` — it remains the driver UID, which equals `drivers/{uid}.id`.

## What stays the same

- Authentication still uses Firebase Auth UID.
- Payments and subscriptions still reference `userId`.
- Jobs still reference `userId` and `assignedTo` (driverId = uid).
- The existing **users** (or **profiles**) collection is **not** removed; operational fields can be trimmed later after migration is verified.

## Future cleanup (not done yet)

After confirming migration and behavior:

1. Gradually remove operational fields from the **users** (or **profiles**) collection.
2. Keep **users** strictly for identity: uid, email, role, createdAt, updatedAt.
