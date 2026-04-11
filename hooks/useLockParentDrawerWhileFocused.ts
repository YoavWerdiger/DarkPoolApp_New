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
      drawerNav?.setOptions?.({ swipeEnabled: false });
      return () => {
        getMainDrawerNavigation(nav)?.setOptions?.({ swipeEnabled: true });
      };
    }, [navigation])
  );
}
