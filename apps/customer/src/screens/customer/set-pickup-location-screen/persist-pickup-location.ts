import { setDocAtPath } from '@/lib/utils';
import type { PickupCoordinates } from '@/lib/profile-location';

export async function persistPickupLocationToProfile(
  userId: string,
  address: string,
  location: PickupCoordinates
): Promise<void> {
  await setDocAtPath(
    ['profiles', userId],
    {
      address,
      location: { lat: location.lat, lng: location.lng },
    },
    { merge: true, addTimestamps: false }
  );
}
