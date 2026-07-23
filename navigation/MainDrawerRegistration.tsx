import React, { useLayoutEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  registerMainDrawerNavigation,
  MAIN_DRAWER_NAVIGATOR_ID,
  type DrawerParentNavigation,
} from './mainDrawerNav';

/**
 * רישום ניווט המגירה מתוך עץ הצ׳אט (ילד ישיר של ה־Drawer) — אמין יותר מרישום מ־drawerContent בלבד.
 */
export function MainDrawerRegistration() {
  const navigation = useNavigation();

  useLayoutEffect(() => {
    const nav = navigation as unknown as DrawerParentNavigation;
    const byId = nav.getParent?.(MAIN_DRAWER_NAVIGATOR_ID);
    if (byId) {
      registerMainDrawerNavigation(byId);
      return;
    }
    let p: DrawerParentNavigation | undefined = nav.getParent?.() as
      | DrawerParentNavigation
      | undefined;
    for (let i = 0; i < 14 && p; i++) {
      if (
        p.getId?.() === MAIN_DRAWER_NAVIGATOR_ID ||
        p.getState?.()?.type === 'drawer'
      ) {
        registerMainDrawerNavigation(p);
        return;
      }
      p = p.getParent?.() as DrawerParentNavigation | undefined;
    }
  }, [navigation]);

  return null;
}
