import React, { useCallback, useEffect, useMemo } from 'react';
import { Platform, View, type ViewProps } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import {
  AndroidSoftInputModes,
  KeyboardController,
  KeyboardStickyView,
  useGenericKeyboardHandler,
} from 'react-native-keyboard-controller';
import {
  CHAT_COMPOSER_KEYBOARD_GAP,
  CHAT_KEYBOARD_LTR_STYLE,
  chatComposerKeyboardTranslate,
  chatComposerStickyOffset,
} from './chatInputLayout';

type ChatComposerDockProps = ViewProps & {
  children: React.ReactNode;
  /** inset תחתון קבוע (safe area) — נשאר גם כשהמקלדת פתוחה */
  bottomInset: number;
  keyboardGap?: number;
};

type ChatKeyboardFollowProps = {
  children: React.ReactNode;
  bottomInset: number;
  keyboardGap?: number;
  style?: ViewProps['style'];
};

/**
 * iOS: KeyboardStickyView הרשמי (RN Animated, לא Reanimated worklet).
 * זה הנתיב ש-Expo Go מריץ חלק — בפרודקשן Fabric+forceRTL ה-translateY של Reanimated
 * לא דוחף. המעטפת תמיד direction:'ltr' (לא isRTL).
 *
 * לא משתמשים בזה באנדרואיד: KeyboardStickyView קורא ל-useResizeMode ושובר ADJUST_NOTHING.
 */
export function ChatKeyboardFollow({
  children,
  bottomInset,
  keyboardGap = CHAT_COMPOSER_KEYBOARD_GAP,
  style,
}: ChatKeyboardFollowProps) {
  const offset = useMemo(
    () => chatComposerStickyOffset(bottomInset, keyboardGap),
    [bottomInset, keyboardGap],
  );

  if (Platform.OS === 'ios') {
    return (
      <KeyboardStickyView
        collapsable={false}
        offset={offset}
        style={[CHAT_KEYBOARD_LTR_STYLE, style]}
      >
        {children}
      </KeyboardStickyView>
    );
  }

  return <View style={style}>{children}</View>;
}

/**
 * מצמיד את הקומפוזר למקלדת.
 * iOS: KeyboardStickyView (כמו Expo Go) + LTR קשיח.
 * Android: Reanimated + SOFT_INPUT_ADJUST_NOTHING בזמן פוקוס בצ׳אט
 * (adjustResize מה-Manifest לא יילחם ב-translate).
 */
export function ChatComposerDock(props: ChatComposerDockProps) {
  if (Platform.OS === 'ios') {
    return <IosComposerDock {...props} />;
  }
  return <AndroidComposerDock {...props} />;
}

function IosComposerDock({
  children,
  style,
  bottomInset,
  keyboardGap = CHAT_COMPOSER_KEYBOARD_GAP,
  ...rest
}: ChatComposerDockProps) {
  const offset = useMemo(
    () => chatComposerStickyOffset(bottomInset, keyboardGap),
    [bottomInset, keyboardGap],
  );

  return (
    <KeyboardStickyView
      collapsable={false}
      offset={offset}
      style={[CHAT_KEYBOARD_LTR_STYLE, style]}
      {...rest}
    >
      {children}
    </KeyboardStickyView>
  );
}

function AndroidComposerDock({
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
        translateY.value = chatComposerKeyboardTranslate(
          event.height,
          bottomInsetSV.value,
          keyboardGapSV.value,
        );
      },
      onEnd: (event) => {
        'worklet';
        translateY.value = chatComposerKeyboardTranslate(
          event.height,
          bottomInsetSV.value,
          keyboardGapSV.value,
        );
      },
    },
    [],
  );

  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  return (
    <Animated.View style={[CHAT_KEYBOARD_LTR_STYLE, animatedStyle, style]} {...rest}>
      {children}
    </Animated.View>
  );
}
