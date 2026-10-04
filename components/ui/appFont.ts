import { StyleSheet, Text, type TextStyle } from 'react-native';

/** Heebo — ניטרלי לעברית. כל משקל הוא קובץ נפרד. */
export const APP_FONT = {
  regular: 'Heebo_400Regular',
  medium: 'Heebo_500Medium',
  semiBold: 'Heebo_600SemiBold',
  bold: 'Heebo_700Bold',
  /** כפתורי CTA — Assistant Bold (עברית, עבה ונקייה יותר מ-Heebo SemiBold) */
  cta: 'Assistant_700Bold',
} as const;

/**
 * תווית כפתור CTA. fontWeight 400 — הקובץ כבר Bold; אחרת המערכת מעבה שוב.
 * fontFamily שאינו Heebo לא נדרס ב-installAppFont.
 */
export const APP_CTA_LABEL_FONT: TextStyle = {
  fontFamily: APP_FONT.cta,
  fontWeight: '400',
};

/** 800 ומעלה נשארים Bold — בלי ExtraBlack. */
export function resolveAppFontFamily(
  fontWeight: TextStyle['fontWeight'] = '400',
): string {
  if (fontWeight === 'bold') return APP_FONT.bold;
  if (fontWeight === 'normal') return APP_FONT.regular;
  const n =
    typeof fontWeight === 'number'
      ? fontWeight
      : parseInt(String(fontWeight), 10);
  if (!Number.isFinite(n) || n < 500) return APP_FONT.regular;
  if (n < 600) return APP_FONT.medium;
  if (n < 700) return APP_FONT.semiBold;
  return APP_FONT.bold;
}

/**
 * כל Text מקבל את קובץ Heebo לפי fontWeight.
 * אחרי הבחירה המשקל חוזר ל-400 כדי שהמערכת לא תעבה שוב קובץ שכבר בולד.
 */
export function installAppFont(): void {
  const text = Text as typeof Text & {
    render?: (props: { style?: TextStyle }, ref: unknown) => unknown;
    __appFont?: boolean;
  };
  if (text.__appFont || typeof text.render !== 'function') return;
  const original = text.render;
  text.render = function render(props, ref) {
    const flat = StyleSheet.flatten(props?.style) ?? {};
    const existing = typeof flat.fontFamily === 'string' ? flat.fontFamily : '';
    if (existing && !existing.startsWith('Heebo')) {
      return original.call(this, props, ref);
    }
    return original.call(this, {
      ...props,
      style: [
        props?.style,
        { fontFamily: resolveAppFontFamily(flat.fontWeight), fontWeight: '400' },
      ],
    }, ref);
  };
  text.__appFont = true;
}
