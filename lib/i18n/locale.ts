/** לוקאל לפורמט תאריכים / מספרים לפי שפת הממשק (Intl / toLocaleDateString) */
import { getStoredLanguage, type AppLanguage } from './language';

/**
 * ערבית: 'ar-u-nu-latn' — שמות חודשים/ימים בערבית אבל ספרות לטיניות (0-9), בעקביות עם
 * מחירים וטיקרים בשאר האפליקציה. בלי אזור (ar-SA וכו') כדי לא לקבל לוח שנה הג'רי כברירת מחדל.
 * מנוע Intl שלא מכיר את ההרחבה ‎-u-nu-latn מתעלם ממנה (נופל ל-'ar') ולא זורק שגיאה —
 * במקרה הגרוע: ספרות ערביות-הודיות (٠١٢) במכשירים עם ICU ישן.
 */
const LOCALES = {
  he: 'he-IL',
  en: 'en-US',
  ar: 'ar-u-nu-latn',
} as const satisfies Record<AppLanguage, string>;

export type AppLocale = (typeof LOCALES)[AppLanguage];

const LOCALE: AppLocale = LOCALES[getStoredLanguage()];

/** השפה לא משתנה בלי טעינה מחדש של האפליקציה — ערך קבוע מספיק */
export function appLocale(): AppLocale {
  return LOCALE;
}
