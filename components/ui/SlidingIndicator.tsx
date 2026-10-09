import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

export const SEGMENT_SLIDE_MS = 220;
const SLIDE_TIMING = { duration: SEGMENT_SLIDE_MS, easing: Easing.out(Easing.cubic) };

type Frame = { x: number; y: number; width: number; height: number };
type Slide<K> = { gen: number; from: K; to: K };

export type SlidingIndicator<K extends string> = {
  /** מה לסמן כנבחר בפריטים — null בזמן ההחלקה (המחוון מצייר את הבחירה) */
  visualSelected: K | null;
  slide: Slide<K> | null;
  /** onLayout לכל מקטע — המקטעים חייבים להיות ילדים ישירים של המיכל של המחוון */
  onItemLayout: (key: K) => (e: LayoutChangeEvent) => void;
  x: SharedValue<number>;
  y: SharedValue<number>;
  w: SharedValue<number>;
  h: SharedValue<number>;
};

/**
 * מחוון בחירה שמחליק בין מקטעים (שורת צ'יפים / בורר תקופה).
 * במנוחה לא מצויר כלום — המקטע הנבחר נראה בדיוק כמו היום; רק בזמן המעבר
 * עותק של הצ'יפ הנבחר מחליק מעל השורה ונעלם כשהוא נוחת.
 */
export function useSlidingIndicator<K extends string>(selected: K): SlidingIndicator<K> {
  const reduceMotion = useReducedMotion();
  const frames = useRef(new Map<K, Frame>());
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const w = useSharedValue(0);
  const h = useSharedValue(0);
  const genRef = useRef(0);

  const [prev, setPrev] = useState(selected);
  const [slide, setSlide] = useState<Slide<K> | null>(null);
  const slideRef = useRef<Slide<K> | null>(null);
  slideRef.current = slide;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  if (prev !== selected) {
    setPrev(selected);
    const canSlide =
      !reduceMotion && frames.current.has(prev) && frames.current.has(selected);
    if (canSlide) {
      genRef.current += 1;
      setSlide({ gen: genRef.current, from: prev, to: selected });
    } else {
      setSlide(null);
    }
  }

  const syncTo = useCallback(
    (key: K) => {
      const f = frames.current.get(key);
      if (!f) return;
      x.value = f.x;
      y.value = f.y;
      w.value = f.width;
      h.value = f.height;
    },
    [x, y, w, h]
  );

  const finish = useCallback((gen: number) => {
    setSlide((s) => (s && s.gen === gen ? null : s));
  }, []);

  useLayoutEffect(() => {
    if (!slide) {
      // במנוחה הערכים צמודים לנבחר — נקודת ההתחלה של ההחלקה הבאה
      syncTo(selected);
      return;
    }
    const to = frames.current.get(slide.to);
    if (!to) return;
    const gen = slide.gen;
    x.value = withTiming(to.x, SLIDE_TIMING);
    y.value = withTiming(to.y, SLIDE_TIMING);
    h.value = withTiming(to.height, SLIDE_TIMING);
    w.value = withTiming(to.width, SLIDE_TIMING, (finished) => {
      if (finished) scheduleOnRN(finish, gen);
    });
  }, [slide, selected, syncTo, finish, x, y, w, h]);

  const onItemLayout = useCallback(
    (key: K) => (e: LayoutChangeEvent) => {
      const { x: fx, y: fy, width, height } = e.nativeEvent.layout;
      frames.current.set(key, { x: fx, y: fy, width, height });
      if (key === selectedRef.current && !slideRef.current) syncTo(key);
    },
    [syncTo]
  );

  return {
    visualSelected: slide ? null : selected,
    slide,
    onItemLayout,
    x,
    y,
    w,
    h,
  };
}

/**
 * שכבת המחוון — ילד אחרון של אותו מיכל שבו יושבים המקטעים.
 * renderFace מצייר את הצ'יפ הנבחר (אותם צבעים/רדיוס), renderLabel את התוכן של מקטע.
 */
export function SlidingIndicatorLayer<K extends string>({
  indicator,
  renderFace,
  renderLabel,
}: {
  indicator: SlidingIndicator<K>;
  renderFace: (content: React.ReactNode) => React.ReactNode;
  renderLabel: (key: K) => React.ReactNode;
}) {
  const { slide, x, y, w, h } = indicator;
  const frameStyle = useAnimatedStyle(() => ({
    width: w.value,
    height: h.value,
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));
  if (!slide) return null;
  return (
    // direction ltr — x של onLayout פיזי, ו־left מתהפך בעץ RTL
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.layer}
    >
      <Animated.View style={[styles.frame, frameStyle]}>
        {renderFace(<LabelCrossfade key={slide.gen} slide={slide} renderLabel={renderLabel} />)}
      </Animated.View>
    </View>
  );
}

function LabelCrossfade<K extends string>({
  slide,
  renderLabel,
}: {
  slide: Slide<K>;
  renderLabel: (key: K) => React.ReactNode;
}) {
  // ערך חדש לכל מעבר — מתחיל ב־0 כבר ברינדור הראשון
  const p = useSharedValue(0);
  useLayoutEffect(() => {
    p.value = withTiming(1, SLIDE_TIMING);
  }, [p]);
  const fromStyle = useAnimatedStyle(() => ({ opacity: 1 - p.value }));
  const toStyle = useAnimatedStyle(() => ({ opacity: p.value }));
  return (
    <>
      <Animated.View style={[styles.label, fromStyle]}>{renderLabel(slide.from)}</Animated.View>
      <Animated.View style={[styles.label, toStyle]}>{renderLabel(slide.to)}</Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    direction: 'ltr',
  },
  frame: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  label: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
