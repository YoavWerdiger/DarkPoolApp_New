/**
 * i18n — עברית (ברירת מחדל), אנגלית וערבית. אתחול סינכרוני (initAsync: false) כדי שהתרגומים
 * זמינים כבר ברינדור הראשון. מפתח חסר באנגלית/ערבית → נופל לעברית (fallbackLng).
 *
 * שימוש: const { t } = useTranslation(); t('settings.title')
 * מחוץ לקומפוננטה: import i18n from '../lib/i18n'; i18n.t('...')
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import he from './locales/he';
import en from './locales/en';
import ar from './locales/ar';
import { getStoredLanguage } from './language';

export { APP_LANGUAGES, changeLanguage, getStoredLanguage, isRtlLanguage, type AppLanguage } from './language';

void i18n.use(initReactI18next).init({
  resources: { he: { translation: he }, en: { translation: en }, ar: { translation: ar } },
  lng: getStoredLanguage(),
  fallbackLng: 'he',
  initAsync: false,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
