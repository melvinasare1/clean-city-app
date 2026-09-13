import Constants from 'expo-constants';

export function resolveGooglePlacesApiKey(): string {
  const extra = Constants.expoConfig?.extra?.googlePlacesApiKey;
  const fromEnv = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
  for (const value of [fromEnv, extra]) {
    if (typeof value === 'string' && value.length > 0 && !value.includes('${')) {
      return value;
    }
  }
  return '';
}
