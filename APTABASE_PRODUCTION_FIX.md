# Aptabase Production Analytics Fix

## Issue

Aptabase analytics events were being sent in debug/development builds but not in production builds.

## Root Cause

In Expo production builds, environment variables accessed via `process.env` can be unreliable. The `EXPO_PUBLIC_APTABASE_KEY` was configured in `eas.json` but not being properly accessed in production builds.

## Solution

Implemented a dual-source approach for accessing the Aptabase API key:

1. **Primary**: Use `expo-constants` to access the key from `app.json` extra field
2. **Fallback**: Use `process.env.EXPO_PUBLIC_APTABASE_KEY` for development

## Changes Made

### 1. `app.json`
Added Aptabase key to the `extra` field:
```json
"extra": {
  "eas": {
    "projectId": "16248649-26d4-431e-a380-a40be65350a0"
  },
  "aptabaseKey": "${EXPO_PUBLIC_APTABASE_KEY}"
}
```

This makes the key accessible via `Constants.expoConfig.extra.aptabaseKey` in production builds.

### 2. `App.tsx`
Updated initialization to use both sources:
```typescript
import Constants from 'expo-constants';

const APTABASE_APP_KEY = 
    Constants.expoConfig?.extra?.aptabaseKey || 
    process.env.EXPO_PUBLIC_APTABASE_KEY;
```

Added comprehensive logging to debug key availability:
```typescript
if (APTABASE_APP_KEY) {
    init(APTABASE_APP_KEY);
    console.log('[Aptabase] ✅ Initialized with key:', APTABASE_APP_KEY.substring(0, 8) + '...');
} else {
    console.error('[Aptabase] ❌ No API key found!');
    console.error('[Aptabase] Checked sources:', {
        expoConfig: Constants.expoConfig?.extra?.aptabaseKey ? 'found' : 'missing',
        processEnv: process.env.EXPO_PUBLIC_APTABASE_KEY ? 'found' : 'missing',
    });
}
```

### 3. `src/services/analytics/Analytics.ts`
Enhanced error logging to help diagnose issues in production:
```typescript
console.error("[Analytics] ❌ Error tracking event:", eventName, error);
// Don't silently fail - log errors even in production for debugging
```

## How Environment Variables Work in Expo

### Development (`expo start`)
- Variables from `.env` file are loaded
- `process.env.EXPO_PUBLIC_*` works directly
- `Constants.expoConfig.extra.*` also works

### Production Builds (`eas build --profile production`)
- Variables are **inlined at build time** from `eas.json`
- `process.env.EXPO_PUBLIC_*` may not work reliably in native code
- **Recommended**: Access via `Constants.expoConfig.extra.*`

## Environment Variable Configuration

The Aptabase key is configured in multiple places:

1. **`.env`** (local development):
   ```
   EXPO_PUBLIC_APTABASE_KEY=A-EU-6592512622
   ```

2. **`eas.json`** (EAS builds):
   ```json
   {
     "build": {
       "development": {
         "env": {
           "EXPO_PUBLIC_APTABASE_KEY": "A-EU-6592512622"
         }
       },
       "preview": {
         "env": {
           "EXPO_PUBLIC_APTABASE_KEY": "A-EU-6592512622"
         }
       },
       "production": {
         "env": {
           "EXPO_PUBLIC_APTABASE_KEY": "A-EU-6592512622"
         }
       }
     }
   }
   ```

3. **`app.json`** (expo-constants access):
   ```json
   {
     "extra": {
       "aptabaseKey": "${EXPO_PUBLIC_APTABASE_KEY}"
     }
   }
   ```

## Verification Steps

### 1. Check Logs After App Launch

In production builds, check the device/TestFlight logs for:

```
[Aptabase] ✅ Initialized with key: A-EU-659...
```

If you see:
```
[Aptabase] ❌ No API key found!
```

Then check which sources are missing:
```
[Aptabase] Checked sources: { expoConfig: 'missing', processEnv: 'missing' }
```

### 2. Trigger a Test Event

From any screen, trigger an analytics event. Check logs for:
```
[Analytics] 📊 Event tracked: screen_view { screen_name: 'home' }
```

If you see errors:
```
[Analytics] ❌ Error tracking event: screen_view [error details]
```

### 3. Verify in Aptabase Dashboard

1. Go to Aptabase dashboard: https://aptabase.com
2. Navigate to your app (Clean City - `A-EU-6592512622`)
3. Check "Live Events" or "Recent Events"
4. Trigger events in the app (navigate screens, click buttons)
5. Events should appear in real-time

## Testing Checklist

- [ ] **Development build**: Events tracked and logged
- [ ] **Preview build**: Events tracked and logged
- [ ] **Production build**: Events tracked and logged
- [ ] **TestFlight**: Check logs show Aptabase initialized
- [ ] **TestFlight**: Navigate screens and verify events in dashboard
- [ ] **App Store**: After release, verify events come through

## Debugging Tips

### If events still don't work in production:

1. **Check initialization log**:
   - Should see `[Aptabase] ✅ Initialized with key: A-EU-659...`
   - If not, the key isn't being loaded

2. **Rebuild the app**:
   ```bash
   eas build --profile production --platform ios
   ```
   - Changes to `app.json` extra field require a rebuild
   - OTA updates won't pick up this change

3. **Check EAS environment variables**:
   ```bash
   eas env:list
   ```
   - Ensure `EXPO_PUBLIC_APTABASE_KEY` is set for production

4. **Verify app.json syntax**:
   - The `${EXPO_PUBLIC_APTABASE_KEY}` syntax must be exact
   - No quotes around the variable name

5. **Check expo-constants version**:
   - Ensure `expo-constants` is installed and up to date
   - Should be `~18.0.12` as specified in package.json

## Known Issues

1. **OTA Updates Don't Update app.json**:
   - Changes to `app.json` require a full rebuild
   - Submit a new build to TestFlight/App Store

2. **Environment Variables in app.config.js**:
   - If using `app.config.js` instead of `app.json`, ensure variables are resolved at build time
   - May need to use `eas build` environment variables instead

## Alternative Approaches (if still not working)

### Option 1: Hardcode in app.json
For simplicity, hardcode the key directly in `app.json`:
```json
"extra": {
  "aptabaseKey": "A-EU-6592512622"
}
```

### Option 2: Use EAS Secrets
Store the key as an EAS secret:
```bash
eas secret:create --scope project --name APTABASE_KEY --value "A-EU-6592512622" --type string
```

Then access via:
```typescript
import Constants from 'expo-constants';
const key = Constants.expoConfig?.extra?.APTABASE_KEY;
```

## References

- [Expo Environment Variables](https://docs.expo.dev/guides/environment-variables/)
- [EAS Build Environment Variables](https://docs.expo.dev/build-reference/variables/)
- [expo-constants Documentation](https://docs.expo.dev/versions/latest/sdk/constants/)
- [Aptabase React Native SDK](https://github.com/aptabase/aptabase-react-native)

## Summary

The fix ensures Aptabase analytics work reliably in production by:
1. Adding the key to `app.json` extra field for `Constants` access
2. Using a dual-source approach (Constants + process.env)
3. Adding comprehensive logging for debugging
4. Logging errors instead of silently failing

After rebuilding with these changes, production analytics should work correctly.
