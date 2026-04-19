import { DrawerActions } from '@react-navigation/native';
import { InteractionManager } from 'react-native';
import { rootNavigationRef } from './rootNavigationRef';

export function getMainDrawerPosition(): 'left' | 'right' {
  // האפליקציה בעברית — תפריט ראשי נפתח מימין באופן עקבי בכל סביבת ריצה.
  return 'right';
}

/** חייב להתאים ל־`id` על ה־Drawer ב־MainTabs */
export const MAIN_DRAWER_NAVIGATOR_ID = 'MainDrawer' as const;

/** מינימום לניווט מקונן (RootParamList / Composite וכו') */
export type DrawerParentNavigation = {
  getParent: (id?: string) => DrawerParentNavigation | undefined;
  dispatch?: (action: unknown) => void;
  setOptions?: (options: object) => void;
  getId?: () => string | undefined;
  getState?: () => { type?: string } | undefined;
};

function isDrawerNavigatorNav(
  nav: DrawerParentNavigation | undefined
): boolean {
  if (!nav) return false;
  if (nav.getId?.() === MAIN_DRAWER_NAVIGATOR_ID) return true;
  try {
    const t = nav.getState?.()?.type;
    return t === 'drawer';
  } catch {
    return false;
  }
}

/**
 * מוצא את ניווט ה־Drawer האמיתי גם כשהמסך נמצא בתוך Stack מקונן (למשל צ'אט).
 * חשוב: לא להשתמש ב־getParent() בלבד — זה עלול להחזיר Stack שלא מטפל ב־DrawerActions.
 */
export function getMainDrawerNavigation(
  navigation: DrawerParentNavigation
): DrawerParentNavigation | undefined {
  const byId = navigation.getParent?.(MAIN_DRAWER_NAVIGATOR_ID);
  if (byId) return byId;

  let parent = navigation.getParent?.() as DrawerParentNavigation | undefined;
  for (let i = 0; i < 12 && parent; i++) {
    if (isDrawerNavigatorNav(parent)) return parent;
    parent = parent.getParent?.() as DrawerParentNavigation | undefined;
  }
  return undefined;
}

/**
 * נרשם מ־CustomDrawerContent — ProfileStack יושב מחוץ ל־Drawer (אח של Main),
 * ולכן `getMainDrawer` מהמסך הזה לעיתים לא קיים; הרישום מאפשר לפתוח מגירה בכל מקרה
 * כש־Main עדיין מונט (בדרך כלל כן כשפרופיל נדחף מעל).
 */
let registeredMainDrawerNav: DrawerParentNavigation | null = null;

export function registerMainDrawerNavigation(
  nav: DrawerParentNavigation | null
) {
  registeredMainDrawerNav = nav;
}

function tryDispatchOpenDrawer(
  nav: DrawerParentNavigation | null | undefined
): boolean {
  if (!nav?.dispatch) return false;
  try {
    nav.dispatch(DrawerActions.openDrawer());
    return true;
  } catch {
    return false;
  }
}

/** עולה בשרשרת האבות עד stack שמכיל את המסך Main, ומבצע navigate('Main') — נדרש כש־Profile מכסה את Main */
function navigateRootStackToMain(navigation: DrawerParentNavigation) {
  let nav: DrawerParentNavigation | undefined = navigation;
  for (let depth = 0; depth < 16 && nav; depth++) {
    try {
      const state = nav.getState?.() as { routeNames?: string[] } | undefined;
      const routeNames = state?.routeNames;
      if (routeNames?.includes?.('Main')) {
        (nav as { navigate?: (name: string) => void }).navigate?.('Main');
        return;
      }
    } catch {
      /* continue */
    }
    nav = nav.getParent?.() as DrawerParentNavigation | undefined;
  }
  try {
    if (rootNavigationRef.isReady()) {
      rootNavigationRef.navigate('Main' as never);
    }
  } catch {
    /* noop */
  }
}

function scheduleDrawerOpenRetries() {
  const delays = [0, 40, 100, 220, 450, 800];
  delays.forEach((ms) => {
    setTimeout(() => {
      tryDispatchOpenDrawer(registeredMainDrawerNav);
    }, ms);
  });
}

/**
 * פותח את מגירת Main. מסכי Profile יושבים ב־Stack מעל Main — קודם חוזרים ל־Main ואז נפתחת מגירה.
 */
export function dispatchOpenMainDrawer(navigation: DrawerParentNavigation) {
  const target =
    getMainDrawerNavigation(navigation) ?? registeredMainDrawerNav;
  if (tryDispatchOpenDrawer(target)) {
    return;
  }

  navigateRootStackToMain(navigation);

  InteractionManager.runAfterInteractions(() => {
    if (tryDispatchOpenDrawer(registeredMainDrawerNav)) {
      return;
    }
    scheduleDrawerOpenRetries();
  });
}
