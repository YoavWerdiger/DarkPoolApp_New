import { Platform } from 'react-native';
import { setStatusBarStyle } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import * as SystemUI from 'expo-system-ui';
import { SoftUI } from '../components/ui/softUiPalette';
import { LIGHT_CANVAS } from '../components/ui/designTokensStatic';

/** קנבס שורש — Soft UI warm charcoal (docs/DARKPOOL_DESIGN_DIRECTION.md). */
export const APP_SYSTEM_BACKGROUND = SoftUI.canvas;

/** נשמר כדי שסגירת שיט/דיאלוג תחזיר את מצב המערכת הנוכחי, לא תמיד כהה. */
let systemMode: 'dark' | 'light' = 'dark';

/**
 * תצורת StatusBar + NavigationBar + רקע שורש לאנדרואיד edge-to-edge.
 * עם edge-to-edge צבעי background של StatusBar/NavigationBar נדחים;
 * נשארים style (אייקונים בהירים) ורקע החלון/שורש.
 * בלי ארגומנט — מחילים את המצב האחרון (ברירת מחדל כהה).
 */
export async function applyAppSystemUI(mode?: 'dark' | 'light'): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (mode) systemMode = mode;

  if (systemMode === 'light') {
    setStatusBarStyle('dark');
    try {
      await SystemUI.setBackgroundColorAsync(LIGHT_CANVAS);
    } catch {
      // non-critical
    }
    try {
      NavigationBar.setStyle('dark');
    } catch {
      // non-critical
    }
    return;
  }

  setStatusBarStyle('light');

  try {
    await SystemUI.setBackgroundColorAsync(APP_SYSTEM_BACKGROUND);
  } catch {
    // non-critical
  }

  try {
    // עובד גם ב־edge-to-edge (בניגוד ל־setBackgroundColorAsync שמוחרג)
    NavigationBar.setStyle('dark');
  } catch {
    // non-critical
  }
}
