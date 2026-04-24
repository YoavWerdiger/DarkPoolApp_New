import { DrawerActions } from '@react-navigation/native';
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

/**
 * דגל "פתיחה ממתינה" — מוצב כשלחצו על תפריט מתוך Profile.
 * Chat (מסך ה־drawer הפעיל) יצרוך אותו ב־useFocusEffect ויפתח את המגירה בעצמו.
 */
let pendingOpenMainDrawer = false;

export function markPendingOpenMainDrawer(): void {
  pendingOpenMainDrawer = true;
}

export function consumePendingOpenMainDrawer(): boolean {
  if (!pendingOpenMainDrawer) return false;
  pendingOpenMainDrawer = false;
  return true;
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

/** Fallback אמין — ראקט-נאביגשן ינתב את הפעולה לנאב־המגירה הקרוב בעץ (Main). */
function tryDispatchOpenDrawerViaRoot(): boolean {
  try {
    if (!rootNavigationRef.isReady()) return false;
    rootNavigationRef.dispatch(DrawerActions.openDrawer());
    return true;
  } catch {
    return false;
  }
}

/** מנווט ל־Main. מעדיף את rootNavigationRef (אמין יותר מכל פונקציית getParent בעץ מקונן) */
function navigateRootStackToMain(navigation: DrawerParentNavigation) {
  try {
    if (rootNavigationRef.isReady()) {
      rootNavigationRef.navigate('Main' as never);
      return;
    }
  } catch {
    /* נופלים ל־walk של parents */
  }

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
}

/** ה־ProfileStack הוא אח ל־Main ב־root — כשהוא פעיל, פתיחת מגירה דרך ה־ref נשארת מאחורי ה־Stack */
function isRootProfileStackFocused(): boolean {
  if (!rootNavigationRef.isReady()) return false;
  try {
    const root = rootNavigationRef.getState();
    const routes = root?.routes as { name?: string }[] | undefined;
    if (!routes?.length) return false;
    const idx = typeof root.index === 'number' ? root.index : routes.length - 1;
    return routes[idx]?.name === 'Profile';
  } catch {
    return false;
  }
}

function openDrawerAfterSwitchToMain(navigation: DrawerParentNavigation) {
  /** המסך של Chat יצרוך את הדגל ב־useFocusEffect ויפתח את המגירה מתוך הנאב שלו (אמין ביותר) */
  markPendingOpenMainDrawer();
  navigateRootStackToMain(navigation);
}

/**
 * פותח את מגירת Main. מסכי Profile יושבים ב־Stack מעל Main — קודם חוזרים ל־Main ואז נפתחת מגירה.
 */
export function dispatchOpenMainDrawer(navigation: DrawerParentNavigation) {
  if (isRootProfileStackFocused()) {
    openDrawerAfterSwitchToMain(navigation);
    return;
  }

  const target =
    getMainDrawerNavigation(navigation) ?? registeredMainDrawerNav;
  if (tryDispatchOpenDrawer(target)) {
    return;
  }

  if (tryDispatchOpenDrawerViaRoot()) {
    return;
  }

  openDrawerAfterSwitchToMain(navigation);
}
