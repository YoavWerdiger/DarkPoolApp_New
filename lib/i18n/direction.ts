/**
 * כיוון הממשק לפי השפה. עברית / ערבית: הערכים המקוריים (RTL) — בלי שינוי.
 * אנגלית: תמונת מראה — כל מה שנבנה «מימין לשמאל» הופך «משמאל לימין».
 *
 * הקוד נכתב בעץ שורש LTR (App.tsx) עם direction:'rtl' מפורש במסכים ו-row-reverse
 * לחיקוי RTL פיזי — לכן באנגלית: rtl→ltr, row-reverse→row, ויישור טקסט מתהפך.
 */
import { getStoredLanguage, isRtlLanguage } from './language';

export const IS_RTL_UI = isRtlLanguage(getStoredLanguage());

/** במקום direction: 'rtl' */
export const UI_DIR: 'rtl' | 'ltr' = IS_RTL_UI ? 'rtl' : 'ltr';
/** במקום flexDirection: 'row-reverse' (שורה שמתחילה מימין בעברית) */
export const ROW_REV: 'row-reverse' | 'row' = IS_RTL_UI ? 'row-reverse' : 'row';
/** במקום textAlign: 'right' — צד תחילת הקריאה */
export const TEXT_START: 'right' | 'left' = IS_RTL_UI ? 'right' : 'left';
/** במקום textAlign: 'left' — הצד הנגדי */
export const TEXT_END: 'left' | 'right' = IS_RTL_UI ? 'left' : 'right';

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
