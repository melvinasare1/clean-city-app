import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@platform/shared-firebase';
import {
  DRIVER_LOCATION_TASK,
  getTrackedDriverId,
  writeDriverLocation,
} from './driver-background-location';
import { loadTaskManager } from './load-task-manager';

type LocationTaskPayload = {
  locations?: Array<{
    coords: { latitude: number; longitude: number };
  }>;
};

function waitForAuthUid(timeoutMs = 8_000): Promise<string | null> {
  if (auth.currentUser?.uid) {
    return Promise.resolve(auth.currentUser.uid);
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      resolve(auth.currentUser?.uid ?? null);
    }, timeoutMs);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      clearTimeout(timeout);
      unsubscribe();
      resolve(user?.uid ?? null);
    });
  });
}

const TaskManager = loadTaskManager();
if (TaskManager) {
  TaskManager.defineTask(DRIVER_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      console.error('[driver-background-location] task error', error.message);
      return;
    }

    const locations = (data as LocationTaskPayload | undefined)?.locations;
    const latest = locations?.[locations.length - 1];
    if (!latest) return;

    const driverId = await getTrackedDriverId();
    if (!driverId) return;

    const uid = await waitForAuthUid();
    if (!uid || uid !== driverId) return;

    try {
      await writeDriverLocation(driverId, latest.coords.latitude, latest.coords.longitude);
    } catch (writeError) {
      console.error('[driver-background-location] RTDB write failed', writeError);
    }
  });
}
