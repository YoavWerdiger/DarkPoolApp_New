import { useEffect, useRef, useState } from 'react';
import { Keyboard } from 'react-native';

/**
 * מעקב מקלדת לצ'אט — רק DidShow / DidHide.
 *
 * לא משתמשים ב-useKeyboardState / keyboardWillShow:
 * ב-iOS, setState (או scroll) בזמן WillShow חוסם את אנימציית Reanimated של
 * react-native-keyboard-controller — המקלדת/הקומפוזר מרגישים "תקועים" או עם snap.
 * (מתועד ב-88dd0c3 וב-DELIVERY_PLAN 2.5.6).
 *
 * גובה/translate לקומפוזר ולרשימה ממשיכים להגיע מ-useGenericKeyboardHandler
 * (UI thread) — כאן רק flag ל-FAB ו-callback אחרי שהאנימציה הסתיימה.
 */
export function useChatKeyboardInsets(onKeyboardShow?: () => void) {
  const [keyboardShown, setKeyboardShown] = useState(Keyboard.isVisible());
  const onShowRef = useRef(onKeyboardShow);
  onShowRef.current = onKeyboardShow;

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardShown(true);
      onShowRef.current?.();
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardShown(false);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return { keyboardShown };
}
