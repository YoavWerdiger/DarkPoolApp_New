import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { StyleSheet, View, type TextProps, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useDesignTokens } from './useDesignTokens';

export const NUMBER_ROLL_MS = 260;
export const NUMBER_FLASH_MS = 700;
const EASE_OUT = Easing.out(Easing.cubic);
/** כמה פיקסלים הערך החדש נכנס מלמטה/מלמעלה */
const ROLL_SHIFT = 10;

// מיקום/גמישות עוברים לעטיפה (שבתוכה שכבת הערך הקודם ממוקמת בדיוק מעל)
const WRAPPER_KEYS = [
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginStart',
  'marginEnd',
  'marginHorizontal',
  'marginVertical',
  'position',
  'top',
  'bottom',
  'left',
  'right',
  'start',
  'end',
  'flex',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'alignSelf',
  'zIndex',
] as const;

type Shown = {
  text: string;
  value: number | null | undefined;
  animate: boolean;
  /** הערך הקודם בזמן המעבר */
  prev: { text: string; gen: number; dir: 1 | -1 } | null;
  flashGen: number;
  flashDir: 1 | -1;
};

export type AnimatedNumberProps = Omit<TextProps, 'children'> & {
  /** המחרוזת המעוצבת (אפשר עטופה ב־toDataIsland) — אותו פורמטר כמו היום */
  text: string;
  /** ערך מספרי לכיוון השינוי (עלייה = נכנס מלמטה + ירוק) */
  value?: number | null;
  /** הבהוב ירוק/אדום עדין בשינוי */
  flash?: boolean;
  /** false = החלפה בלי אנימציה (למשל בזמן גרירה על הגרף) */
  animate?: boolean;
};

function pickKeys<K extends string>(src: Record<string, unknown>, keys: readonly K[]) {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (src[k] !== undefined) out[k] = src[k];
  return out;
}

/**
 * מספר שמתחלף בתנועה: הערך הקודם עולה/יורד ודוהה, החדש נכנס מהכיוון של השינוי.
 * בלי מדידות — אותו Text בדיוק, ושכבת הערך הקודם באותה קופסה (אותו textAlign) — עובד
 * גם עם יישור לימין, הקטנת פונט וקיטוע. במנוחה: Text רגיל עם ספרות טבלאיות.
 * בלי אנימציה בעלייה ראשונה וכש-Reduce Motion פעיל.
 */
export function AnimatedNumber({
  text,
  value,
  flash = false,
  animate = true,
  style,
  ...rest
}: AnimatedNumberProps) {
  const tokens = useDesignTokens();
  const reduceMotion = useReducedMotion();

  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  const wrapperStyle = pickKeys(flat as Record<string, unknown>, WRAPPER_KEYS) as ViewStyle;
  const textStyle: TextStyle = { ...flat, fontVariant: flat.fontVariant ?? ['tabular-nums'] };
  for (const k of WRAPPER_KEYS) delete (textStyle as Record<string, unknown>)[k];

  const genRef = useRef(0);
  const [shown, setShown] = useState<Shown>(() => ({
    text,
    value,
    animate,
    prev: null,
    flashGen: 0,
    flashDir: 1,
  }));

  if (shown.text !== text || shown.animate !== animate) {
    let next: Shown = { ...shown, text, value, animate };
    if (shown.text !== text) {
      const canAnimate = animate && shown.animate && !reduceMotion;
      const numericDir =
        value != null && shown.value != null && Number.isFinite(value) && Number.isFinite(shown.value)
          ? Math.sign(value - shown.value)
          : 0;
      const dir: 1 | -1 = numericDir < 0 ? -1 : 1;
      if (canAnimate) {
        genRef.current += 1;
        next.prev = { text: shown.text, gen: genRef.current, dir };
        if (flash && numericDir !== 0) {
          next = { ...next, flashGen: shown.flashGen + 1, flashDir: dir };
        }
      } else {
        next.prev = null;
      }
    }
    setShown(next);
  }

  const prev = shown.prev;
  const endRoll = useCallback((gen: number) => {
    setShown((s) => (s.prev && s.prev.gen === gen ? { ...s, prev: null } : s));
  }, []);

  // מעבר: p 0→1
  const p = useSharedValue(1);
  const dirSv = useSharedValue(1);
  useLayoutEffect(() => {
    if (!prev) return;
    const gen = prev.gen;
    dirSv.value = prev.dir;
    p.value = 0;
    p.value = withTiming(1, { duration: NUMBER_ROLL_MS, easing: EASE_OUT }, (finished) => {
      if (finished) scheduleOnRN(endRoll, gen);
    });
  }, [prev, p, dirSv, endRoll]);

  const inStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    // עלייה: נכנס מלמטה ועולה למקום; ירידה: נכנס מלמעלה
    transform: [{ translateY: dirSv.value * ROLL_SHIFT * (1 - p.value) }],
  }));
  const outStyle = useAnimatedStyle(() => ({
    opacity: 1 - p.value,
    transform: [{ translateY: -dirSv.value * ROLL_SHIFT * p.value }],
  }));

  // הבהוב צבע
  const flashP = useSharedValue(0);
  const baseColor = typeof flat.color === 'string' ? flat.color : null;
  const flashColor = shown.flashDir > 0 ? tokens.colors.text.success : tokens.colors.text.danger;
  useLayoutEffect(() => {
    if (shown.flashGen === 0) return;
    flashP.value = 1;
    flashP.value = withTiming(0, { duration: NUMBER_FLASH_MS, easing: EASE_OUT });
  }, [shown.flashGen, flashP]);
  const flashEnabled = flash && baseColor != null;
  const flashStyle = useAnimatedStyle(() => {
    if (!flashEnabled || baseColor == null) return {};
    return { color: interpolateColor(flashP.value, [0, 1], [baseColor, flashColor]) };
  }, [flashEnabled, baseColor, flashColor]);

  return (
    <View style={wrapperStyle}>
      <Animated.Text {...rest} style={[textStyle, flashEnabled ? flashStyle : null, prev ? inStyle : null]}>
        {text}
      </Animated.Text>
      {prev ? (
        <Animated.Text
          {...rest}
          key={prev.gen}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[textStyle, styles.overlay, flashEnabled ? flashStyle : null, outStyle]}
        >
          {prev.text}
        </Animated.Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
  },
});
