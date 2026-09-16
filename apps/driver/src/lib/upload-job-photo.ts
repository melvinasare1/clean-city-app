import { getDownloadURL, ref, storage, uploadBytes } from '@platform/shared-firebase';

function storagePathForJobPhoto(jobId: string, driverId: string): string {
  return `job-photos/${jobId}/${driverId}.jpg`;
}

export async function uploadJobPhoto(
  jobId: string,
  driverId: string,
  localUri: string
): Promise<string> {
  const response = await fetch(localUri);
  const blob = await response.blob();
  const storageRef = ref(storage, storagePathForJobPhoto(jobId, driverId));
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
  return getDownloadURL(storageRef);
}
