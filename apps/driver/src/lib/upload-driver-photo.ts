import {
  doc,
  getDownloadURL,
  ref,
  serverTimestamp,
  storage,
  updateDoc,
  uploadBytes,
  db,
} from '@platform/shared-firebase';

function storagePathForDriver(uid: string): string {
  return `driver-photos/${uid}.jpg`;
}

export async function uploadDriverPhoto(uid: string, localUri: string): Promise<string> {
  const response = await fetch(localUri);
  if (!response.ok) {
    throw new Error('Could not read the selected photo.');
  }
  const blob = await response.blob();
  const storageRef = ref(storage, storagePathForDriver(uid));
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
  const photoURL = await getDownloadURL(storageRef);
  await updateDoc(doc(db, 'drivers', uid), {
    photoURL,
    updatedAt: serverTimestamp(),
  });
  return photoURL;
}
