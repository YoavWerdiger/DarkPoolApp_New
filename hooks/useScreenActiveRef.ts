import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

/**
 * ref שאומר אם המסך בפוקוס והאפליקציה בחזית. לטיימרים של רענון (כל 30 שניות וכו׳):
 * בודקים את ה-ref בכל טיק ומדלגים כשהמסך מוסתר או האפליקציה ברקע — בלי לבנות מחדש את האפקט.
 */
export function useScreenActiveRef() {
  const isFocused = useIsFocused();
  const ref = useRef(isFocused && AppState.currentState === 'active');
  useEffect(() => {
    ref.current = isFocused && AppState.currentState === 'active';
    const sub = AppState.addEventListener('change', (state) => {
      ref.current = isFocused && state === 'active';
    });
    return () => sub.remove();
  }, [isFocused]);
  return ref;
}
