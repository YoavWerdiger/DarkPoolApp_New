/**
 * צבעים וסמנטיקה אחידים לכל מערכת הצ'אט — מבוססים על DesignTokens (ערכת DarkPool).
 * להשתמש ב־import מכאן במקום hex / COLORS מקומיים בקומפוננטות צ'אט.
 */
import { DesignTokens } from '../ui/DesignTokens';

const c = DesignTokens.colors;
const g = DesignTokens.glassmorphism;

export const chatPalette = {
  primary: c.primary.main,
  primaryDark: c.primary.dark,
  text: c.text.primary,
  textSecondary: c.text.secondary,
  textTertiary: c.text.tertiary,
  inverse: c.text.inverse,
  bubbleMe: c.bubbleMe,
  bubbleOther: c.bubbleOther,
  danger: c.danger.main,
  success: c.success.main,
  warning: c.warning.main,
  glass: g.cardBackground.dark.light,
  glassStrong: g.cardBackground.dark.medium,
  glassBorder: g.border.dark.light,
  glassBorderStrong: g.border.dark.medium,
  overlay: c.backdrop,
  borderDivider: c.border.divider,
} as const;

/** גרדיאנט מסך כמו VideoBackground / gradients.screen */
export const chatScreenGradientColors = [...DesignTokens.gradients.screen] as readonly string[];
export const chatScreenGradientLocations = [0, 0.22, 0.42, 0.55, 0.78, 1] as const;
export const chatScreenGradientStart = DesignTokens.gradients.screenStart;
export const chatScreenGradientEnd = DesignTokens.gradients.screenEnd;

/** מסגרת זכוכית עדינה ל־UICard blur — כמו רשימת צ'אטים / מגירה */
export const chatGlassCardOutline = {
  borderWidth: 1,
  borderColor: chatPalette.glassBorder,
} as const;

/**
 * מסכי צ'אט רצים תחת NavigationContainer ב-LTR (מגירה).
 * עוטף RTL + row (לא row-reverse) — כמו darkPoolLayout / TradeListCard.
 */
export const chatRtlRoot = {
  flex: 1,
  direction: 'rtl',
} as const;

export const chatRtlRow = {
  flexDirection: 'row',
} as const;

export const chatRtlText = {
  writingDirection: 'rtl' as const,
  textAlign: 'left' as const,
};
