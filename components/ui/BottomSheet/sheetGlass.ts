import { Platform } from 'react-native';
import { DesignTokens } from '../DesignTokens';

/**
 * טוקני זכוכית אחידים לכל BottomSheet / ChatBottomSheet.
 * משטח = SwiftUI thin material: Blur + overlay לבן דק + highlight.
 * אותה שפה ב-iOS וב-Android — לא מילוי אטום (#262626) שחונק את ה-BlurView.
 */
/**
 * הזכוכית נשארת דולקת אחרי mount ראשון — גם ב-drag וגם בסגירה.
 * רק ה-backdrop (החושך מאחור) זז עם progress; גוף השיט לא עושה fade.
 */
export function latchSheetGlass(alreadyShown: boolean, canMount: boolean): boolean {
  return alreadyShown || canMount;
}

/**
 * Blur עולה רק אחרי layout + סיום ה־defer של הפתיחה.
 * alreadyShown נשאר דולק — אין כיבוי באמצע drag/סגירה.
 */
export function canLatchSheetGlass(
  alreadyShown: boolean,
  active: boolean,
  hasLayout: boolean,
  deferDone: boolean,
): boolean {
  return latchSheetGlass(alreadyShown, active && hasLayout && deferDone);
}

/** Dim מאחורי השיט — חזק מספיק שתוכן האפליקציה יישב ברור "מתחת". */
export const SHEET_BACKDROP_OPACITY = 0.58;

/** כמו UICard glassIntensity="light" → ~48 */
export const SHEET_GLASS_INTENSITY = DesignTokens.glassmorphism.blurIntensity.light;

/**
 * Tint מעל BlurView — כמו UICard dark + light (לבן שקוף־למחצה).
 * חייב להישאר rgba: ערך אטום מסתיר את ה-BlurView והשיט נראה שטוח.
 */
export const SHEET_GLASS_OVERLAY = DesignTokens.glassmorphism.cardBackground.dark.light;

/**
 * רצפה שקופה־למחצה מתחת ל-overlay כשאין BlurView (לפני mount / Android ישן).
 * לא #262626 — האורורה נשארת גלויה מאחורי ה-tint.
 */
export const SHEET_GLASS_BASE = DesignTokens.glassmorphism.baseFill.dark;

/**
 * גוון המשטח הסופי — לרצועת system bar ולשיטים בלי זכוכית. חייב להיות אטום.
 */
export const SHEET_GLASS_FLOOR = DesignTokens.colors.background.cardSolid;

/** פס גרירה — capsule אטום, ללא מסגרת זכוכית. */
export const SHEET_HANDLE_WIDTH = 36;
export const SHEET_HANDLE_HEIGHT = 5;
export const SHEET_HANDLE_BORDER_RADIUS = SHEET_HANDLE_HEIGHT / 2;
/** מילוי solid — אפור בהיר (secondary / SoftUI.textSecondary), משותף לכל השיטים. */
export const SHEET_HANDLE_FILL = DesignTokens.colors.text.secondary;

/**
 * BlurView tint כהה דק — אותו tint ב-iOS וב-Android.
 */
export const SHEET_GLASS_TINT = 'systemThinMaterialDark' as const;

/**
 * באנדרואיד edge-to-edge / Modal עם navigationBarTranslucent לפעמים
 * `insets.bottom === 0` למרות סרגל 3 כפתורים (~48dp) או מחוות.
 * מינימום ≈ גובה nav טיפוסי כדי ששורה אחרונה לא תיעלם מאחורי המערכת.
 */
export const SHEET_ANDROID_MIN_BOTTOM_INSET = 48;

/** רווח נוסף מעל ה-inset באנדרואיד (מרווח נשימה לתוויות/שורה אחרונה) */
export const SHEET_ANDROID_BOTTOM_EXTRA = 12;

/** רווח נוסף מעל ה-inset ב-iOS */
export const SHEET_IOS_BOTTOM_EXTRA = 20;

/** inset תחתון אמין לשיטים — תמיד לפחות המינימום באנדרואיד */
export function sheetSafeBottomInset(safeAreaBottom: number): number {
  const inset = Math.max(0, safeAreaBottom || 0);
  if (Platform.OS !== 'android') return inset;
  return Math.max(inset, SHEET_ANDROID_MIN_BOTTOM_INSET);
}

function defaultBottomExtra(): number {
  return Platform.OS === 'android' ? SHEET_ANDROID_BOTTOM_EXTRA : SHEET_IOS_BOTTOM_EXTRA;
}

/**
 * paddingBottom לתוכן שיט מעל סרגל המערכת.
 * שימוש ב-content שבעלים על הריפוד (`contentPaddingBottom={0}`) או כברירת מחדל ב-BottomSheet.
 */
export function sheetContentBottomPadding(
  safeAreaBottom: number,
  extra: number = defaultBottomExtra(),
): number {
  return sheetSafeBottomInset(safeAreaBottom) + Math.max(0, extra);
}

/**
 * גובה רצועת מילוי מתחת לכפתורי ניווט המערכת (Modal שקוף באנדרואיד
 * לעיתים חושף רקע חלון לבן מאחורי ◁ ○ □). חייב להתאים ל-inset האמין.
 */
export function sheetSystemBarFillHeight(safeAreaBottom: number): number {
  if (Platform.OS === 'android') {
    return sheetSafeBottomInset(safeAreaBottom);
  }
  return Math.max(0, safeAreaBottom || 0) || 12;
}

/**
 * סגנונות ברירת מחדל לכפתורי פעולה בפוטר שיט — כהים/זכוכיתיים,
 * בלי מילוי לבן כפוי. Primary = מותג ירוק בלבד.
 */
export type SheetActionVariant = 'primary' | 'secondary' | 'destructive' | 'cancel';

export function sheetActionColors(tokens: {
  colors: {
    primary: { main: string };
    /** קנבס המסך — כפתור משני על כרטיס השיט (cardSolid) צריך ניגוד. */
    background?: { primary?: string };
    text: { primary: string; secondary: string; inverse: string; danger: string };
    danger?: { main: string };
    glass?: { card?: { bg?: string; border?: string } };
    border: { primary: string; subtle: string };
  };
}): Record<
  SheetActionVariant,
  { backgroundColor: string; borderColor: string; color: string; borderWidth: number }
> {
  const dangerBg = tokens.colors.danger?.main ?? '#EF4444';
  const glassBg = tokens.colors.glass?.card?.bg ?? 'rgba(255,255,255,0.06)';
  const glassBorder = tokens.colors.glass?.card?.border ?? tokens.colors.border.primary;
  const onCardFill = tokens.colors.background?.primary ?? glassBg;

  return {
    primary: {
      backgroundColor: tokens.colors.primary.main,
      borderColor: tokens.colors.primary.main,
      color: tokens.colors.text.inverse,
      borderWidth: 0,
    },
    secondary: {
      backgroundColor: onCardFill,
      borderColor: glassBorder,
      color: tokens.colors.text.primary,
      borderWidth: 1,
    },
    cancel: {
      backgroundColor: 'transparent',
      borderColor: tokens.colors.border.primary,
      color: tokens.colors.text.secondary,
      borderWidth: 1,
    },
    destructive: {
      backgroundColor: 'rgba(239,68,68,0.14)',
      borderColor: 'rgba(239,68,68,0.4)',
      color: tokens.colors.text.danger,
      borderWidth: 1,
    },
  };
}
