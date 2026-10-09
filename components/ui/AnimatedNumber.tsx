import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type TextLayoutEventData,
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
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useDesignTokens } from './useDesignTokens';

export const NUMBER_ROLL_MS = 220;
export const NUMBER_FLASH_MS = 600;
const EASE_OUT = Easing.out(Easing.cubic);

// תווי בקרה של bidi (LRI/PDI וכו׳) — בשורת הספרות המונפשת היא כבר LTR פיזית
const BIDI_CONTROLS = /[‎‏‪-‮⁦-⁩]/g;
const DIGIT = /[0-9]/;
// מתיחה של עד ~1.5pt בין שורת התווים לטקסט המקורי — מעבר לזה (הקטנת פונט / קיטוע) מוותרים על הגלגול
const FIT_TOLERANCE = 1.5;

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

const CHAR_TEXT_KEYS = [
  'color',
  'fontFamily',
  'fontSize',
  'fontStyle',
  'fontWeight',
  'fontVariant',
  'letterSpacing',
  'lineHeight',
  'includeFontPadding',
  'textTransform',
] as const;

type Line = { x: number; y: number; width: number; height: number; text: string; count: number };

type Roll = {
  gen: number;
  from: string;
  to: string;
  dir: 1 | -1;
  anchor: 'left' | 'right' | 'center';
  inset: number;
  top: number;
  height: number;
};

type Shown = {
  text: string;
  value: number | null | undefined;
  animate: boolean;
  roll: Roll | null;
  flashGen: number;
  flashDir: 1 | -1;
};

export type AnimatedNumberProps = Omit<TextProps, 'children'> & {
  /** המחרוזת המעוצבת (אפשר עטופה ב־toDataIsland) — אותו פורמטר כמו היום */
  text: string;
  /** ערך מספרי לכיוון השינוי (עלייה = גלגול למעלה + ירוק) */
  value?: number | null;
  /** הבהוב ירוק/אדום עדין בשינוי */
  flash?: boolean;
  /** false = החלפה בלי אנימציה (למשל בזמן גרירה על הגרף) */
  animate?: boolean;
};

function stripBidi(s: string): string {
  return s.replace(BIDI_CONTROLS, '');
}

function pickKeys<K extends string>(src: Record<string, unknown>, keys: readonly K[]) {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (src[k] !== undefined) out[k] = src[k];
  return out;
}

/**
 * מספר עם גלגול ספרות שהשתנו (למעלה בעלייה, למטה בירידה) + הבהוב אופציונלי.
 * במנוחה — Text רגיל עם אותו style (ספרות טבלאיות). בלי אנימציה בעלייה ראשונה.
 */
export function AnimatedNumber({
  text,
  value,
  flash = false,
  animate = true,
  style,
  onLayout,
  onTextLayout,
  ...rest
}: AnimatedNumberProps) {
  const tokens = useDesignTokens();
  const reduceMotion = useReducedMotion();

  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  const flatRecord = flat as Record<string, unknown>;
  const wrapperStyle = pickKeys(flatRecord, WRAPPER_KEYS) as ViewStyle;
  const textStyle: TextStyle = { ...flat, fontVariant: flat.fontVariant ?? ['tabular-nums'] };
  for (const k of WRAPPER_KEYS) delete (textStyle as Record<string, unknown>)[k];
  const charStyle = pickKeys(textStyle as Record<string, unknown>, CHAR_TEXT_KEYS) as TextStyle;

  const lineRef = useRef<Line | null>(null);
  const boxWidthRef = useRef(0);
  const genRef = useRef(0);
  const fitRef = useRef<{ gen: number; rowX?: number; rowW?: number }>({ gen: 0 });

  const [shown, setShown] = useState<Shown>(() => ({
    text,
    value,
    animate,
    roll: null,
    flashGen: 0,
    flashDir: 1,
  }));

  if (shown.text !== text || shown.animate !== animate) {
    let next: Shown = { ...shown, text, value, animate, roll: null };
    if (shown.text !== text) {
      const canAnimate = animate && shown.animate && !reduceMotion;
      const numericDir =
        value != null && shown.value != null && Number.isFinite(value) && Number.isFinite(shown.value)
          ? Math.sign(value - shown.value)
          : 0;
      const dir: 1 | -1 = numericDir < 0 ? -1 : 1;
      const from = stripBidi(shown.text);
      const to = stripBidi(text);
      const line = lineRef.current;
      if (canAnimate && line && line.count === 1 && line.text === from && from !== to) {
        const boxW = boxWidthRef.current;
        const lead = line.x;
        const trail = boxW - (line.x + line.width);
        const anchor: Roll['anchor'] =
          Math.abs(lead) < 1 ? 'left' : Math.abs(trail) < 1 ? 'right' : 'center';
        genRef.current += 1;
        next.roll = {
          gen: genRef.current,
          from,
          to,
          dir,
          anchor,
          inset: anchor === 'left' ? lead : anchor === 'right' ? trail : 0,
          top: line.y,
          height: line.height,
        };
      }
      if (canAnimate && flash && numericDir !== 0) {
        next = { ...next, flashGen: shown.flashGen + 1, flashDir: dir };
      }
    }
    setShown(next);
  }

  const roll = shown.roll;

  const endRoll = useCallback((gen: number) => {
    setShown((s) => (s.roll && s.roll.gen === gen ? { ...s, roll: null } : s));
  }, []);

  // אם שורת התווים לא יושבת בדיוק על הטקסט (הקטנת פונט, קיטוע) — מחליפים בלי גלגול
  const verifyFit = useCallback(
    (gen: number) => {
      const fit = fitRef.current;
      const line = lineRef.current;
      if (fit.gen !== gen || fit.rowW == null || fit.rowX == null || !line) return;
      setShown((s) => {
        if (!s.roll || s.roll.gen !== gen || line.text !== s.roll.to) return s;
        const ok =
          line.count === 1 &&
          Math.abs(fit.rowW! - line.width) <= FIT_TOLERANCE &&
          Math.abs(fit.rowX! - line.x) <= FIT_TOLERANCE;
        return ok ? s : { ...s, roll: null };
      });
    },
    []
  );

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      boxWidthRef.current = e.nativeEvent.layout.width;
      onLayout?.(e);
    },
    [onLayout]
  );

  const handleTextLayout = useCallback(
    (e: NativeSyntheticEvent<TextLayoutEventData>) => {
      const lines = e.nativeEvent.lines;
      if (lines.length > 0) {
        const first = lines[0];
        lineRef.current = {
          x: first.x,
          y: first.y,
          width: first.width,
          height: first.height,
          text: stripBidi(lines.map((l) => l.text).join('')),
          count: lines.length,
        };
        if (fitRef.current.gen === genRef.current) verifyFit(genRef.current);
      }
      onTextLayout?.(e);
    },
    [onTextLayout, verifyFit]
  );

  const onRowMeasured = useCallback(
    (gen: number, x: number, w: number) => {
      fitRef.current = { gen, rowX: x, rowW: w };
      verifyFit(gen);
    },
    [verifyFit]
  );

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
      <Animated.Text
        {...rest}
        style={[textStyle, flashEnabled ? flashStyle : null, roll ? styles.hidden : null]}
        onLayout={handleLayout}
        onTextLayout={handleTextLayout}
      >
        {text}
      </Animated.Text>
      {roll ? (
        <RollRow
          key={roll.gen}
          roll={roll}
          charStyle={charStyle}
          flashStyle={flashEnabled ? flashStyle : null}
          allowFontScaling={rest.allowFontScaling}
          maxFontSizeMultiplier={rest.maxFontSizeMultiplier}
          onDone={endRoll}
          onMeasured={onRowMeasured}
        />
      ) : null}
    </View>
  );
}

