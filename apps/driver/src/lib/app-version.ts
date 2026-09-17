import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

export function getAppVersion(): string {
  const version =
    Constants.expoConfig?.version ?? Constants.nativeApplicationVersion;
  return version?.trim() || '1.0.0';
}

export function isHotfixRelease(): boolean {
  if (Constants.expoConfig?.extra?.releaseKind === 'hotfix') return true;
  return Updates.isEnabled === true && Updates.isEmbeddedLaunch === false;
}

/** User-facing label, e.g. "Hotfix 1.0.1" or "1.0.0". */
export function getAppVersionLabel(): string {
  const version = getAppVersion();
  return isHotfixRelease() ? `Hotfix ${version}` : version;
}
