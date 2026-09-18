# Build and Submit to App Stores Guide

Complete guide for building and submitting CleanCityApp to iOS App Store and Google Play Store using EAS Build.

## 📋 Prerequisites

### Required Accounts
- ✅ **Expo Account** - Sign up at [expo.dev](https://expo.dev)
- ✅ **Apple Developer Account** - $99/year - [developer.apple.com](https://developer.apple.com)
- ✅ **Google Play Console Account** - $25 one-time - [play.google.com/console](https://play.google.com/console)

### Required Tools
- ✅ **EAS CLI** - `npm install -g eas-cli`
- ✅ **Node.js 22.0.0** (as specified in `eas.json`)
- ✅ **Git** - For version control

## 🚀 Initial Setup (One-Time)

### 1. Install EAS CLI

```bash
npm install -g eas-cli
```

### 2. Login to Expo

```bash
eas login
```

### 3. Configure Project

```bash
eas build:configure
```

This will:
- Link your project to Expo
- Set up build configuration
- Create/update `eas.json`

### 4. Set Up EAS Secrets

For production builds, set required secrets:

```bash
# Set API URL secret
eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value "https://clean-city-app-production.up.railway.app/" --type string

# Verify secrets
eas secret:list
```

See [EAS_SECRETS_SETUP.md](./EAS_SECRETS_SETUP.md) for detailed instructions.

## 📱 iOS Build and Submit

### Step 1: Configure Apple Developer Account

1. **Add Apple Developer credentials to EAS:**
   ```bash
   eas credentials
   ```
   - Select iOS platform
   - Choose "Set up new credentials"
   - Follow prompts to add your Apple ID

2. **Or use existing credentials:**
   - If you have certificates/provisioning profiles, EAS can use them
   - Or let EAS generate new ones automatically

### Step 2: Build iOS App

#### Development Build (for testing)
```bash
eas build --platform ios --profile development
```

#### Preview Build (for TestFlight)
```bash
```

#### Production Build (for App Store)
```bash
eas build --platform ios --profile production
```

**Build Options:**
- `--local` - Build locally (requires macOS and Xcode)
- `--clear-cache` - Clear build cache
- `--non-interactive` - Don't prompt for input

**Example:**
```bash
eas build --platform ios --profile production --non-interactive
```

### Step 3: Monitor Build

Builds run in the cloud. Monitor progress:

```bash
# View build status
eas build:list

# Or check in browser
# Visit: https://expo.dev/accounts/[your-account]/projects/clean-city-app/builds
```

### Step 4: Submit to App Store

#### Option A: Automatic Submit (Recommended)

```bash
eas submit --platform ios --latest
```

This will:
- Use the latest production build
- Upload to App Store Connect
- Submit for review automatically

#### Option B: Manual Submit via App Store Connect

1. **Download the build:**
   - Visit build page on Expo dashboard
   - Download `.ipa` file

2. **Upload via Transporter:**
   - Install [Transporter](https://apps.apple.com/app/transporter/id1450874784)
   - Drag `.ipa` file to Transporter
   - Click "Deliver"

3. **Or use Xcode:**
   - Open Xcode → Window → Organizer
   - Click "+" → Select `.ipa`
   - Click "Distribute App"

### Step 5: Configure App Store Connect

1. **Go to [App Store Connect](https://appstoreconnect.apple.com)**
2. **Create App** (if first time):
   - App Name: "Clean City App"
   - Primary Language: English
   - Bundle ID: `com.cleancity.app` (from `app.json`)
   - SKU: `clean-city-app`

3. **Prepare Submission:**
   - Add app description, screenshots, keywords
   - Set pricing and availability
   - Add privacy policy URL (required)
   - Configure app categories

4. **Submit for Review:**
   - Select the build you uploaded
   - Answer export compliance questions
   - Submit for review

## 🤖 Android Build and Submit

### Google Sign-In on Android (required before testing social login)

Native Google Sign-In uses `@react-native-google-signin/google-signin` with `firebase/google-services.json`. If sign-in fails with **Developer error** (`code: 10`), the Android OAuth client is not registered for the keystore that signed the APK/AAB.

1. **Enable Google in Firebase**
   - Firebase Console → Authentication → Sign-in method → enable **Google**.

2. **Register SHA-1 fingerprints** (Firebase → Project settings → Your apps → Android `com.cleancity.app` → Add fingerprint):
   - **EAS development / preview / production** — run `eas credentials -p android` and copy each keystore’s SHA-1 (or from the Expo build credentials page).
   - **Google Play App Signing** — Play Console → Your app → Setup → App signing → **App signing key certificate** SHA-1 (required for store builds even if EAS SHA-1 is already added).

3. **Download `google-services.json`** after adding fingerprints and replace `firebase/google-services.json`. A correct file includes an Android OAuth client (`client_type`: 1), not only Web (`client_type`: 3).

The **driver** app (`apps/driver`) is a second Android package: `com.cleancity.driver`. It cannot reuse the customer `google-services.json` (`com.cleancity.app`). In the same Firebase project (`clean-city-app-f9d73`):

1. Project settings → Your apps → **Add app** → Android.
2. Package name: `com.cleancity.driver` (must match `app.json`).
3. Add the EAS Android keystore SHA-1 (`eas credentials -p android` from `apps/driver`).
4. Download `google-services.json` into `apps/driver/firebase/google-services.json`.
5. Rebuild: `cd apps/driver && eas build --platform android --profile production`.

If Gradle fails with `No matching client found for package name 'com.cleancity.driver'`, this file was not replaced yet.

4. **Align the Web client ID** — `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in `eas.json` must match the Web client in `google-services.json` (same Firebase project). Rebuild the native app after changing env or `google-services.json` (OTA updates are not enough).

```bash
eas build --platform android --profile production --clear-cache
```

---

### Step 1: Configure Google Play Console

1. **Create App in Play Console:**
   - Go to [Google Play Console](https://play.google.com/console)
   - Create new app
   - App name: "Clean City App"
   - Default language: English
   - App or game: App
   - Free or paid: Choose your option

2. **Set Up App Signing:**
   - Google Play will handle app signing automatically
   - Or upload your own keystore (advanced)

### Step 2: Build Android App

#### Development Build
```bash
eas build --platform android --profile development
```

#### Preview Build (for internal testing)
```bash
eas build --platform android --profile preview
```

#### Production Build (for Play Store)
```bash
eas build --platform android --profile production
```

**Build Options:**
- `--local` - Build locally (requires Android SDK)
- `--clear-cache` - Clear build cache
- `--non-interactive` - Don't prompt for input

### Step 3: Submit to Google Play Store

#### Option A: Automatic Submit (Recommended)

```bash
eas submit --platform android --latest
```

This will:
- Use the latest production build
- Upload to Google Play Console
- Submit to selected track (internal, alpha, beta, or production)

#### Option B: Manual Submit

1. **Download the build:**
   - Visit build page on Expo dashboard
   - Download `.aab` file (Android App Bundle)

2. **Upload to Play Console:**
   - Go to Google Play Console
   - Select your app
   - Go to Production → Create new release
   - Upload `.aab` file
   - Add release notes
   - Review and publish

### Step 4: Configure Play Store Listing

1. **Store Listing:**
   - App name, description, screenshots
   - Feature graphic, app icon
   - Privacy policy URL (required)
   - Content rating questionnaire

2. **App Content:**
   - Complete content rating
   - Add privacy policy
   - Set target audience

3. **Release:**
   - Create release in Production track
   - Upload AAB file
   - Add release notes
   - Review and roll out

## 🔄 Build Profiles

### Development
- **Purpose:** Local testing with dev client
- **Distribution:** Internal
- **Environment:** Development API URL
- **Use Case:** Testing new features

### Preview
- **Purpose:** Internal testing (TestFlight/Internal Testing)
- **Distribution:** Internal
- **Environment:** Production API URL
- **Use Case:** QA testing before release

### Production
- **Purpose:** Public release
- **Distribution:** App Store / Play Store
- **Environment:** Production API URL (from EAS Secrets)
- **Use Case:** Public release

## 📡 OTA hotfixes (EAS Update)

Use an OTA when the change is JavaScript/TypeScript, styles, or copy, and existing App Store / Play binaries should pick it up without a new native build.

Do **not** use OTA for native-module changes, `app.json` plugins, `google-services.json`, iOS/Android credentials, or a `runtimeVersion` bump. Those need a production EAS build and store submit.

This is a **monorepo**. Always publish from the repo root scripts (or from `apps/customer` / `apps/driver`). Never run `eas update` at the repository root.

### How a hotfix works

1. `expo.version` patch is bumped (`1.0.2` → `1.0.3`) in that app’s `app.json` and `package.json`.
2. `runtimeVersion` stays `1.0.0`, so store binaries already in the wild still receive the update.
3. `CLEAN_CITY_HOTFIX=1` sets `extra.releaseKind` to `hotfix`.
4. The update is published to the **production** channel (iOS + Android).
5. Profile shows **Hotfix 1.0.3** instead of the store version.

State is stored in `apps/<app>/version-bump.json`.

### Scripts (from repo root)

| Script | What it does |
|---|---|
| `npm run hotfix:customer` | Bump customer `expo.version` only. Does not publish. |
| `npm run hotfix:driver` | Bump driver `expo.version` only. Does not publish. |
| `npm run eas:customer:hotfix` | Bump customer version **and** publish OTA to `production`. |
| `npm run eas:driver:hotfix` | Bump driver version **and** publish OTA to `production`. |
| `npm run eas:customer:update:hotfix` | Publish customer OTA only (use after a bump, or to republish). |
| `npm run eas:driver:update:hotfix` | Publish driver OTA only. |

The `eas:*:hotfix` / `eas:*:update:hotfix` scripts set `CLEAN_CITY_HOTFIX=1` and run:

```bash
eas update --channel production --message hotfix
```

### Typical customer hotfix

```bash
# From repo root: bump 1.0.2 → 1.0.3 and publish
npm run eas:customer:hotfix
```

If the version is already bumped and you only need to publish:

```bash
npm run eas:customer:update:hotfix
```

### Custom update message

The npm scripts always send `--message hotfix`. For a useful EAS dashboard note, bump first, then publish from the app folder:

```bash
npm run hotfix:customer
cd apps/customer
CLEAN_CITY_HOTFIX=1 eas update --channel production --message "Fix checkout payment selection"
```

Same pattern for the driver app (`npm run hotfix:driver` then `cd apps/driver`).

### After publish

1. Confirm the Expo dashboard shows the new update on the **production** branch.
   - Customer: https://expo.dev/accounts/itsczar24/projects/clean-city-app/updates
   - Driver: check the driver EAS project on expo.dev
2. Fully close the production app and reopen it (`updates.checkAutomatically` is `ON_LOAD`).
3. Profile should show **Hotfix x.y.z**.

`eas update` loads that app’s `.env`. JS-only `EXPO_PUBLIC_*` values in `.env` are baked into the OTA bundle. Native config, plugins, and store binaries are not.

### OTA vs store build

| Change | OTA hotfix | New production build |
|---|---|---|
| Screens, copy, styles, JS/TS logic | Yes | Not required |
| `expo.version` label for testers | Yes (patch bump) | Yes |
| Native modules, plugins, `runtimeVersion` | No | Yes |
| `google-services.json` / Google Sign-In SHA-1 | No | Yes |
| New `EXPO_PUBLIC_*` needed in a **binary** | No | Yes |

## 📝 Build Configuration

Current build profiles in `eas.json`:

```json
{
  "build": {
    "development": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://clean-city-app-production.up.railway.app/"
      },
      "developmentClient": true,
      "distribution": "internal",
      "node": "22.0.0",
      "channel": "development"
    },
    "preview": {
      "distribution": "internal",
      "node": "22.0.0",
      "channel": "preview"
    },
    "production": {
      "autoIncrement": true,
      "node": "22.0.0",
      "channel": "production"
    }
  }
}
```

## 🔍 Build Status and Logs

### Check Build Status
```bash
eas build:list
```

### View Build Logs
```bash
eas build:view [build-id]
```

### Cancel Build
```bash
eas build:cancel [build-id]
```

## 🐛 Troubleshooting

### Build Fails

**Common Issues:**
- Missing credentials → Run `eas credentials`
- Invalid secrets → Check `eas secret:list`
- Build timeout → Try `--clear-cache`
- Node version mismatch → Check `eas.json` node version
- **Driver Android: `processReleaseGoogleServices` / “No matching client found for package name `com.cleancity.driver`”** → `apps/driver/firebase/google-services.json` is still the customer file (`com.cleancity.app`). Register a Firebase Android app for `com.cleancity.driver`, download a new `google-services.json`, and replace the driver file. Then rebuild. See below.

**Debug:**
```bash
# View detailed logs
eas build:view [build-id] --json

# Check credentials
eas credentials

# Verify secrets
eas secret:list
```

### Submit Fails

**Common Issues:**
- Missing app metadata in App Store Connect / Play Console
- Invalid bundle ID / package name
- Missing privacy policy URL
- Export compliance questions not answered (iOS)

**Fix:**
1. Complete all required fields in store consoles
2. Verify bundle ID matches `app.json`
3. Ensure build is production profile
4. Check store console for specific errors

### Environment Variables Not Working

**Check:**
- ✅ Secrets set: `eas secret:list`
- ✅ Using production profile
- ✅ App rebuilt after setting secrets
- ✅ Variable name correct: `EXPO_PUBLIC_API_URL`

**Fix:**
1. Verify secret: `eas secret:view --name EXPO_PUBLIC_API_URL`
2. Rebuild: `eas build --platform ios --profile production --clear-cache`
3. Test in app (Admin screen debug section)

### OTA hotfix not appearing

**Check:**
- ✅ Published to `--channel production` (the store binaries use that channel)
- ✅ `runtimeVersion` still `1.0.0` (do not bump it for a JS hotfix)
- ✅ `CLEAN_CITY_HOTFIX=1` was set for the publish (`eas:*:hotfix` scripts do this)
- ✅ Device fully closed and reopened the app
- ✅ Profile shows **Hotfix x.y.z**, not the previous store version

**Common mistakes:**
- Running `eas update` at the repo root instead of `apps/customer` or `apps/driver`
- Publishing a native-only change (plugins, `google-services.json`) — OTA cannot ship that
- Expecting a custom EAS message from `npm run eas:customer:hotfix` — that script always sends `--message hotfix`. Use a manual `eas update` for a descriptive message.

## 📋 Pre-Submission Checklist

### iOS App Store
- [ ] App name and description complete
- [ ] Screenshots for all required device sizes
- [ ] App icon (1024x1024)
- [ ] Privacy policy URL added
- [ ] Export compliance questions answered
- [ ] App categories selected
- [ ] Pricing and availability configured
- [ ] Age rating completed
- [ ] Build uploaded and selected
- [ ] App reviewed and tested

### Google Play Store
- [ ] App name and description complete
- [ ] Screenshots for phone and tablet
- [ ] Feature graphic (1024x500)
- [ ] App icon (512x512)
- [ ] Privacy policy URL added
- [ ] Content rating completed
- [ ] Target audience set
- [ ] AAB file uploaded
- [ ] Release notes added
- [ ] App reviewed and tested

## 🚀 Quick Commands Reference

### Build Commands
```bash
# From repo root (preferred in this monorepo)
npm run eas:customer:ios:prod
npm run eas:customer:android:prod
npm run eas:customer:prod
npm run eas:driver:ios:prod
npm run eas:driver:android:prod
npm run eas:driver:prod

# Or from apps/customer or apps/driver
eas build --platform ios --profile production
eas build --platform android --profile production
eas build --platform all --profile production
eas build --platform ios --profile production --local
```

### OTA hotfix commands (repo root)
```bash
# Bump version + publish to production channel
npm run eas:customer:hotfix
npm run eas:driver:hotfix

# Version bump only
npm run hotfix:customer
npm run hotfix:driver

# Publish only (version already bumped)
npm run eas:customer:update:hotfix
npm run eas:driver:update:hotfix
```

### Submit Commands
```bash
# Submit latest iOS build
eas submit --platform ios --latest

# Submit latest Android build
eas submit --platform android --latest

# Submit specific build
eas submit --platform ios --id [build-id]
```

### Credentials Commands
```bash
# Manage credentials
eas credentials

# View credentials
eas credentials --platform ios

# Reset credentials
eas credentials --platform ios --clear
```

### Secret Commands
```bash
# List secrets
eas secret:list

# Create secret
eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value "https://..." --type string

# Update secret
eas secret:update --name EXPO_PUBLIC_API_URL --value "https://..."

# View secret
eas secret:view --name EXPO_PUBLIC_API_URL
```

## 📚 Additional Resources

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [EAS Submit Documentation](https://docs.expo.dev/submit/introduction/)
- [App Store Connect Guide](https://developer.apple.com/app-store-connect/)
- [Google Play Console Guide](https://support.google.com/googleplay/android-developer)
- [Expo EAS CLI Reference](https://docs.expo.dev/eas-cli/)

## ✅ Success Criteria

You'll know everything is working when:
- ✅ Build completes successfully
- ✅ Build appears in Expo dashboard
- ✅ Submit completes without errors
- ✅ App appears in App Store Connect / Play Console
- ✅ App is available for review/submission
- ✅ TestFlight / Internal Testing works (for preview builds)

