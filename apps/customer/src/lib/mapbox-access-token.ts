import Constants from 'expo-constants';

export function resolveMapboxToken(): string {
  const extra = Constants.expoConfig?.extra?.mapboxAccessToken;
  const fromEnv = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
  for (const value of [fromEnv, extra]) {
    if (typeof value === 'string' && value.length > 0 && !value.includes('${')) {
      return value;
    }
  }
  return '';
}
