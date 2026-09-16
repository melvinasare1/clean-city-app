import { getDownloadURL, ref, storage, uploadBytes } from '@platform/shared-firebase';

function storagePathForJobPhoto(
  jobId: string,
  driverId: string,
  kind: 'pickup' | 'missed' = 'pickup'
): string {
  const fileName = kind === 'missed' ? `${driverId}-missed.jpg` : `${driverId}.jpg`;
  return `job-photos/${jobId}/${fileName}`;
}

export async function uploadJobPhoto(
  jobId: string,
  driverId: string,
  localUri: string,
  kind: 'pickup' | 'missed' = 'pickup'
): Promise<string> {
  const response = await fetch(localUri);
  const blob = await response.blob();
  const storageRef = ref(storage, storagePathForJobPhoto(jobId, driverId, kind));
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
  return getDownloadURL(storageRef);
}
