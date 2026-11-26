import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

/**
 * אנדרואיד: הבחירה מהגלריה עוברת דרך Photo Picker של המערכת, שלא דורש הרשאה.
 * הרשאות READ_MEDIA_* הוסרו מהמניפסט (מדיניות Google Play), לכן לא מבקשים אותן.
 */
const ANDROID_GRANTED = {
  status: 'granted',
  granted: true,
  canAskAgain: true,
  expires: 'never',
  accessPrivileges: 'all',
} as unknown as ImagePicker.MediaLibraryPermissionResponse;

export function requestGalleryPermission(): Promise<ImagePicker.MediaLibraryPermissionResponse> {
  if (Platform.OS === 'android') return Promise.resolve(ANDROID_GRANTED);
  return ImagePicker.requestMediaLibraryPermissionsAsync();
}

export function getGalleryPermission(): Promise<ImagePicker.MediaLibraryPermissionResponse> {
  if (Platform.OS === 'android') return Promise.resolve(ANDROID_GRANTED);
  return ImagePicker.getMediaLibraryPermissionsAsync();
}
