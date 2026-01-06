# EAS Secrets Setup Guide

Guide for setting up environment variables using EAS Secrets for production builds.

## 🎯 Why EAS Secrets?

- **Security**: Secrets are encrypted and stored securely
- **Flexibility**: Different values for different build profiles
- **Best Practice**: No hardcoded values in `eas.json`
- **Team Collaboration**: Secrets are shared across team members

## 🚀 Setup Steps

### 1. Install EAS CLI (if not already installed)

```bash
npm install -g eas-cli
```

### 2. Login to EAS

```bash
eas login
```

### 3. Set the Production Secret

```bash
eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value "https://clean-city-app-production.up.railway.app/" --type string
```

**Note:** The `--scope project` flag makes the secret available to all builds for this project.

### 4. Verify Secret is Set

```bash
eas secret:list
```

You should see:
```
EXPO_PUBLIC_API_URL (project)
```

### 5. Rebuild Production App

After setting the secret, rebuild your production app:

```bash
eas build --platform ios --profile production
# or
eas build --platform android --profile production
```

The secret will be automatically injected as an environment variable during the build.

## 📝 Current Configuration

### Development Build
- Uses hardcoded value in `eas.json` (for local testing)
- Value: `https://clean-city-app-production.up.railway.app/`

### Production Build
- Uses EAS Secret: `EXPO_PUBLIC_API_URL`
- Set via: `eas secret:create`

## 🔍 Verifying Secrets in Build

### Option 1: Check in Admin Screen
1. Build and install the production app
2. Login as admin
3. Go to Admin Push screen
4. Click "Show API URL"
5. Verify the URL is displayed (not "undefined")

### Option 2: Check Build Logs
When building, EAS will show which secrets are being used (without revealing values).

## 🛠️ Managing Secrets

### List All Secrets
```bash
eas secret:list
```

### Update a Secret
```bash
eas secret:update --name EXPO_PUBLIC_API_URL --value "https://new-url.com/"
```

### Delete a Secret
```bash
eas secret:delete --name EXPO_PUBLIC_API_URL
```

### View Secret Value
```bash
# Note: This will show the value in plain text
eas secret:view --name EXPO_PUBLIC_API_URL
```

## 🔐 Secret Scopes

- **Project scope** (`--scope project`): Available to all builds in the project
- **Account scope** (`--scope account`): Available to all projects in your account

For this app, we use **project scope** so the secret is available to all team members.

## 📋 Environment Variable Access

The secret is automatically available in your app as:
```typescript
process.env.EXPO_PUBLIC_API_URL
```

This works the same way as regular environment variables, but the value comes from EAS Secrets during the build process.

## ✅ Checklist

- [ ] EAS CLI installed
- [ ] Logged in to EAS
- [ ] Secret created: `EXPO_PUBLIC_API_URL`
- [ ] Secret verified with `eas secret:list`
- [ ] Production build created
- [ ] Verified in app (Admin screen shows URL, not "undefined")

## 🐛 Troubleshooting

### Secret Not Available in Build

**Check:**
- ✅ Secret name matches exactly: `EXPO_PUBLIC_API_URL`
- ✅ Secret scope is `project` (not account)
- ✅ You're building with the correct profile: `--profile production`
- ✅ Secret was created before the build

**Fix:**
1. Verify secret exists: `eas secret:list`
2. Rebuild: `eas build --platform ios --profile production --clear-cache`

### Secret Shows as "undefined" in App

**Check:**
- ✅ Secret is set correctly: `eas secret:list`
- ✅ App was rebuilt after setting secret
- ✅ Using production build profile
- ✅ Variable name is correct: `EXPO_PUBLIC_API_URL` (case-sensitive)

**Fix:**
1. Verify secret: `eas secret:view --name EXPO_PUBLIC_API_URL`
2. Rebuild app: `eas build --platform ios --profile production`
3. Reinstall app on device
4. Check Admin screen debug section

### Development vs Production

**Development builds** use the value from `eas.json`:
```json
"development": {
  "env": {
    "EXPO_PUBLIC_API_URL": "https://clean-city-app-production.up.railway.app/"
  }
}
```

**Production builds** use EAS Secrets (no value in `eas.json`).

## 📚 Additional Resources

- [EAS Secrets Documentation](https://docs.expo.dev/build-reference/variables/#using-eas-secrets)
- [EAS CLI Reference](https://docs.expo.dev/eas-cli/)
- [Environment Variables Guide](https://docs.expo.dev/guides/environment-variables/)

