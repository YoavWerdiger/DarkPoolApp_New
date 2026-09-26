/**
 * מריץ עבודה כבדה רק אחרי סיום אנימציית native-stack.
 * InteractionManager לבדו נגמר לפני ה-slide — לכן transitionEnd + fallback.
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';

export const AFTER_NAV_TRANSITION_FALLBACK_MS = 420;

type NavLike = {
  addListener: (event: string, cb: () => void) => () => void;
};

export function scheduleAfterNavigationTransition(
  navigation: NavLike,
  run: () => void,
  fallbackMs: number = AFTER_NAV_TRANSITION_FALLBACK_MS,
): () => void {
  let finished = false;
  const once = () => {
    if (finished) return;
    finished = true;
    run();
  };
  const unsub = navigation.addListener('transitionEnd', once);
  const timer = setTimeout(once, fallbackMs);
  return () => {
    finished = true;
    unsub();
    clearTimeout(timer);
  };
}

export function useAfterNavigationTransition(
  effect: () => void,
  deps: readonly unknown[],
): void {
  const navigation = useNavigation();
  const effectRef = useRef(effect);
  effectRef.current = effect;

  useEffect(() => {
    return scheduleAfterNavigationTransition(navigation, () => {
      effectRef.current();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller owns deps
  }, deps);
}

/** מסך נכנס מציג UI/cache מיד; עבודה כבדה רק אחרי ה-slide. */
export function useAllowAfterNavigationTransition(): boolean {
  const [ready, setReady] = useState(false);
  useAfterNavigationTransition(() => {
    setReady(true);
  }, []);
  return ready;
}
