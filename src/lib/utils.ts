// src/lib/fsSet.ts
import { db } from "@/services/firebase/firebase-config";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

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
  const ref = doc(db, ...path);

  // Remove undefined fields before writing to Firestore
  const cleanedData = removeUndefinedFields(data);

  const payload = addTimestamps
    ? {
        createdAt: (data as any).createdAt ?? serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...cleanedData,
      }
    : cleanedData;

  await setDoc(ref, payload, { merge });
  return ref;
}
