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
 *
 * trackVisibility=false: רק callback, בלי setState — כדי שמסך הצ'אט לא
 * ירנדר מחדש את ה-FlatList בכל פתיחה/סגירה של מקלדת.
 */
export function useChatKeyboardInsets(
  onKeyboardShow?: () => void,
  trackVisibility = true,
) {
  const [keyboardShown, setKeyboardShown] = useState(() =>
    trackVisibility ? Keyboard.isVisible() : false,
  );
  const onShowRef = useRef(onKeyboardShow);
  onShowRef.current = onKeyboardShow;
  const trackRef = useRef(trackVisibility);
  trackRef.current = trackVisibility;

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      if (trackRef.current) setKeyboardShown(true);
      onShowRef.current?.();
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      if (trackRef.current) setKeyboardShown(false);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return { keyboardShown };
}
