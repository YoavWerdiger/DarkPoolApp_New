import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent, type TextStyle } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

/**
 * מספר דולרי מתגלגל שרץ כולו ב-UI thread (כמו InsiderWave):
 * הערך מגיע כ-SharedValue (מהגרירה בגרף) — אין רינדור React בזמן גרירה.
 * כל משבצת היא עמודת תווים (0–9 , $ -) שגולשת לתו היעד; בזמן תנועה — מתיחה קלה ו«צל» נגרר (motion blur).
 * הפורמט: $1,234,567 (מספרים שלמים, בלי תלות בשפת המכשיר — לא «US$»).
 */

const GLYPHS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '$', '-'] as const;
const COMMA = 10;
const DOLLAR = 11;
const MINUS = 12;
const SPIN_MS = 260;
const SPIN_EASE = Easing.bezier(0.22, 1, 0.36, 1);
const WIDTH_MS = 220;

/** מחרוזת $1,234 — worklet */
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

function glyphIndex(ch: string): number {
  'worklet';
  if (ch === ',') return COMMA;
  if (ch === '$') return DOLLAR;
  if (ch === '-') return MINUS;
  const d = ch.charCodeAt(0) - 48;
  return d >= 0 && d <= 9 ? d : -1;
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

export function RollingNumber({ scrubValue, scrubActive, value, style }: Props) {
  const fontSize = style.fontSize ?? 32;
  const lineH = style.lineHeight ?? Math.round(fontSize * 1.2);
  const glyphStyle: TextStyle = useMemo(
    () => ({
      color: style.color,
      fontSize,
      lineHeight: lineH,
      height: lineH,
      fontWeight: style.fontWeight,
      fontFamily: style.fontFamily,
      letterSpacing: style.letterSpacing,
      fontVariant: ['tabular-nums'],
      includeFontPadding: false,
      textAlign: 'center',
    }),
    [style.color, fontSize, lineH, style.fontWeight, style.fontFamily, style.letterSpacing]
  );

  // רוחב כל תו — נמדד פעם אחת
  const [widths, setWidths] = useState<number[] | null>(null);
  const measured = useMemo(() => new Array<number>(GLYPHS.length).fill(0), [glyphStyle]);
  const onGlyphLayout = useCallback(
    (i: number) => (e: LayoutChangeEvent) => {
      measured[i] = e.nativeEvent.layout.width;
      if (measured.every((w) => w > 0)) setWidths([...measured]);
    },
    [measured]
  );
  const widthsSV = useSharedValue<number[]>([]);
  useEffect(() => {
    if (widths) widthsSV.value = widths;
  }, [widths, widthsSV]);

  const restSV = useSharedValue(value);
  useEffect(() => {
    restSV.value = value;
  }, [value, restSV]);

  const text = useDerivedValue(() =>
    formatUsd(scrubActive.value ? scrubValue.value : restSV.value)
  );

  // מספר משבצות קבוע: מספיק לערך הנוכחי ועוד מקום לגדילה ×1000
  const slots = Math.max(6, formatUsdJs(Math.abs(value) * 1000 + 1).length);

  return (
    <View style={styles.row} accessibilityRole="text" accessibilityLabel={formatUsdJs(value)}>
      {widths
        ? Array.from({ length: slots }, (_, k) => (
            <Slot
              key={k}
              fromRight={slots - 1 - k}
              text={text}
              widths={widthsSV}
              lineH={lineH}
              glyphStyle={glyphStyle}
            />
          ))
        : (
          <Text style={glyphStyle}>{formatUsdJs(value)}</Text>
        )}
      {/* מדידת רוחב התווים */}
      <View style={styles.measure} pointerEvents="none">
        {GLYPHS.map((g, i) => (
          <Text key={g} style={glyphStyle} onLayout={onGlyphLayout(i)}>
            {g}
          </Text>
        ))}
      </View>
    </View>
  );
}

function formatUsdJs(v: number): string {
  return formatUsd(v);
}

const Slot = React.memo(function Slot({
  fromRight,
  text,
  widths,
  lineH,
  glyphStyle,
}: {
  fromRight: number;
  text: SharedValue<string>;
  widths: SharedValue<number[]>;
  lineH: number;
  glyphStyle: TextStyle;
}) {
  const charAt = (s: string) => {
    'worklet';
    const i = s.length - 1 - fromRight;
    return i >= 0 ? glyphIndex(s[i]) : -1;
  };
  const initial = charAt(text.value);
  const pos = useSharedValue(initial < 0 ? 0 : initial);
  const target = useSharedValue(initial);
  const w = useSharedValue(initial < 0 ? 0 : widths.value[initial] ?? 0);

  useAnimatedReaction(
    () => charAt(text.value),
    (next, prev) => {
      if (next === prev && w.value > 0) return;
      const ws = widths.value;
      target.value = next;
      if (next < 0) {
        w.value = withTiming(0, { duration: WIDTH_MS, easing: SPIN_EASE });
        return;
      }
      const isDigit = next <= 9;
      const wasDigit = prev != null && prev >= 0 && prev <= 9;
      // ספרה→ספרה: גלגול; אחרת (פסיק/$ שמופיע) — קפיצה
      pos.value = isDigit && wasDigit ? withTiming(next, { duration: SPIN_MS, easing: SPIN_EASE }) : next;
      w.value = withTiming(ws[next] ?? 0, { duration: WIDTH_MS, easing: SPIN_EASE });
    },
    [fromRight]
  );

  const slotStyle = useAnimatedStyle(() => ({ width: w.value, opacity: w.value > 0.5 ? 1 : 0 }));
  // מתיחה לפי המרחק שנותר (= מהירות) — מראה של motion blur
  const columnStyle = useAnimatedStyle(
    () => ({ transform: [{ translateY: -pos.value * lineH }] }),
    [lineH]
  );
  // המתיחה על מסגרת בגובה תו אחד (סביב מרכז התו הנראה), לא על כל העמודה
  const stretchStyle = useAnimatedStyle(() => {
    const d = Math.min(1, Math.abs(pos.value - Math.max(0, target.value)));
    return { transform: [{ scaleY: 1 + d * 0.22 }] };
  });
  const ghostStyle = useAnimatedStyle(() => {
    const delta = pos.value - Math.max(0, target.value);
    const d = Math.min(1, Math.abs(delta));
    return {
      opacity: d * 0.35,
      // הצל נגרר מאחורי כיוון התנועה
      transform: [{ translateY: -pos.value * lineH + Math.sign(delta) * lineH * 0.18 }],
    };
  }, [lineH]);

  const column = GLYPHS.map((g) => (
    <Text key={g} style={glyphStyle} allowFontScaling={false}>
      {g}
    </Text>
  ));

  return (
    <Animated.View style={[styles.slot, { height: lineH }, slotStyle]}>
      <Animated.View style={[StyleSheet.absoluteFill, stretchStyle]}>
        <Animated.View style={[styles.column, ghostStyle]}>{column}</Animated.View>
        <Animated.View style={[styles.column, columnStyle]}>{column}</Animated.View>
      </Animated.View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    direction: 'ltr',
    justifyContent: 'flex-end',
    alignSelf: 'stretch',
  },
  slot: {
    overflow: 'hidden',
    alignItems: 'center',
  },
  column: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  measure: {
    position: 'absolute',
    opacity: 0,
    flexDirection: 'row',
    top: 0,
    left: 0,
    width: 4000,
  },
});
