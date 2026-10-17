import React, { useRef, useSyncExternalStore } from 'react';

export type ScrubPoint = { date: string; value: number } | null;

export type ScrubStore = {
  get: () => ScrubPoint;
  set: (p: ScrubPoint) => void;
  subscribe: (fn: () => void) => () => void;
};

/**
 * מצב גרירה על הגרף מחוץ ל-state של המסך: set (מהגרף) מעדכן רק את המנויים —
 * המסך הכבד (גרף, עוגה, אחזקות) לא מתרנדר בכל פריים, והסמן נשאר חלק.
 */
export function useScrubStore(): ScrubStore {
  const ref = useRef<ScrubStore | null>(null);
  if (!ref.current) {
    let cur: ScrubPoint = null;
    const subs = new Set<() => void>();
    ref.current = {
      get: () => cur,
      set: (p) => {
        if (p === cur || (p && cur && p.date === cur.date && p.value === cur.value)) return;
        cur = p;
        subs.forEach((fn) => fn());
      },
      subscribe: (fn) => {
        subs.add(fn);
        return () => subs.delete(fn);
      },
    };
  }
  return ref.current;
}

/** מרנדר רק את הילדים מחדש כשנקודת הגרירה משתנה */
export function ScrubSubscriber({
  store,
  children,
}: {
  store: ScrubStore;
  children: (point: ScrubPoint) => React.ReactNode;
}) {
  const point = useSyncExternalStore(store.subscribe, store.get, store.get);
  return <>{children(point)}</>;
}
