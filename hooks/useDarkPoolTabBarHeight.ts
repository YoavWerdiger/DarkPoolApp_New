import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** גובה pill הטאבים (ללא safe area וללא רצועת רקע אטומה מעל) */
export const DARK_POOL_TAB_BAR_HEIGHT = 58;

/** ריווח מעל ה-pill ברצועת הניווט האטומה — חייב להתאים ל־DarkPoolBottomTabBar */
export const DARK_POOL_TAB_BAR_CHROME_TOP = 10;

/** padding תחתון לתוכן מסכי Dark Pool (מעל סרגל הטאבים) */
export function useDarkPoolTabBarHeight(extra = 12): number {
  const insets = useSafeAreaInsets();
  return (
    DARK_POOL_TAB_BAR_HEIGHT +
    DARK_POOL_TAB_BAR_CHROME_TOP +
    Math.max(insets.bottom || 0, 8) +
    extra
  );
}
