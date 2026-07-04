import React, { useCallback, useEffect } from 'react';
import { Platform, type ViewProps } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import {
  AndroidSoftInputModes,
  KeyboardController,
  useGenericKeyboardHandler,
} from 'react-native-keyboard-controller';
import { CHAT_COMPOSER_KEYBOARD_GAP } from './chatInputLayout';

type ChatComposerDockProps = ViewProps & {
  children: React.ReactNode;
  /** inset תחתון קבוע (safe area) — נשאר גם כשהמקלדת פתוחה */
  bottomInset: number;
  keyboardGap?: number;
};

/**
 * מצמיד את הקומפוזר למקלדת באנימציה native (Reanimated worklet).
 * גובה המקלדת מגיע מה-OS (שונה לכל מכשיר) — בלי hardcode.
 * משתמשים ב-shared values ל-inset/gap כדי שה-handler יישאר יציב (בלי deps שמשתנים),
 * מה שמונע אזהרות "modify key current" של worklets.
 */
export function ChatComposerDock({
  children,
  style,
  bottomInset,
  keyboardGap = CHAT_COMPOSER_KEYBOARD_GAP,
  ...rest
}: ChatComposerDockProps) {
  const translateY = useSharedValue(0);
  const bottomInsetSV = useSharedValue(bottomInset);
  const keyboardGapSV = useSharedValue(keyboardGap);

  useEffect(() => {
    bottomInsetSV.value = bottomInset;
  }, [bottomInset, bottomInsetSV]);

  useEffect(() => {
    keyboardGapSV.value = keyboardGap;
  }, [keyboardGap, keyboardGapSV]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return undefined;
      KeyboardController.setInputMode(AndroidSoftInputModes.SOFT_INPUT_ADJUST_NOTHING);
      return () => {
        KeyboardController.setDefaultMode();
      };
    }, []),
  );

  useGenericKeyboardHandler(
    {
      onMove: (event) => {
        'worklet';
        translateY.value =
          event.height <= 0
            ? 0
            : -Math.max(0, event.height - bottomInsetSV.value + keyboardGapSV.value);
      },
      onEnd: (event) => {
        'worklet';
        translateY.value =
          event.height <= 0
            ? 0
            : -Math.max(0, event.height - bottomInsetSV.value + keyboardGapSV.value);
      },
    },
    [],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[animatedStyle, style]} {...rest}>
      {children}
    </Animated.View>
  );
}
