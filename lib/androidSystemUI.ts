import { Platform } from 'react-native';
import { setStatusBarStyle } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import * as SystemUI from 'expo-system-ui';

/** רקע מסך כהה מותגי — חייב להתאים ל־DesignTokens.colors.background.primary */
export const APP_SYSTEM_BACKGROUND = '#0A0E0A';

/**
 * תצורת StatusBar + NavigationBar + רקע שורש לאנדרואיד edge-to-edge.
 * עם edge-to-edge צבעי background של StatusBar/NavigationBar נדחים;
 * נשארים style (אייקונים בהירים) ורקע החלון/שורש.
 */
export async function applyAppSystemUI(): Promise<void> {
  if (Platform.OS !== 'android') return;

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
