/**
 * שפת הממשק — נשמרת ב-SecureStore (קריאה סינכרונית בעלייה, לפני הרינדור הראשון)
 * כדי שכיוון ה-RTL/LTR ייקבע נכון כבר מהפריים הראשון. ברירת מחדל: עברית.
 */
import * as SecureStore from 'expo-secure-store';
import { I18nManager } from 'react-native';
import { reloadAppAsync } from 'expo';

export type AppLanguage = 'he' | 'en';

const KEY = 'app_ui_language';

export function isRtlLanguage(lang: AppLanguage): boolean {
  return lang === 'he';
}

export function getStoredLanguage(): AppLanguage {
  try {
    return SecureStore.getItem(KEY) === 'en' ? 'en' : 'he';
  } catch {
    return 'he';
  }
}

/** בעלייה (index.ts): מיישר את כיוון הממשק לשפה השמורה */
export function applyLanguageDirection(lang: AppLanguage): void {
  const rtl = isRtlLanguage(lang);
  try {
    I18nManager.allowRTL(rtl);
    I18nManager.forceRTL(rtl);
  } catch {
    /* סביבות ישנות — לא לשבור את האתחול */
  }
}

/**
 * החלפת שפה: שומר, מעדכן כיוון ומאתחל את האפליקציה —
 * שינוי RTL↔LTR נכנס לתוקף רק אחרי טעינה מחדש של ה-JS.
 */
export async function changeLanguage(lang: AppLanguage): Promise<void> {
  await SecureStore.setItemAsync(KEY, lang);
  applyLanguageDirection(lang);
  await reloadAppAsync('language changed');
}
