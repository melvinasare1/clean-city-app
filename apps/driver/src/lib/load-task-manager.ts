import { Platform } from 'react-native';

type TaskManagerModule = typeof import('expo-task-manager');

let cached: TaskManagerModule | null | undefined;

/**
 * `expo-task-manager` is a native module. An older dev client throws
 * "Cannot find native module 'ExpoTaskManager'" at require-time.
 */
export function loadTaskManager(): TaskManagerModule | null {
  if (Platform.OS === 'web') return null;
  if (cached !== undefined) return cached;
  try {
    // Lazy require so a missing native binary does not crash app startup.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-task-manager') as TaskManagerModule;
    return cached;
  } catch (error) {
    cached = null;
    console.warn(
      '[driver-background-location] ExpoTaskManager is not in this native build. Rebuild the driver dev client (expo run:ios / eas build --profile development) to enable background location.',
      error
    );
    return null;
  }
}
