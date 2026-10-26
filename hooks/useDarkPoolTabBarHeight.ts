import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** גובה pill הטאבים (ללא safe area וללא רצועת רקע אטומה מעל) */
export const DARK_POOL_TAB_BAR_HEIGHT = 58;

/** ריווח מעל ה-pill ברצועת הניווט האטומה — חייב להתאים ל־DarkPoolBottomTabBar */
export const DARK_POOL_TAB_BAR_CHROME_TOP = 10;

/** גובה כל רצועת הטאבים (ריווח עליון + pill + safe area) — המסכים נחתכים מעליה */
export function useDarkPoolTabBarFrameHeight(): number {
  const insets = useSafeAreaInsets();
  // 4 ולא כל ה-CHROME_TOP — התוכן נחתך קרוב יותר ל-pill
  return DARK_POOL_TAB_BAR_HEIGHT + 4 + Math.max(insets.bottom || 0, 8);
}

/**
 * padding תחתון לתוכן מסכי Dark Pool.
 * הסצנה עצמה כבר נגמרת בראש סרגל הטאבים (sceneStyle ב-DarkPoolTabs),
 * אז נשאר רק מרווח קטן בסוף הרשימה.
 */
export function useDarkPoolTabBarHeight(extra = 8): number {
  return extra;
}
