import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View, type LayoutChangeEvent, type TextStyle } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  interpolateColor,
  withDelay,
  withSequence,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

/**
 * מספר דולרי שמתעדכן כולו ב-UI thread (בלי React בזמן גרירה), כמו InsiderWave:
 * כל משבצת מחזיקה רק שני תווים (הנוכחי והקודם). ספרה שמשתנה גולשת פנימה עם דהייה קצרה
 * בכיוון השינוי (עלייה מלמטה, ירידה מלמעלה); הישנה יוצאת. פסיקים/$ מתחלפים בלי תנועה.
 * פורמט $1,234,567 קבוע (לא «US$»).
 */

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);
/** משך מעבר ספרה — רגוע מספיק כדי לקרוא, בלי «ריצה» */
const SWAP_MS = 240;
const EASE = Easing.bezier(0.22, 1, 0.36, 1);
/** כמה מגובה השורה הספרה גולשת */
const TRAVEL = 0.5;
/** צבע חזק: מחזיק רגע בצבע מלא ואז דועך לצבע הרגיל */
const TINT_IN_MS = 140;
const TINT_HOLD_MS = 220;
const TINT_FADE_MS = 650;

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
function formatUsdJs(v: number): string {
  return formatUsd(v);
}

/** רוחב תו לפי סוג: [ספרה, פסיק, $, מינוס] */
const MEASURE_CHARS = ['0', ',', '$', '-'] as const;

type Props = {
  /** ערך בזמן גרירה (UI thread) */
  scrubValue: SharedValue<number>;
  /** 1 בזמן גרירה */
  scrubActive: SharedValue<number>;
  /** ערך במנוחה (JS) */
  value: number;
  style: TextStyle;
  /** צבע ספרה שעלתה / ירדה (מלא, ואז דועך לצבע הבסיס) */
  upColor?: string;
  downColor?: string;
};

export function MotionNumber({ scrubValue, scrubActive, value, style, upColor, downColor }: Props) {
  const restSV = useSharedValue(value);
  useEffect(() => {
    restSV.value = value;
  }, [value, restSV]);

  // כיוון השינוי האחרון: 1 עלייה, -1 ירידה
  const dir = useSharedValue(1);
  const text = useSharedValue(formatUsdJs(value));
  useAnimatedReaction(
    () => {
      const active = scrubActive.value ? 1 : 0;
      return { active, v: active ? scrubValue.value : restSV.value };
    },
    (next, prev) => {
      if (prev != null && next.v !== prev.v) dir.value = next.v > prev.v ? 1 : -1;
      text.value = formatUsd(next.v);
    }
  );

  const lineH = style.lineHeight ?? Math.round((style.fontSize ?? 32) * 1.2);
  const glyphStyle: TextStyle = useMemo(
    () => ({
      color: style.color,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      fontFamily: style.fontFamily,
      letterSpacing: style.letterSpacing,
      lineHeight: lineH,
      height: lineH,
      fontVariant: ['tabular-nums'],
      includeFontPadding: false,
      padding: 0,
      margin: 0,
      textAlign: 'center',
    }),
    [style.color, style.fontSize, style.fontWeight, style.fontFamily, style.letterSpacing, lineH]
  );

  // רוחב ספרה / פסיק / $ / מינוס — נמדד פעם אחת
  const [widths, setWidths] = useState<number[] | null>(null);
  const measured = useMemo(() => [0, 0, 0, 0], [glyphStyle]);
  const onMeasure = useCallback(
    (i: number) => (e: LayoutChangeEvent) => {
      measured[i] = e.nativeEvent.layout.width;
      if (measured.every((w) => w > 0)) setWidths([...measured]);
    },
    [measured]
  );
  const widthsSV = useSharedValue<number[]>([0, 0, 0, 0]);
  useEffect(() => {
    if (widths) widthsSV.value = widths;
  }, [widths, widthsSV]);

  // משבצות קבועות: מספיק לערך הנוכחי ולגדילה ×1000
  const slots = Math.max(6, formatUsdJs(Math.abs(value) * 1000 + 1).length);

  return (
    <View style={styles.row} pointerEvents="none" accessibilityRole="text" accessibilityLabel={formatUsdJs(value)}>
      {widths ? (
        Array.from({ length: slots }, (_, k) => (
          <Slot
            key={k}
            fromRight={slots - 1 - k}
            text={text}
            dir={dir}
            widths={widthsSV}
            lineH={lineH}
            glyphStyle={glyphStyle}
            baseColor={typeof style.color === 'string' ? style.color : '#FFFFFF'}
            upColor={upColor}
            downColor={downColor}
          />
        ))
      ) : (
        <Text style={glyphStyle}>{formatUsdJs(value)}</Text>
      )}
      <View style={styles.measure}>
        {MEASURE_CHARS.map((c, i) => (
          <Text key={c} style={glyphStyle} onLayout={onMeasure(i)}>
            {c}
          </Text>
        ))}
      </View>
    </View>
  );
}

