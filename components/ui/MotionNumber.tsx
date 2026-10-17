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
  withTiming,
} from 'react-native-reanimated';

/**
 * מספר דולרי שמתחלף ב-UI thread (בלי React) בהחלפה מטושטשת:
 * שתי שכבות מתחלפות — המספר החדש נכנס מטושטש ומתחדד, הישן יוצא ומיטשטש, עם תזוזה קלה בכיוון השינוי.
 * «טשטוש» = הילה של עותקים מוזזים בשקיפות נמוכה, הכי חזקה באמצע המעבר ונעלמת כשהמספר נוחת.
 * פורמט $1,234,567 קבוע (לא «US$»).
 */

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);
const SWAP_MS = 200;
const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);
/** תזוזה אנכית במעבר (חלק מגובה השורה) */
const SHIFT = 0.18;
/** הזזת עותקי ההילה (px) */
const HALO = [
  { x: 0, y: -2 },
  { x: 0, y: 2 },
  { x: -1.5, y: 0 },
  { x: 1.5, y: 0 },
];

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

  const initial = formatUsd(value);
  const liveText = useDerivedValue(() => formatUsd(current.value));
  // שתי שכבות: טקסט + נראות (0..1) לכל אחת
  const textA = useSharedValue(initial);
  const textB = useSharedValue(initial);
  const visA = useSharedValue(1);
  const visB = useSharedValue(0);
  const front = useSharedValue(0); // 0 = A מוצגת
  const dir = useSharedValue(1);

  const prevNum = useSharedValue(value);
  useAnimatedReaction(
    () => formatUsd(current.value),
    (next, prev) => {
      if (prev == null || next === prev) return;
      dir.value = current.value >= prevNum.value ? 1 : -1;
      prevNum.value = current.value;
      const cfg = { duration: SWAP_MS, easing: EASE };
      if (front.value === 0) {
        textB.value = next;
        visB.value = 0;
        visB.value = withTiming(1, cfg);
        visA.value = withTiming(0, cfg);
        front.value = 1;
      } else {
        textA.value = next;
        visA.value = 0;
        visA.value = withTiming(1, cfg);
        visB.value = withTiming(0, cfg);
        front.value = 0;
      }
    }
  );

  const lineH = style.lineHeight ?? Math.round((style.fontSize ?? 32) * 1.2);
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

  return (
    <View
      style={[styles.wrap, { height: lineH }]}
      pointerEvents="none"
      accessibilityRole="text"
      accessibilityLabel={initial}
    >
      {/* החלפה מיידית בלי אפקט — הכי חלק עם האצבע (ההחלפה המטושטשת נראתה גרוע יותר) */}
      <PlainLayer text={liveText} inputStyle={inputStyle} />
    </View>
  );
}

function PlainLayer({ text, inputStyle }: { text: SharedValue<string>; inputStyle: TextStyle }) {
  const textProps = useAnimatedProps(() => ({ text: text.value, defaultValue: text.value }) as never);
  return (
    <AnimatedTextInput
      editable={false}
      caretHidden
      contextMenuHidden
      scrollEnabled={false}
      underlineColorAndroid="transparent"
      defaultValue={text.value}
      animatedProps={textProps}
      style={[inputStyle, styles.abs]}
    />
  );
}

function Layer({
  text,
  vis,
  front,
  isA,
  dir,
  lineH,
  inputStyle,
}: {
  text: SharedValue<string>;
  vis: SharedValue<number>;
  front: SharedValue<number>;
  isA: boolean;
  dir: SharedValue<number>;
  lineH: number;
  inputStyle: TextStyle;
}) {
  const textProps = useAnimatedProps(() => {
    // ReText: text + defaultValue — מתעדכן ב-iOS וב-Android
    return { text: text.value, defaultValue: text.value } as never;
  });

  // נכנסת: מגיעה מהכיוון של השינוי; יוצאת: ממשיכה הלאה
  const layerStyle = useAnimatedStyle(() => {
    const entering = (front.value === 0) === isA;
    const off = (1 - vis.value) * lineH * SHIFT * dir.value;
    return {
      opacity: vis.value,
      transform: [{ translateY: entering ? off : -off }],
    };
  });
  // הילת טשטוש — חזקה באמצע המעבר, אפס כשהשכבה נחתה/נעלמה
  const haloStyle = useAnimatedStyle(() => {
    const mid = 1 - Math.abs(vis.value * 2 - 1);
    return { opacity: mid * 0.45 };
  });

  const common = {
    editable: false,
    caretHidden: true,
    contextMenuHidden: true,
    scrollEnabled: false,
    underlineColorAndroid: 'transparent',
    defaultValue: text.value,
    animatedProps: textProps,
  } as const;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, layerStyle]}>
      <Animated.View style={[StyleSheet.absoluteFill, haloStyle]}>
        {HALO.map((h, i) => (
          <AnimatedTextInput
            key={i}
            {...common}
            style={[inputStyle, styles.abs, { opacity: 0.5, transform: [{ translateX: h.x }, { translateY: h.y }] }]}
          />
        ))}
      </Animated.View>
      <AnimatedTextInput {...common} style={[inputStyle, styles.abs]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
  },
  abs: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
