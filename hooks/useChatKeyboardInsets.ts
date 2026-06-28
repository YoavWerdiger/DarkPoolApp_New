import { useEffect, useRef } from 'react';
import { useKeyboardState } from 'react-native-keyboard-controller';

/**
 * מעקב מקלדת לצ'אט — מסונכרן עם אנימציית keyboard-controller (לא keyboardDidShow).
 */
export function useChatKeyboardInsets(onKeyboardShow?: () => void) {
  const keyboardInset = useKeyboardState((state) => state.height);
  const keyboardShown = useKeyboardState((state) => state.isVisible);
  const prevVisibleRef = useRef(false);

  useEffect(() => {
    if (keyboardShown && !prevVisibleRef.current) {
      onKeyboardShow?.();
    }
    prevVisibleRef.current = keyboardShown;
  }, [keyboardShown, onKeyboardShow]);

  return { keyboardInset, keyboardShown };
}
