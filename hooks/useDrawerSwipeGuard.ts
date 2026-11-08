import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import { getMainDrawerNavigation, type DrawerParentNavigation } from '../navigation/mainDrawerNav';

/**
 * קרוסלה אופקית: המגע שייך לה בלבד — לא פותח את ה-Drawer (QA 11.1).
 * המגירה מימין נפתחת בהחלקה שמאלה של 5px מ-72px מהקצה — בדיוק כמו גלילה «חזרה» ב-RTL.
 * כבוי מרגע הנגיעה עד שהגלילה (כולל מומנטום) נעצרת. לפרוס על ה-ScrollView: {...drawerGuard}
 */
export function useDrawerSwipeGuard() {
  const navigation = useNavigation();
  const lockedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setSwipe = useCallback(
    (enabled: boolean) => {
      const drawerNav = getMainDrawerNavigation(navigation as unknown as DrawerParentNavigation);
      drawerNav?.setOptions?.({ swipeEnabled: enabled });
    },
    [navigation],
  );

  const lock = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!lockedRef.current) {
      lockedRef.current = true;
      setSwipe(false);
    }
  }, [setSwipe]);

  const release = useCallback(
    (delayMs: number) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (lockedRef.current) {
          lockedRef.current = false;
          setSwipe(true);
        }
      }, delayMs);
    },
    [setSwipe],
  );

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (lockedRef.current) setSwipe(true);
    },
    [setSwipe],
  );

  return useMemo(
    () => ({
      onTouchStart: lock,
      onScrollBeginDrag: lock,
      // מומנטום אחרי שחרור — משחררים כשהוא נעצר; אם אין מומנטום, אחרי רגע
      onTouchEnd: () => release(700),
      onTouchCancel: () => release(700),
      onMomentumScrollEnd: () => release(120),
    }),
    [lock, release],
  );
}
