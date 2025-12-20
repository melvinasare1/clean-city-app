// src/lib/fsSet.ts
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - native-only module types
import firestore from "@react-native-firebase/firestore";

export const PROFILES_COLLECTION = "profiles";

function removeUndefinedFields<T extends Record<string, any>>(
  obj: T
): Partial<T> {
  const cleaned: any = {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      cleaned[key] = obj[key];
    }
  }
  return cleaned;
}

export async function setDocAtPath<T extends Record<string, any>>(
  path: [string, string] | [string, string, ...string[]],
  data: T,
  options?: { merge?: boolean; addTimestamps?: boolean }
) {
  const { merge = true, addTimestamps = true } = options ?? {};
  const ref = firestore().doc(path.join("/"));

  // Remove undefined fields before writing to Firestore
  const cleanedData = removeUndefinedFields(data);

  const payload = addTimestamps
    ? {
        createdAt:
          (data as any).createdAt ?? firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
        ...cleanedData,
      }
    : cleanedData;

  if (merge) {
    await ref.set(payload, { merge: true });
  } else {
    await ref.set(payload);
  }
  return ref;
}