type Cell = { ch: string; old: string | null; rolls: boolean };

function buildCells(from: string, to: string): Cell[] {
  // יישור מימין — ספרות האחדות נשארות באותה עמודה
  const offset = to.length - from.length;
  return Array.from(to).map((ch, i) => {
    const j = i - offset;
    const old = j >= 0 && j < from.length ? from[j] : null;
    return { ch, old, rolls: DIGIT.test(ch) && old !== ch };
  });
}

function RollRow({
  roll,
  charStyle,
  flashStyle,
  allowFontScaling,
  maxFontSizeMultiplier,
  onDone,
  onMeasured,
}: {
  roll: Roll;
  charStyle: TextStyle;
  flashStyle: ReturnType<typeof useAnimatedStyle> | null;
  allowFontScaling?: boolean;
  maxFontSizeMultiplier?: number | null;
  onDone: (gen: number) => void;
  onMeasured: (gen: number, x: number, w: number) => void;
}) {
  // ערך משותף חדש לכל גלגול — מתחיל ב־0 כבר ברינדור הראשון
  const p = useSharedValue(0);
  const cells = useMemo(() => buildCells(roll.from, roll.to), [roll.from, roll.to]);
  const { gen, dir, height } = roll;

  useLayoutEffect(() => {
    p.value = withTiming(1, { duration: NUMBER_ROLL_MS, easing: EASE_OUT }, (finished) => {
      if (finished) scheduleOnRN(onDone, gen);
    });
  }, [p, gen, onDone]);

  const inStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - p.value) * height * dir }],
  }));
  const outStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -p.value * height * dir }],
  }));

  const textProps = { allowFontScaling, maxFontSizeMultiplier };

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.rowLayer,
        { top: roll.top },
        roll.anchor === 'left'
          ? { justifyContent: 'flex-start', paddingLeft: roll.inset }
          : roll.anchor === 'right'
            ? { justifyContent: 'flex-end', paddingRight: roll.inset }
            : { justifyContent: 'center' },
      ]}
    >
      <View
        style={styles.row}
        onLayout={(e) => onMeasured(gen, e.nativeEvent.layout.x, e.nativeEvent.layout.width)}
      >
        {cells.map((c, i) =>
          c.rolls ? (
            <View key={i} style={[styles.cell, { height }]}>
              <RollChar style={[charStyle, flashStyle, inStyle]} {...textProps}>
                {c.ch}
              </RollChar>
              {c.old != null ? (
                <RollChar style={[charStyle, flashStyle, styles.oldChar, outStyle]} {...textProps}>
                  {c.old}
                </RollChar>
              ) : null}
            </View>
          ) : (
            <RollChar key={i} style={[charStyle, flashStyle]} {...textProps}>
              {c.ch}
            </RollChar>
          )
        )}
      </View>
    </View>
  );
}

function RollChar({
  children,
  style,
  allowFontScaling,
  maxFontSizeMultiplier,
}: {
  children: string;
  style: React.ComponentProps<typeof Animated.Text>['style'];
  allowFontScaling?: boolean;
  maxFontSizeMultiplier?: number | null;
}) {
  return (
    <Animated.Text
      style={style}
      allowFontScaling={allowFontScaling}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
    >
      {children}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  hidden: { opacity: 0 },
  rowLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    direction: 'ltr',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cell: {
    overflow: 'hidden',
  },
  oldChar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    textAlign: 'center',
  },
});
