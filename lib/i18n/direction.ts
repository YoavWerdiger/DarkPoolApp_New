/**
 * כיוון הממשק לפי השפה. עברית / ערבית: הערכים המקוריים (RTL) — בלי שינוי.
 * אנגלית: תמונת מראה — כל מה שנבנה «מימין לשמאל» הופך «משמאל לימין».
 *
 * הקוד נכתב בעץ שורש LTR (App.tsx) עם direction:'rtl' מפורש במסכים ו-row-reverse
 * לחיקוי RTL פיזי — לכן באנגלית: rtl→ltr, row-reverse→row, ויישור טקסט מתהפך.
 */
import { getStoredLanguage, isRtlLanguage } from './language';

export const IS_RTL_UI = isRtlLanguage(getStoredLanguage());

/**
 * שורש האפליקציה: הקוד בנוי על שורש LTR עם סדר «פיזי» לעברית — באנגלית השורש RTL,
 * וכך כל שורה / שוליים / מיקום מוחלט שנבנו פיזית מתהפכים אוטומטית (תמונת מראה מדויקת).
 */
export const ROOT_DIR: 'ltr' | 'rtl' = IS_RTL_UI ? 'ltr' : 'rtl';
/** במקום direction: 'rtl' */
export const UI_DIR: 'rtl' | 'ltr' = IS_RTL_UI ? 'rtl' : 'ltr';

const MIRROR_ICON: Record<string, string> = {
  'chevron-forward': 'chevron-back',
  'chevron-back': 'chevron-forward',
  'chevron-forward-outline': 'chevron-back-outline',
  'chevron-back-outline': 'chevron-forward-outline',
  'chevron-forward-circle': 'chevron-back-circle',
  'chevron-back-circle': 'chevron-forward-circle',
  'arrow-forward': 'arrow-back',
  'arrow-back': 'arrow-forward',
  'arrow-forward-outline': 'arrow-back-outline',
  'arrow-back-outline': 'arrow-forward-outline',
  'chevron-left': 'chevron-right',
  'chevron-right': 'chevron-left',
  'arrow-left': 'arrow-right',
  'arrow-right': 'arrow-left',
};

/** שם אייקון כיווני (Ionicons / Feather) — באנגלית מתהפך */
export function dirIcon<T extends string>(name: T): T {
  return (IS_RTL_UI ? name : ((MIRROR_ICON[name] as T | undefined) ?? name)) as T;
}
