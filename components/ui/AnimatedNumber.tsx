import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useDesignTokens } from './useDesignTokens';

export const NUMBER_ROLL_MS = 420;
export const NUMBER_FAST_MS = 110;
export const NUMBER_FLASH_MS = 700;
/** השהיה בין ספרה לספרה (מהאחדות שמאלה) — תחושת מונה */
const STAGGER_MS = 16;
const EASE_OUT = Easing.out(Easing.cubic);
/** גלגול רך — easeOutQuint, בלי «קפיצה» בסוף */
const ROLL_EASE = Easing.bezier(0.22, 1, 0.36, 1);

// תווי בקרה של bidi (LRI/PDI וכו׳) — שורת התאים כבר LTR פיזית
const BIDI_CONTROLS = /[‎‏‪-‮⁦-⁩]/g;
const DIGIT = /[0-9]/;

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
  'width',
  'minWidth',
  'maxWidth',
] as const;

const CHAR_KEYS = [
  'color',
  'fontFamily',
  'fontSize',
  'fontStyle',
  'fontWeight',
  'fontVariant',
  'letterSpacing',
  'includeFontPadding',
  'textTransform',
] as const;

export type AnimatedNumberProps = Omit<TextProps, 'children'> & {
  /** המחרוזת המעוצבת (אפשר עטופה ב־toDataIsland) — אותו פורמטר כמו היום */
  text: string;
  /** ערך מספרי לכיוון השינוי (עלייה = הספרות מתגלגלות למעלה + ירוק) */
  value?: number | null;
  /** הבהוב ירוק/אדום עדין בשינוי */
  flash?: boolean;
  /** false = החלפה בלי אנימציה */
  animate?: boolean;
  /** מעבר קצר בלי השהיות (גרירה על הגרף — הערך משתנה כל פריים) */
  fast?: boolean;
};

type Change = { gen: number; prev: string; dir: 1 | -1; fast: boolean };
type Shown = {
  /** הערך הקודם הגיע מגרירה */
  fast: boolean;
  text: string;
  value: number | null | undefined;
  change: Change | null;
  flashGen: number;
  flashDir: 1 | -1;
};

function pickKeys<K extends string>(src: Record<string, unknown>, keys: readonly K[]) {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (src[k] !== undefined) out[k] = src[k];
  return out;
}

const justifyFor = (align: TextStyle['textAlign']): ViewStyle['justifyContent'] =>
  align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start';

/**
 * מספר בסגנון מונה: כל ספרה היא עמודת 0–9 שגולשת לערך החדש (גם דרך הספרות שבדרך),
 * בהשהיה קלה מהאחדות שמאלה. תווים שאינם ספרות ($ , . % M) לא זזים.
 * המספר תמיד מצויר כשורת תאים (LTR פיזי) — בלי מדידה/יישור מול Text נסתר שיכולים להיכשל.
 * adjustsFontSizeToFit נתמך (הקטנת פונט לפי הרוחב). בלי אנימציה בעלייה ראשונה / Reduce Motion.
 */
