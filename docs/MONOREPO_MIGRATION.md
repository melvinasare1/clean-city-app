# Migration Plan: Single App → Driver + Customer Monorepo

Do this in order. Each step should leave you with something that still runs,
so you're never stuck mid-migration with nothing working.

## 0. Before touching anything
- Commit/branch off your current single-app repo (`git checkout -b monorepo-migration`)
- Confirm exact current versions of `expo`, `react`, `react-native`,
  `@rnmapbox/maps`, `firebase` from your existing `package.json` — the
  version numbers in this scaffold's `package.json` files are placeholders,
  swap them for what you're actually already running so you don't
  accidentally upgrade three things at once during a restructure.

## 1. Stand up the workspace shell
- Copy this scaffold's root `package.json`, `apps/`, `packages/` folders into
  a new repo (or a new top-level folder if you're keeping one repo/history).
- Run `npm install` at the root once — this is what makes npm workspaces
  hoist shared dependencies and link `@platform/*` packages to each other.

## 2. Extract the shared packages FIRST
This is the step that de-risks everything else — do it before touching the
two app folders.
- `packages/shared-theme`: move your existing `src/theme/driver-home.ts`
  contents into `packages/shared-theme/src/tokens.ts`
- `packages/shared-firebase`: move your existing Firebase init (the file the
  `// TODO` comments in the earlier accept/decline package pointed at) into
  `packages/shared-firebase/src/index.ts`. Fill in your real env var names.
- `packages/shared-types`: move/consolidate any `Booking`/`Driver` types you
  already have scattered across the app into `packages/shared-types/src/index.ts`

## 3. Move the driver-only code into apps/driver
- Run `npx create-expo-app` fresh inside `apps/driver` if you want a clean
  native project (recommended over hand-assembling one), then delete its
  generated `package.json`/`metro.config.js` and drop in this scaffold's
  versions instead.
- Move every driver-specific screen/component from your current app
  (`DriverHome`, `TopBar`, `StatusPill`, `MapControls`, `HomeSheet`,
  `JobOfferSheet`, the `useAssignedJobOffer` hook, etc.) into
  `apps/driver/src/...`
- Delete the role-branching navigation logic entirely — this app assumes
  every logged-in user is a driver, full stop.
- Update imports that used to point at local theme/firebase/types files to
  instead import from `@platform/shared-theme`, `@platform/shared-firebase`,
  `@platform/shared-types`.

## 4. Move the customer-only code into apps/customer
- Same pattern: fresh `create-expo-app` scaffold, swap in this repo's
  `package.json`/`metro.config.js`, move customer screens over, delete the
  driver branch of the old navigation logic, repoint shared imports.

## 5. Delete the old single app
Once both new apps run independently and you've smoke-tested login + one
core flow in each, delete the old combined app folder. Don't leave it around
"just in case" — it'll bit-rot and someone will edit the wrong copy.

## 6. EAS / build config
- Each app needs its own `app.json` with a distinct `ios.bundleIdentifier`
  and `android.package` — these cannot be shared between two apps on the
  App Store/Play Store.
- Each app needs its own `eas.json` build profiles and its own EAS project
  (`eas init` run separately inside `apps/driver` and `apps/customer`).
- If you use GitHub Actions/CI, set up path filters so a driver-app-only
  change doesn't trigger an unnecessary customer-app build and vice versa.

## 7. What stays where
- **Firebase project/backend**: unchanged, both apps still talk to the same
  project — you are not splitting the backend, only the two client apps.
- **Firestore rules**: still deployed from wherever they live today (likely
  your admin/website repo) — no change required by this migration.
- **Admin website**: stays a separate repo. It's a different platform and
  deploy target (web, not Expo/EAS); no strong reason to fold it into this
  mobile monorepo unless you later want its shared types pulled from
  `@platform/shared-types` too, which is a nice-to-have, not a blocker.

## Order of operations if you want the fastest path to "shippable"
1. Shared packages (step 2) — a few hours, no user-facing risk
2. Driver app extraction (step 3) — you already have most driver screens
   built from our earlier work, so this is mostly moving files and fixing imports
3. Customer app extraction (step 4) — do this second since it's probably the
   larger, more established surface and benefits from you having already
   worked out the Metro/workspace kinks on the driver app first
