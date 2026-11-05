import i18n from './i18n';
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
  const what = kind === 'camera' ? i18n.t('auto.lib__cameraSession.s1') : kind === 'microphone' ? i18n.t('auto.lib__cameraSession.s2') : i18n.t('auto.lib__cameraSession.s3');
  const idx = await showAppDialog({
    title: i18n.t('auto.lib__cameraSession.s4', { v0: what }),
    message: i18n.t('auto.lib__cameraSession.s5', { v0: what }),
    type: 'warning',
    buttons: [
      { text: i18n.t('auto.lib__cameraSession.s6'), style: 'default' },
      { text: i18n.t('auto.lib__cameraSession.s7'), style: 'cancel' },
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

/**
 * גישה למצלמה בדיאלוג לפי הטופו (במקום מסך «אפשר מצלמה»): קודם דיאלוג של האפליקציה,
 * ורק באישור — בקשת ההרשאה של המערכת (או «פתח הגדרות» אם נחסמה).
 */
export async function requestCameraWithDialog(
  current: { granted: boolean; canAskAgain?: boolean } | null | undefined,
  request: () => Promise<{ granted: boolean; canAskAgain?: boolean }>,
): Promise<boolean> {
  if (current?.granted) return true;
  const choice = await showAppDialog({
    title: i18n.t('auto.lib__cameraSession.s8'),
    message: i18n.t('auto.lib__cameraSession.s9'),
    type: 'info',
    buttons: [
      { text: i18n.t('auto.lib__cameraSession.s10'), style: 'default' },
      { text: i18n.t('auto.lib__cameraSession.s11'), style: 'cancel' },
    ],
  });
  if (choice !== 0) return false;
  return ensurePermissionOrSettings(current, request, 'camera');
}
