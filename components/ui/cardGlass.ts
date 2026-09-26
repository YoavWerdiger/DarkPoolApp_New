import type { BlurTint } from 'expo-blur';
import { SoftUI } from './softUiPalette';

export type GlassIntensity = 'subtle' | 'light' | 'medium' | 'strong';

/** מילוי אטום לכרטיס ב-dark — בלי rgba לבן מעל הקנבס. */
export function darkCardSurface(intensity: GlassIntensity = 'light'): string {
  switch (intensity) {
    case 'medium':
      return SoftUI.surface2;
    case 'strong':
      return SoftUI.surface3;
    case 'subtle':
    case 'light':
    default:
      return SoftUI.surface1;
  }
}

export type UiCardVariant =
  | 'default'
  | 'soft'
  | 'elevated'
  | 'outlined'
  | 'accent'
  | 'glass'
  | 'blur'
  | 'inputGlass'
  | 'surface';

/**
 * כרום / כרטיס בודד / שדה — BlurView מלא.
 * `glass` / `default` נשארים translucent + border (בלי blur לכל שורת פיד).
 */
/** Soft UI: blur רק במפורש (`enableBlur: true`), לא כברירת מחדל. */
const AUTO_BLUR_VARIANTS: ReadonlySet<UiCardVariant> = new Set([]);

/**
 * BlurView כבד רק כשמתבקש במפורש, או בווריאנט כרום.
 * `disableBlur` תמיד מנצח (שורות רשימה, view-shot).
 */
export function resolveUiCardBlur(opts: {
  variant: UiCardVariant;
  enableBlur?: boolean;
  disableBlur?: boolean;
}): boolean {
  if (opts.disableBlur) return false;
  if (opts.enableBlur === false) return false;
  if (opts.enableBlur === true) return true;
  return AUTO_BLUR_VARIANTS.has(opts.variant);
}

/** SwiftUI `.systemThinMaterial` — אותה שפה ב-iOS, Android ו-SheetGlass. */
export function cardGlassBlurTint(isDarkMode: boolean): BlurTint {
  return isDarkMode ? 'systemThinMaterialDark' : 'systemThinMaterialLight';
}

/**
 * Android: blur אמיתי מ-SDK 31; מתחת לזה expo-blur נופל ל-translucent (לא #262626).
 * `dimezisBlurView` המלא כבד מדי לשורות — לא משתמשים בו כאן.
 */
export const CARD_GLASS_ANDROID_BLUR_METHOD = 'dimezisBlurViewSdk31Plus' as const;

/**
 * ברירת המחדל של expo-blur היא 4 — באנדרואיד הזכוכית נראית ~4× חלשה מ-iOS.
 * 1.5 מקרב את העוצמה בלי להכביד על ה-GPU.
 */
export const CARD_GLASS_ANDROID_BLUR_REDUCTION = 1.5;

/**
 * overflow:hidden על אותו View עם borderWidth:1 חותך את קו הזכוכית ב-native.
 * המסגרת נשארת על המעטפת; החיתוך עובר לשכבות הפנימיות.
 */
export function uiCardOuterOverflow(
  applyGlassBorder: boolean
): 'visible' | 'hidden' {
  return applyGlassBorder ? 'visible' : 'hidden';
}

export function stripOverflowForGlassBorder<T extends { overflow?: unknown }>(
  style: T | undefined,
  applyGlassBorder: boolean
): T | undefined {
  if (!applyGlassBorder || !style || style.overflow == null) return style;
  const { overflow: _overflow, ...rest } = style;
  return rest as T;
}

/** `borderWidth: 0` ב־style חיצוני הוא איפוס legacy — לא מסגרת accent אמיתית. */
export function outerStyleBlocksGlassBorder(flat: {
  borderWidth?: unknown;
}): boolean {
  const w = flat.borderWidth;
  if (w == null || w === 0) return false;
  return true;
}

/**
 * כשמפעילים מסגרת זכוכית — מסירים מאיפוסים ב־style חיצוני שידרסו את ה־1px.
 */
export function stripConflictingOuterStyleForGlassBorder<
  T extends {
    overflow?: unknown;
    borderWidth?: unknown;
    borderColor?: unknown;
    borderTopColor?: unknown;
  },
>(style: T | undefined, applyGlassBorder: boolean): T | undefined {
  if (!applyGlassBorder || !style) return style;
  let next: T = stripOverflowForGlassBorder(style, true) ?? style;
  if (next.borderWidth === 0) {
    const {
      borderWidth: _bw,
      borderColor: _bc,
      borderTopColor: _btc,
      ...rest
    } = next;
    next = rest as T;
  }
  return next;
}
