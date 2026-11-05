/**
 * שפת הממשק — נשמרת ב-SecureStore (קריאה סינכרונית בעלייה, לפני הרינדור הראשון)
 * כדי שכיוון ה-RTL/LTR ייקבע נכון כבר מהפריים הראשון. ברירת מחדל: עברית.
 * שפות נתמכות: עברית (he), אנגלית (en), ערבית (ar).
 */
import * as SecureStore from 'expo-secure-store';
import { I18nManager } from 'react-native';
import { reloadAppAsync } from 'expo';

export type AppLanguage = 'he' | 'en' | 'ar';

/** סדר הצגה בבורר השפה */
export const APP_LANGUAGES: readonly AppLanguage[] = ['he', 'en', 'ar'];

const KEY = 'app_ui_language';

export function isAppLanguage(value: unknown): value is AppLanguage {
  return value === 'he' || value === 'en' || value === 'ar';
}

export function isRtlLanguage(lang: AppLanguage): boolean {
  return lang === 'he' || lang === 'ar';
}

export function getStoredLanguage(): AppLanguage {
  try {
    const stored = SecureStore.getItem(KEY);
    return isAppLanguage(stored) ? stored : 'he';
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
 * כיוון כתיבה של טקסט (bidi) לפי השפה.
 * עברית/ערבית: 'rtl'. אנגלית: 'auto' (לפי התו הראשון) — מחרוזות באנגלית יוצאות LTR ותוכן בעברית
 * (שמות, הודעות, ציוצים) נשאר RTL; 'ltr' קשיח הפך שמות עבריים.
 */
export const TEXT_DIR: 'rtl' | 'ltr' | 'auto' = isRtlLanguage(getStoredLanguage()) ? 'rtl' : 'auto';

/**
 * החלפת שפה: שומר ומאתחל את האפליקציה — תוויות שמחושבות פעם אחת (קבועים ברמת מודול)
 * מתעדכנות רק בטעינה מחדש.
 */
export async function changeLanguage(lang: AppLanguage): Promise<void> {
  await SecureStore.setItemAsync(KEY, lang);
  applyLanguageDirection(lang);
  await reloadAppAsync('language changed');
}
