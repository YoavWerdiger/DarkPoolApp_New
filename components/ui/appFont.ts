import type { TextStyle } from 'react-native';
import { APP_FONT_FAMILY, resolveAppFontFamily as resolveFamily } from './appFontFamily';

/** Heebo — ניטרלי לעברית. כל משקל הוא קובץ נפרד. */
export const APP_FONT = {
  ...APP_FONT_FAMILY,
  /** כפתורי CTA — Assistant SemiBold */
  cta: 'Assistant_600SemiBold',
} as const;

/**
 * תווית כפתור CTA. fontWeight 400 — המשקל כבר בקובץ; אחרת המערכת מעבה שוב.
 * fontFamily שאינו Heebo לא נדרס ב-installAppFont.
 */
export const APP_CTA_LABEL_FONT: TextStyle = {
  fontFamily: APP_FONT.cta,
  fontWeight: '400',
};

/** 800 ומעלה נשארים Bold — בלי ExtraBlack. */
export function resolveAppFontFamily(fontWeight: TextStyle['fontWeight'] = '400'): string {
  return resolveFamily(fontWeight);
}

/**
 * היסטורי: הדביק Text.render — לא קיים ב-RN 0.86 (Text הוא קומפוננטת פונקציה), ולכן לא עשה כלום.
 * היום Heebo מוחל גלובלית דרך metro.config.js → components/ui/appText.tsx. נשאר כ-no-op לתאימות.
 */
export function installAppFont(): void {}
