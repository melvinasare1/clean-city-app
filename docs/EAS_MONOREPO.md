# EAS / monorepo

This repo is **two Expo apps**. There is no Expo project at the repository root.
`eas build` must run against `apps/customer` or `apps/driver`.

From the repo root:

```bash
# Driver development client (iOS)
npm run eas:driver:ios:dev

# Customer development client (iOS)
npm run eas:customer:ios:dev

# Production store builds
npm run eas:customer:prod
npm run eas:driver:prod

# OTA hotfix to the production channel (JS/TS only; see BUILD_AND_SUBMIT_GUIDE.md)
npm run eas:customer:hotfix
npm run eas:driver:hotfix
```

Or from the app folder:

```bash
cd apps/driver
eas build --platform ios --profile development

cd apps/customer
eas build --platform ios --profile development
```

Do **not** run `eas build` or `eas update` at the repo root. That created a stub `app.json` without
`runtimeVersion` and a new EAS project named `clean-city-monorepo`. Those root files
were removed. The EAS project that was created in that attempt
(`dc7eca3b-7859-4ed7-83b6-40c2edc4f38c`) is now linked to **apps/driver**.

## OTA hotfixes

JS/TS production updates go out with EAS Update on the **production** channel. `runtimeVersion` stays `1.0.0` so current store binaries still download the update. Profile shows **Hotfix x.y.z**.

| Script | App | Effect |
|---|---|---|
| `npm run eas:customer:hotfix` | Customer | Bump `expo.version` and publish OTA |
| `npm run eas:driver:hotfix` | Driver | Bump `expo.version` and publish OTA |
| `npm run hotfix:customer` / `hotfix:driver` | Either | Version bump only |
| `npm run eas:customer:update:hotfix` / `eas:driver:update:hotfix` | Either | Publish only |

For a custom EAS message, bump then run `CLEAN_CITY_HOTFIX=1 eas update --channel production --message "..."` from `apps/customer` or `apps/driver`.

Full flow, what OTA cannot change, and how to verify on device: [BUILD_AND_SUBMIT_GUIDE.md](./BUILD_AND_SUBMIT_GUIDE.md#ota-hotfixes-eas-update).

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