const Slot = React.memo(function Slot({
  fromRight,
  text,
  dir,
  widths,
  lineH,
  glyphStyle,
  baseColor,
  upColor,
  downColor,
}: {
  baseColor: string;
  upColor?: string;
  downColor?: string;
  fromRight: number;
  text: SharedValue<string>;
  dir: SharedValue<number>;
  widths: SharedValue<number[]>;
  lineH: number;
  glyphStyle: TextStyle;
}) {
  const charOf = (s: string) => {
    'worklet';
    const i = s.length - 1 - fromRight;
    return i >= 0 ? s[i] : '';
  };
  const widthOf = (c: string) => {
    'worklet';
    if (!c) return 0;
    const ws = widths.value;
    if (c === ',') return ws[1];
    if (c === '$') return ws[2];
    if (c === '-') return ws[3];
    return ws[0];
  };

  const first = charOf(text.value);
  const cur = useSharedValue(first);
  const prev = useSharedValue('');
  const p = useSharedValue(1);
  const slideDir = useSharedValue(1);
  const w = useSharedValue(widthOf(first));
  // ציר צבע אחד: -1 אדום מלא, 0 צבע בסיס, 1 ירוק מלא — מעברים רציפים גם כשהכיוון מתחלף
  const tint = useSharedValue(0);

  /**
   * גלגול רגוע: ספרה לא נקטעת באמצע — מסיימת את המעבר שלה ורק אז עוברת לערך העדכני
   * (מדלגת על הערכים שבדרך). בגרירה מהירה המונה לא «רץ» על כל סנאפשוט,
   * וכשהסמן נעצר הספרות נוחתות על הערך של הנקודה.
   */
  useAnimatedReaction(
    () => ({ next: charOf(text.value), idle: p.value >= 1 }),
    ({ next, idle }) => {
      if (!idle) return;
      const before = cur.value;
      if (next === before) {
        w.value = widthOf(next);
        return;
      }
      const isDigit = next >= '0' && next <= '9';
      const wasDigit = before >= '0' && before <= '9';
      prev.value = before;
      cur.value = next;
      slideDir.value = dir.value;
      // רוחב משתנה (1 ↔ 0, פסיק חדש) — מחליק במקום לקפוץ
      w.value = w.value > 0 ? withTiming(widthOf(next), { duration: SWAP_MS, easing: EASE }) : widthOf(next);
      if (isDigit && wasDigit) {
        p.value = 0;
        p.value = withTiming(1, { duration: SWAP_MS, easing: EASE });
        // ספרה ששינתה צבע מלא בכיוון שלה, מחזיקה רגע ודועכת
        tint.value = withSequence(
          withTiming(dir.value > 0 ? 1 : -1, { duration: TINT_IN_MS, easing: Easing.out(Easing.quad) }),
          withDelay(TINT_HOLD_MS, withTiming(0, { duration: TINT_FADE_MS, easing: Easing.inOut(Easing.quad) }))
        );
      } else {
        p.value = 1;
      }
    }
  );

  const curProps = useAnimatedProps(() => ({ text: cur.value, defaultValue: cur.value }) as never);
  const prevProps = useAnimatedProps(() => ({ text: prev.value, defaultValue: prev.value }) as never);

  const slotStyle = useAnimatedStyle(() => ({ width: w.value }));
  // עלייה: החדשה נכנסת מלמטה והישנה יוצאת למעלה; ירידה — הפוך
  const inStyle = useAnimatedStyle(() => ({
    color:
      upColor && downColor
        ? interpolateColor(tint.value, [-1, 0, 1], [downColor, baseColor, upColor])
        : baseColor,
    opacity: p.value,
    transform: [{ translateY: slideDir.value * lineH * TRAVEL * (1 - p.value) }],
  }));
  const outStyle = useAnimatedStyle(() => ({
    opacity: 1 - p.value,
    transform: [{ translateY: -slideDir.value * lineH * TRAVEL * p.value }],
  }));

  const common = {
    editable: false,
    caretHidden: true,
    contextMenuHidden: true,
    scrollEnabled: false,
    underlineColorAndroid: 'transparent',
  } as const;

  return (
    <Animated.View style={[styles.slot, { height: lineH }, slotStyle]}>
      <AnimatedTextInput {...common} defaultValue="" animatedProps={prevProps} style={[glyphStyle, styles.abs, outStyle]} />
      <AnimatedTextInput {...common} defaultValue={first} animatedProps={curProps} style={[glyphStyle, styles.abs, inStyle]} />
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
  },
  abs: {
    position: 'absolute',
    top: 0,
    left: -20,
    right: -20,
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
