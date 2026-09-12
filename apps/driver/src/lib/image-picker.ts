import { Alert } from 'react-native';

type ImagePickerModule = typeof import('expo-image-picker');

let cached: ImagePickerModule | null = null;

function isMissingNativeModule(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /cannot find native module|exponentimagepicker/i.test(message);
}

export async function loadImagePicker(): Promise<ImagePickerModule | null> {
  if (cached) return cached;
  try {
    cached = await import('expo-image-picker');
    return cached;
  } catch (error) {
    if (isMissingNativeModule(error)) {
      Alert.alert(
        'Rebuild required',
        'Photo picker needs a new native driver build. Run an iOS development build after installing expo-image-picker, then install that build on this device.'
      );
      return null;
    }
    throw error;
  }
}
