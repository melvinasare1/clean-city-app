import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * iOS/Android-restricted Google keys reject REST calls that omit the app id
 * ("Requests from this iOS client application <empty> are blocked").
 * Native Maps SDK sends this automatically; fetch() does not.
 */
export function googleAppRestrictionHeaders(): Record<string, string> {
  if (Platform.OS === 'ios') {
    return {
      'X-Ios-Bundle-Identifier':
        Constants.expoConfig?.ios?.bundleIdentifier || 'com.cleancity.app',
    };
  }
  if (Platform.OS === 'android') {
    return {
      'X-Android-Package':
        Constants.expoConfig?.android?.package || 'com.cleancity.app',
    };
  }
  return {};
}

export function googlePlacesHeaders(
  apiKey: string,
  fieldMask: string
): Record<string, string> {
  return {
    'X-Goog-Api-Key': apiKey,
    'X-Goog-FieldMask': fieldMask,
    ...googleAppRestrictionHeaders(),
  };
}
