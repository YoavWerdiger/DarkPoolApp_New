import { useCallback } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { getMainDrawerNavigation, type DrawerParentNavigation } from '../navigation/mainDrawerNav';

/**
 * בזמן מסך מלא (צ'אט וכו') מבטלים החלקה לפתיחת ה-Drawer כדי שלא יתנגש עם מחוות.
 */
export function useLockParentDrawerWhileFocused() {
  const navigation = useNavigation();

  useFocusEffect(
    useCallback(() => {
      const nav = navigation as unknown as DrawerParentNavigation;
      const drawerNav = getMainDrawerNavigation(nav);
      const setDrawerOptions = drawerNav?.setOptions;
      if (!setDrawerOptions) return undefined;

      setDrawerOptions({ swipeEnabled: false });
      return () => {
        // אותו drawerNav כמו בפוקוס — ב-blur חיפוש מחדש לפעמים מחזיר undefined וה-swipe נשאר כבוי.
        setDrawerOptions({ swipeEnabled: true });
      };
    }, [navigation])
  );
}
