import { I18nManager } from 'react-native';
import { DrawerActions } from '@react-navigation/native';

/** צד פתיחת ה-Drawer — בעברית (RTL) משמאל, ב-LTR מימין */
export function getMainDrawerPosition(): 'left' | 'right' {
  return I18nManager.isRTL ? 'left' : 'right';
}

/** חייב להתאים ל־`id` על ה־Drawer ב־MainTabs */
export const MAIN_DRAWER_NAVIGATOR_ID = 'MainDrawer' as const;

/** מינימום לניווט מקונן (RootParamList / Composite וכו') */
export type DrawerParentNavigation = {
  getParent: (id?: string) => DrawerParentNavigation | undefined;
  dispatch?: (action: unknown) => void;
  setOptions?: (options: object) => void;
};

/** הורה ישיר של מסך בתוך Stack שבתוך ה־Drawer הוא לרוב ה־Drawer — לא עושים שני getParent (זה מגיע ל־Stack הראשי של האפליקציה). */
export function getMainDrawerNavigation(
  navigation: DrawerParentNavigation
): DrawerParentNavigation | undefined {
  return (
    navigation.getParent(MAIN_DRAWER_NAVIGATOR_ID) ?? navigation.getParent()
  );
}

export function dispatchOpenMainDrawer(navigation: DrawerParentNavigation) {
  getMainDrawerNavigation(navigation)?.dispatch?.(DrawerActions.openDrawer());
}