export function AnimatedNumber({
  text,
  value,
  flash = false,
  animate = true,
  fast = false,
  style,
  adjustsFontSizeToFit,
  minimumFontScale,
  allowFontScaling,
  maxFontSizeMultiplier,
  accessibilityLabel,
  testID,
}: AnimatedNumberProps) {
  const tokens = useDesignTokens();
  const reduceMotion = useReducedMotion();

  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  const wrapperStyle = pickKeys(flat as Record<string, unknown>, WRAPPER_KEYS) as ViewStyle;
  const baseFont = flat.fontSize ?? 14;
  const baseLine = flat.lineHeight ?? Math.round(baseFont * 1.22);

  const clean = text.replace(BIDI_CONTROLS, '');

  // שינוי ערך → מה התחלף ובאיזה כיוון
  const genRef = useRef(0);
  const [shown, setShown] = useState<Shown>(() => ({
    fast,
    text: clean,
    value,
    change: null,
    flashGen: 0,
    flashDir: 1,
  }));
  if (shown.text !== clean) {
    const numericDir =
      value != null && shown.value != null && Number.isFinite(value) && Number.isFinite(shown.value)
        ? Math.sign(value - shown.value)
        : 0;
    const dir: 1 | -1 = numericDir < 0 ? -1 : 1;
    // סוף גרירה (חזרה לשווי) — מיד, בלי גלגול: אחרת המונה «ממשיך» אחרי שעוזבים את הסמן
    const releasedScrub = shown.fast && !fast;
    const canAnimate = animate && !reduceMotion && !releasedScrub;
    genRef.current += 1;
    setShown({
      fast,
      text: clean,
      value,
      // גוון עדין על הספרות שהשתנו: ירוק בעלייה, אדום בירידה — גם בגרירה על הגרף
      change: canAnimate
        ? { gen: genRef.current, prev: shown.text, dir, fast }
        : null,
      flashGen:
        canAnimate && flash && !fast && numericDir !== 0 ? shown.flashGen + 1 : shown.flashGen,
      flashDir: numericDir !== 0 ? dir : shown.flashDir,
    });
  }

  // התאמת גודל פונט לרוחב (כמו adjustsFontSizeToFit)
  const [availW, setAvailW] = useState(0);
  const [naturalW, setNaturalW] = useState(0);
  const scale = useMemo(() => {
    if (!adjustsFontSizeToFit || !availW || !naturalW || naturalW <= availW) return 1;
    return Math.max(minimumFontScale ?? 0.5, availW / naturalW);
  }, [adjustsFontSizeToFit, availW, naturalW, minimumFontScale]);
  const lineH = Math.round(baseLine * scale);

  // יציב בין רנדרים — כך DigitCell (memo) מתרנדר רק כשהספרה שלו משתנה
  const charKey = JSON.stringify(pickKeys(flat as Record<string, unknown>, CHAR_KEYS));
  const charStyle = useMemo<TextStyle>(
    () => ({
      ...(JSON.parse(charKey) as TextStyle),
      fontVariant: flat.fontVariant ?? ['tabular-nums'],
      fontSize: baseFont * scale,
      lineHeight: lineH,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [charKey, baseFont, scale, lineH]
  );

  // הבהוב צבע
  const flashP = useSharedValue(0);
  const baseColor = typeof flat.color === 'string' ? flat.color : null;
  const flashColor = shown.flashDir > 0 ? tokens.colors.text.success : tokens.colors.text.danger;
  useLayoutEffect(() => {
    if (shown.flashGen === 0) return;
    // נכנס ברכות (לא קופץ לירוק מלא) ודועך לאט — צבע חלק לכל המספר
    flashP.value = withSequence(
      withTiming(0.85, { duration: 140, easing: EASE_OUT }),
      withTiming(0, { duration: NUMBER_FLASH_MS, easing: Easing.inOut(Easing.quad) }),
    );
  }, [shown.flashGen, flashP]);
  const flashEnabled = flash && baseColor != null;
  const flashStyle = useAnimatedStyle(() => {
    if (!flashEnabled || baseColor == null) return {};
    return { color: interpolateColor(flashP.value, [0, 1], [baseColor, flashColor]) };
  }, [flashEnabled, baseColor, flashColor]);

  // תאים מיושרים מימין (האחדות באותו תא גם כשאורך המספר משתנה)
  const chars = Array.from(shown.text);
  const change = shown.change;
  const prevChars = change ? Array.from(change.prev) : null;
  const offset = prevChars ? chars.length - prevChars.length : 0;
  let digitsSeen = 0;
  const cells = chars
    .map((ch, i) => ({ ch, i }))
    .reverse()
    .map(({ ch, i }) => {
      const old = prevChars ? prevChars[i - offset] ?? null : null;
      const isDigit = DIGIT.test(ch);
      const order = digitsSeen;
      if (isDigit) digitsSeen += 1;
      return {
        key: `r${chars.length - 1 - i}`,
        ch,
        old,
        rolls: !!change && isDigit && old != null && old !== ch,
        order,
      };
    })
    .reverse();

  const onWrapLayout = useCallback((e: LayoutChangeEvent) => setAvailW(e.nativeEvent.layout.width), []);
  const onMeasureLayout = useCallback(
    (e: LayoutChangeEvent) => setNaturalW(e.nativeEvent.layout.width),
    []
  );

  return (
    <View
      style={[wrapperStyle, styles.wrap]}
      onLayout={adjustsFontSizeToFit ? onWrapLayout : undefined}
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? shown.text}
      testID={testID}
    >
      <View
        style={[styles.row, { justifyContent: justifyFor(flat.textAlign) }]}
        importantForAccessibility="no-hide-descendants"
      >
        {cells.map((c) => (
          <DigitCell
            key={c.key}
            ch={c.ch}
            gen={c.rolls && change ? change.gen : 0}
            animate={!!change}
            delay={change?.fast ? 0 : c.order * STAGGER_MS}
            duration={change?.fast ? NUMBER_FAST_MS : NUMBER_ROLL_MS}
            height={lineH}
            charStyle={charStyle}
            flashStyle={flashEnabled ? flashStyle : null}
            // בגרירה (כמו InsiderWave): כל ספרה צובעת לפי הכיוון שלה — עולה ירוק, יורדת אדום — וחוזרת לבסיס.
            // בשינוי ערך רגיל: צבע אחיד לכל המספר (flash).
            tintColor={
              change?.fast && c.rolls && c.old != null && baseColor
                ? Number(c.ch) > Number(c.old)
                  ? tokens.colors.text.success
                  : tokens.colors.text.danger
                : null
            }
            baseColor={baseColor}
            allowFontScaling={allowFontScaling}
            maxFontSizeMultiplier={maxFontSizeMultiplier}
          />
        ))}
      </View>
      {adjustsFontSizeToFit ? (
        // מדידה ברוחב טבעי בגודל הבסיס — לחישוב ההקטנה
        <View style={styles.measure} pointerEvents="none">
          <Text
            onLayout={onMeasureLayout}
            style={[charStyle, { fontSize: baseFont, lineHeight: baseLine }]}
            allowFontScaling={allowFontScaling}
            maxFontSizeMultiplier={maxFontSizeMultiplier}
            numberOfLines={1}
          >
            {shown.text}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

/**
 * ספרה = עמודת 0–9 שגולשת לספרת היעד (מונה אמיתי, כמו InsiderWave).
 * שינוי חדש באמצע תנועה ממשיך מהמיקום הנוכחי (withTiming) — בגרירה אין «קפיצה לאחור» בכל פריים.
 * תו שאינו ספרה ($ , . %) — טקסט רגיל.
 */
const DigitCell = React.memo(function DigitCell({
  ch,
  gen,
  delay,
  duration,
  height,
  charStyle,
  flashStyle,
  tintColor,
  baseColor,
  animate,
  allowFontScaling,
  maxFontSizeMultiplier,
}: {
  tintColor: string | null;
  baseColor: string | null;
  ch: string;
  gen: number;
  delay: number;
  duration: number;
  height: number;
  charStyle: TextStyle;
  flashStyle: ReturnType<typeof useAnimatedStyle> | null;
  animate: boolean;
  allowFontScaling?: boolean;
  maxFontSizeMultiplier?: number | null;
}) {
  const isDigit = DIGIT.test(ch);
  const target = isDigit ? Number(ch) : 0;
  const pos = useSharedValue(target);
  const tint = useSharedValue(0);
  const lastGen = useRef(0);

  useLayoutEffect(() => {
    if (!isDigit) return;
    if (!animate || !gen) {
      pos.value = target;
      return;
    }
    if (gen === lastGen.current) return;
    lastGen.current = gen;
    pos.value = withDelay(delay, withTiming(target, { duration, easing: ROLL_EASE }));
    if (tintColor) {
      // הגוון נכנס עם הספרה ודועך אחרי שהיא נוחתת
      tint.value = withTiming(1, { duration: 90, easing: EASE_OUT }, () => {
        tint.value = withDelay(duration * 0.5, withTiming(0, { duration: 480, easing: EASE_OUT }));
      });
    }
  }, [gen, target, isDigit, animate, delay, duration, tintColor, pos, tint]);

  const tintStyle = useAnimatedStyle(() => {
    if (!tintColor || !baseColor) return {};
    return { color: interpolateColor(tint.value * 0.8, [0, 1], [baseColor, tintColor]) };
  }, [tintColor, baseColor]);

  const columnStyle = useAnimatedStyle(
    () => ({ transform: [{ translateY: -pos.value * height }] }),
    [height]
  );

  if (!isDigit) {
    return (
      <View style={[styles.cell, { height }]}>
        <Animated.Text
          style={[charStyle, flashStyle]}
          allowFontScaling={allowFontScaling}
          maxFontSizeMultiplier={maxFontSizeMultiplier}
        >
          {ch}
        </Animated.Text>
      </View>
    );
  }

  return (
    <View style={[styles.cell, { height }]}>
      <Animated.View style={columnStyle}>
        {DIGITS.map((d) => (
          <Animated.Text
            key={d}
            style={[charStyle, { height }, flashStyle, tintColor ? tintStyle : null]}
            allowFontScaling={allowFontScaling}
            maxFontSizeMultiplier={maxFontSizeMultiplier}
          >
            {d}
          </Animated.Text>
        ))}
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    // פיזי — המספר תמיד משמאל לימין, גם בעץ RTL
    direction: 'ltr',
  },
  cell: {
    overflow: 'hidden',
  },
  // רחב מאוד — הטקסט נמדד ברוחב הטבעי שלו ולא נחתך לרוחב ההורה
  measure: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 4000,
    opacity: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
});
