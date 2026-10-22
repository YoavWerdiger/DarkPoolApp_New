/**
 * בחירת קובץ Heebo לפי fontWeight — טהור, בלי import מ-react-native
 * (נטען גם מתוך עוטף ה-Text הגלובלי; import של Text מכאן היה יוצר מעגל).
 */
export const APP_FONT_FAMILY = {
  regular: 'Heebo_400Regular',
  medium: 'Heebo_500Medium',
  semiBold: 'Heebo_600SemiBold',
  bold: 'Heebo_700Bold',
} as const;

/** 800 ומעלה נשארים Bold — בלי ExtraBlack. */
export function resolveAppFontFamily(fontWeight: unknown = '400'): string {
  if (fontWeight === 'bold') return APP_FONT_FAMILY.bold;
  if (fontWeight === 'normal' || fontWeight == null) return APP_FONT_FAMILY.regular;
  const n = typeof fontWeight === 'number' ? fontWeight : parseInt(String(fontWeight), 10);
  if (!Number.isFinite(n) || n < 500) return APP_FONT_FAMILY.regular;
  if (n < 600) return APP_FONT_FAMILY.medium;
  if (n < 700) return APP_FONT_FAMILY.semiBold;
  return APP_FONT_FAMILY.bold;
}
