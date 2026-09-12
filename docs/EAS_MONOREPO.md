# EAS / monorepo

This repo is **two Expo apps**. There is no Expo project at the repository root.
`eas build` must run against `apps/customer` or `apps/driver`.

From the repo root:

```bash
# Driver development client (iOS)
npm run eas:driver:ios:dev

# Customer development client (iOS)
npm run eas:customer:ios:dev
```

Or from the app folder:

```bash
cd apps/driver
eas build --platform ios --profile development

cd apps/customer
eas build --platform ios --profile development
```

Do **not** run `eas build` at the repo root. That created a stub `app.json` without
`runtimeVersion` and a new EAS project named `clean-city-monorepo`. Those root files
were removed. The EAS project that was created in that attempt
(`dc7eca3b-7859-4ed7-83b6-40c2edc4f38c`) is now linked to **apps/driver**.

## Identifiers

Customer (`apps/customer`) — existing store listing:

- iOS `com.cleancity.app`
- Android `com.cleancity.app`
- EAS `16248649-26d4-431e-a380-a40be65350a0`

Driver (`apps/driver`):

- iOS `com.cleancity.driver`
- Android `com.cleancity.driver`
- EAS `dc7eca3b-7859-4ed7-83b6-40c2edc4f38c`

Use `com.cleancity.driver` for the driver bundle ID, not `com.itsczar24.cleancitymonorepo`.
