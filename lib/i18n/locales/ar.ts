/**
 * العربية (فصحى معاصرة) — same structure as he.ts (TypeScript enforces it; missing keys fall back to Hebrew).
 *
 * Arabic has six plural categories in i18next: _zero, _one, _two, _few, _many, _other.
 * For every `x_other` key in he.ts, this file may (and should) also define x_zero / x_two / x_few / x_many.
 * Digits stay Latin (0-9) across the app — don't write Arabic-Indic digits (٠١٢) here.
 */
import type { Translation } from './he';

type ArabicPluralExtras<T> = {
  [K in keyof T as K extends `${infer Base}_other` ? `${Base}_${'zero' | 'two' | 'few' | 'many'}` : never]?: string;
};

type ArabicTranslation<T> = {
  [K in keyof T]?: T[K] extends object ? ArabicTranslation<T[K]> : string;
} & ArabicPluralExtras<T>;

const ar: ArabicTranslation<Translation> = {
  common: {
    cancel: 'إلغاء',
    save: 'حفظ',
    close: 'إغلاق',
    error: 'خطأ',
    success: 'تمّ بنجاح',
    cancelled: 'تمّ الإلغاء',
    loading: 'جارٍ التحميل...',
    user: 'مستخدم',
    clear: 'مسح',
  },
  drawer: {
    chat: 'المجتمع',
    courses: 'الأكاديمية',
    portfolios: 'سجلّ التداول',
    darkPool: 'صفقات المطّلعين',
    news: 'الأخبار',
    tweets: 'التغريدات',
    earnings: 'نتائج الأرباح',
    calendar: 'التقويم الاقتصادي',
    watchlist: 'قائمة المراقبة',
    heatmap: 'الخريطة الحرارية',
    savedArticles: 'المقالات المحفوظة',
    member: 'عضو في المجتمع',
    memberSince: 'عضو منذ {{date}}',
  },
  settings: {
    title: 'الإعدادات',
    appearance: 'المظهر',
    darkMode: 'الوضع الداكن',
    language: 'اللغة',
    interfaceLanguage: 'لغة التطبيق',
    languageName: 'العربية',
    changeLanguageTitle: 'لغة التطبيق',
    changeLanguageBody: 'سيُعاد تشغيل التطبيق لتغيير اللغة.',
    languageNames: {
      he: 'עברית',
      en: 'English',
      ar: 'العربية',
    },
    billingSection: 'الاشتراك والفوترة',
    billing: 'الاشتراك والمدفوعات والفواتير',
    security: 'الأمان',
    biometric: 'المصادقة البيومترية',
    advanced: 'إعدادات متقدمة',
    clearCache: 'مسح الذاكرة المؤقتة',
    about: 'حول التطبيق',
    aboutTitle: 'حول',
    aboutBody: 'DarkPool App\nالإصدار {{version}}\n\n© {{year}} DarkPool',
    versionLine: 'DarkPool App · الإصدار {{version}}',
    clearCacheConfirm: 'هل أنت متأكد من رغبتك في حذف جميع البيانات المؤقتة؟ لن يؤدي ذلك إلى حذف معلوماتك الشخصية.',
    clearCacheDone_zero: 'لم يُمسح أي عنصر من الذاكرة المؤقتة',
    clearCacheDone_one: 'تمّ مسح عنصر واحد من الذاكرة المؤقتة',
    clearCacheDone_two: 'تمّ مسح عنصرين من الذاكرة المؤقتة',
    clearCacheDone_few: 'تمّ مسح {{count}} عناصر من الذاكرة المؤقتة',
    clearCacheDone_many: 'تمّ مسح {{count}} عنصرًا من الذاكرة المؤقتة',
    clearCacheDone_other: 'تمّ مسح {{count}} عنصر من الذاكرة المؤقتة',
    clearCacheNothing: 'لا توجد بيانات مؤقتة لمسحها',
    clearCacheError: 'تعذّر مسح الذاكرة المؤقتة',
    biometricUnsupported: 'جهازك لا يدعم المصادقة البيومترية',
    biometricNotEnrolled: 'لم يتم إعداد المصادقة البيومترية على هذا الجهاز. يُرجى إعداد Face ID أو Touch ID من إعدادات الجهاز',
    biometricPrompt: 'تحقّق من هويتك',
    biometricEnabled: 'تمّ تفعيل المصادقة البيومترية',
    biometricCancelled: 'تمّ إلغاء المصادقة البيومترية',
    biometricError: 'تعذّر تفعيل المصادقة البيومترية',
  },
};

export default ar;
