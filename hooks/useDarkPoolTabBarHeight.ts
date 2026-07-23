import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** גובה סרגל הטאבים הפנימי של מודול Dark Pool (ללא safe area) */
export const DARK_POOL_TAB_BAR_HEIGHT = 58;

/** padding תחתון לתוכן מסכי Dark Pool (מעל סרגל הטאבים) */
export function useDarkPoolTabBarHeight(extra = 12): number {
  const insets = useSafeAreaInsets();
  return DARK_POOL_TAB_BAR_HEIGHT + (insets.bottom || 0) + extra;
}
