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

/**
 * בעלייה (index.ts): פריסת הממשק נשארת RTL בכל השפות — רק הטקסט מתורגם
 * (החלטת מוצר: אותו מבנה מסכים, בלי היפוך פריסה באנגלית).
 */
export function applyLanguageDirection(_lang: AppLanguage): void {
  try {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
  } catch {
    /* סביבות ישנות — לא לשבור את האתחול */
  }
}

/**
 * כיוון כתיבה של טקסט (bidi) לפי השפה — הפריסה עצמה לא משתנה.
 * אנגלית: 'auto' (לפי התו הראשון) — מחרוזות ממשק באנגלית יוצאות LTR, ותוכן בעברית
 * (שמות, הודעות, ציוצים) נשאר RTL; 'ltr' קשיח הפך שמות עבריים.
 */
export const TEXT_DIR: 'rtl' | 'ltr' | 'auto' = getStoredLanguage() === 'en' ? 'auto' : 'rtl';

/**
 * החלפת שפה: שומר ומאתחל את האפליקציה — תוויות שמחושבות פעם אחת (קבועים ברמת מודול)
 * מתעדכנות רק בטעינה מחדש.
 */
export async function changeLanguage(lang: AppLanguage): Promise<void> {
  await SecureStore.setItemAsync(KEY, lang);
  applyLanguageDirection(lang);
  await reloadAppAsync('language changed');
}
