import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** אין סרגל טאבים תחתון (Drawer) — רק safe area + מרווח קטן לתוכן */
const TAB_BAR_BASE_HEIGHT = 0;

/**
 * Hook שמחזיר padding תחתון מותאם לניווט הראשי (Drawer).
 * default 12: מרווח נוסף מעל ה-safe area.
 */
export const useMainTabsHeight = (additionalPadding: number = 12) => {
  const insets = useSafeAreaInsets();
  const safeBottom = insets.bottom || 0;
  return TAB_BAR_BASE_HEIGHT + safeBottom + additionalPadding;
};


