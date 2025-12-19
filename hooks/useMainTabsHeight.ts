import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Hook שמחזיר את הגובה של MainTabs כולל safe area
 * שימושי ל-paddingBottom ב-ScrollView/FlatList כדי למנוע גלילה מתחת לטאבים
 */
export const useMainTabsHeight = (additionalPadding: number = 16) => {
  const insets = useSafeAreaInsets();
  const safeBottom = insets.bottom || 0;
  // גובה MainTabs: 60 (גובה קבוע) + safeBottom (safe area) + padding נוסף
  return 60 + safeBottom + additionalPadding;
};

