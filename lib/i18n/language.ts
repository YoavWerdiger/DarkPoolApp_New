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
  // פיתוח בלבד: EXPO_PUBLIC_UI_LANG=en|ar|he — לבדיקות על סימולטור בלי לגעת בהגדרה השמורה
  const devOverride = __DEV__ ? process.env.EXPO_PUBLIC_UI_LANG : undefined;
  if (isAppLanguage(devOverride)) return devOverride;
  try {
    const stored = SecureStore.getItem(KEY);
    return isAppLanguage(stored) ? stored : 'he';
  } catch {
    return 'he';
  }
}

/**
 * בעלייה (index.ts): RTL גלובלי בכל השפות (אותם דגלי RN כמו בעברית — כולל החלפת שמאל/ימין).
 * באנגלית המראה נוצרת מהיפוך הכיוונים בעץ (ROOT_DIR / UI_DIR ב-lib/i18n/direction):
 * Yoga סימטרי לכיוון, ולכן כל צומת שכיוונו התהפך מצויר כתמונת מראה מדויקת.
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
 * עברית / ערבית: 'rtl'.
 * אנגלית: 'auto' (לפי התו הראשון) — מחרוזות ממשק באנגלית יוצאות LTR, ותוכן בעברית
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
