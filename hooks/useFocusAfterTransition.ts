import { useEffect, useRef } from 'react';
import type { TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';

/**
 * פוקוס לשדה רק אחרי שמעבר המסך הסתיים — autoFocus מעלה מקלדת באמצע ההחלקה,
 * ושתי האנימציות יחד נראות תקועות.
 */
export function useFocusAfterTransition(enabled: boolean) {
  const ref = useRef<TextInput>(null);
  const navigation = useNavigation();

  useEffect(() => {
    if (!enabled) return undefined;
    let done = false;
    const focus = () => {
      if (done) return;
      done = true;
      ref.current?.focus();
    };
    // transitionEnd קיים ב-native-stack; גיבוי למקרה שאין מעבר (מסך ראשון)
    const unsub = (navigation as unknown as {
      addListener: (e: string, cb: (ev: { data?: { closing?: boolean } }) => void) => () => void;
    }).addListener('transitionEnd', (e) => {
      if (!e?.data?.closing) focus();
    });
    const t = setTimeout(focus, 450);
    return () => {
      done = true;
      unsub?.();
      clearTimeout(t);
    };
  }, [enabled, navigation]);

  return ref;
}
