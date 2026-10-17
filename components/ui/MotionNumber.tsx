import React, { useEffect } from 'react';
import { StyleSheet, TextInput, View, type TextStyle } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

/**
 * מספר דולרי שמתעדכן ישירות ב-UI thread (טקסט אחד, בלי גלילת ספרות):
 * בגרירה הגרף מעדכן SharedValue והטקסט מתחלף באותו פריים — בלי React.
 * בכל שינוי — motion blur קצר: מתיחה קלה + שני «צללים» דהויים בכיוון התנועה, שדועכים תוך ~200ms.
 * פורמט $1,234,567 קבוע (לא תלוי בשפת המכשיר — לא «US$»).
 */

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);
const BLUR_IN_MS = 30;
const BLUR_OUT_MS = 200;

function formatUsd(v: number): string {
  'worklet';
  const n = Math.round(Math.abs(v));
  const digits = String(n);
  let out = '';
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ',';
    out += digits[i];
  }
  return (v < 0 && n > 0 ? '-' : '') + '$' + out;
}

type Props = {
  /** ערך בזמן גרירה (UI thread) */
  scrubValue: SharedValue<number>;
  /** 1 בזמן גרירה */
  scrubActive: SharedValue<number>;
  /** ערך במנוחה (JS) */
  value: number;
  style: TextStyle;
};

export function MotionNumber({ scrubValue, scrubActive, value, style }: Props) {
  const restSV = useSharedValue(value);
  useEffect(() => {
    restSV.value = value;
  }, [value, restSV]);

  const current = useDerivedValue(() => (scrubActive.value ? scrubValue.value : restSV.value));
  const text = useDerivedValue(() => formatUsd(current.value));

  // עוצמת הטשטוש (0–1) וכיוון (1 עלייה / -1 ירידה)
  const blur = useSharedValue(0);
  const dir = useSharedValue(1);
  useAnimatedReaction(
    () => current.value,
    (next, prev) => {
      if (prev == null || next === prev) return;
      dir.value = next > prev ? 1 : -1;
      blur.value = withSequence(
        withTiming(1, { duration: BLUR_IN_MS }),
        withTiming(0, { duration: BLUR_OUT_MS, easing: Easing.out(Easing.quad) })
      );
    }
  );

  const textProps = useAnimatedProps(() => {
    // ReText: text + defaultValue כדי שיתעדכן גם ב-iOS וגם ב-Android
    return { text: text.value, defaultValue: text.value } as never;
  });

  const lineH = style.lineHeight ?? Math.round((style.fontSize ?? 32) * 1.2);
  const mainStyle = useAnimatedStyle(() => ({
    opacity: 1 - blur.value * 0.25,
    transform: [{ scaleY: 1 + blur.value * 0.05 }],
  }));
  // צללים נגררים מאחורי כיוון התנועה
  const ghostNear = useAnimatedStyle(() => ({
    opacity: blur.value * 0.35,
    transform: [{ translateY: -dir.value * blur.value * lineH * 0.12 }],
  }));
  const ghostFar = useAnimatedStyle(() => ({
    opacity: blur.value * 0.18,
    transform: [{ translateY: -dir.value * blur.value * lineH * 0.24 }],
  }));

  const inputStyle: TextStyle = {
    ...style,
    textAlign: 'right',
    padding: 0,
    margin: 0,
    height: lineH,
    includeFontPadding: false,
    fontVariant: ['tabular-nums'],
    writingDirection: 'ltr',
  };
  const initial = formatUsd(value);
  const common = {
    editable: false,
    caretHidden: true,
    contextMenuHidden: true,
    scrollEnabled: false,
    underlineColorAndroid: 'transparent',
    defaultValue: initial,
    animatedProps: textProps,
  } as const;

  return (
    <View style={styles.wrap} pointerEvents="none" accessibilityRole="text" accessibilityLabel={initial}>
      <AnimatedTextInput {...common} style={[inputStyle, styles.ghost, ghostFar]} />
      <AnimatedTextInput {...common} style={[inputStyle, styles.ghost, ghostNear]} />
      <AnimatedTextInput {...common} style={[inputStyle, mainStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
  },
  ghost: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
