/** לוקאל לפורמט תאריכים / מספרים לפי שפת הממשק (Intl / toLocaleDateString) */
import { getStoredLanguage } from './language';

const LOCALE = getStoredLanguage() === 'en' ? 'en-US' : 'he-IL';

/** השפה לא משתנה בלי טעינה מחדש של האפליקציה — ערך קבוע מספיק */
export function appLocale(): 'he-IL' | 'en-US' {
  return LOCALE;
}
