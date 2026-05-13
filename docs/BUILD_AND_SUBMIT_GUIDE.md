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
# iOS Production
eas build --platform ios --profile production

# Android Production
eas build --platform android --profile production

# Both platforms
eas build --platform all --profile production

# Local build (requires local setup)
eas build --platform ios --profile production --local
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

