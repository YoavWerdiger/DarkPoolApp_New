import { Linking, Platform } from 'react-native';
import { Audio } from './expoAvSafe';
import { showAppDialog } from '../utils/appDialog';

/**
 * סשן אודיו למצלמה: המצלמה (mode="video") פותחת גם מיקרופון. כשסשן האודיו של iOS במצב
 * «ניגון בלבד» (ChatMessage / נגן הסטורי קובעים allowsRecordingIOS:false) — סשן הצילום נקטע
 * והתצוגה נתקעת על הפריים הראשון. לפני שמרכיבים CameraView מאפשרים הקלטה, וביציאה מחזירים.
 */
export async function enterCameraAudioSession(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
  } catch {
    /* best effort — לא חוסמים את המצלמה */
  }
}

export async function exitCameraAudioSession(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
  } catch {
    /* best effort */
  }
}

export function openAppSettings(): void {
  if (Platform.OS === 'ios') void Linking.openURL('app-settings:');
  else void Linking.openSettings();
}

/**
 * הרשאה חסומה (המערכת כבר לא תשאל שוב) — דיאלוג של האפליקציה שמפנה להגדרות,
 * כמו בהתראות. kind: מצלמה / מיקרופון / גלריה.
 */
export async function promptPermissionSettings(kind: 'camera' | 'microphone' | 'photos'): Promise<void> {
  const what = kind === 'camera' ? 'למצלמה' : kind === 'microphone' ? 'למיקרופון' : 'לתמונות';
  const idx = await showAppDialog({
    title: `אין גישה ${what}`,
    message: `הגישה ${what} חסומה. אפשר אותה בהגדרות המכשיר כדי להמשיך.`,
    type: 'warning',
    buttons: [
      { text: 'פתח הגדרות', style: 'default' },
      { text: 'ביטול', style: 'cancel' },
    ],
  });
  if (idx === 0) openAppSettings();
}

/**
 * מבקש הרשאה; אם נדחתה ואי אפשר לשאול שוב — דיאלוג «פתח הגדרות».
 * request: הפונקציה של ה-hook (useCameraPermissions / useMicrophonePermissions וכו׳).
 */
export async function ensurePermissionOrSettings(
  current: { granted: boolean; canAskAgain?: boolean } | null | undefined,
  request: () => Promise<{ granted: boolean; canAskAgain?: boolean }>,
  kind: 'camera' | 'microphone' | 'photos',
): Promise<boolean> {
  if (current?.granted) return true;
  if (current && current.canAskAgain === false) {
    await promptPermissionSettings(kind);
    return false;
  }
  const next = await request();
  if (next.granted) return true;
  if (next.canAskAgain === false) await promptPermissionSettings(kind);
  return false;
}
