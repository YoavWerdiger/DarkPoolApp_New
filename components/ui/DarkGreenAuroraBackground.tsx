import React, { createContext, memo, useContext, useEffect, useId, useState } from 'react';
import { isAuroraPaused, subscribeAuroraRuntime } from './auroraRuntime';
import {
  AccessibilityInfo,
  Dimensions,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/**
 * צבעים שנדגמו ממסך האייפון בתקציר הציבורי של Figma Make
 * `Create dark green animation` (1zJ5mGZ6R9JUTfCE4zSOLH).
 * שיא הזוהר ≈ #00B531; למעלה כמעט שחור; S מימין-למעלה לשמאל-למטה.
 */
export const AURORA_BASE = '#111111'; // = SoftUI.canvas
export const AURORA_GREEN = '#00B531';
export const AURORA_GREEN_DEEP = '#013B13';
export const AURORA_GREEN_BRAND = '#00C805';
/** שקיפות של שכבת האורורה (GL / fallback) מעל בסיס שחור — בלי overlay אטום. */
export const AURORA_LAYER_OPACITY = 0.5;

const FALLBACK = Dimensions.get('screen');
const LOOP_MS = 16000;

export const AuroraHostContext = createContext(false);

type Props = {
  style?: StyleProp<ViewStyle>;
  /** false = פוזה סטטית כמו בתקציר (שיט / ייצוא / reduce-motion) */
  animated?: boolean;
};

type Ribbon = {
  width: number;
  height: number;
  left: number;
  top: number;
  color: string;
  opacity: number;
};

function ribbonLayout(W: number, H: number): [Ribbon, Ribbon, Ribbon] {
  return [
    {
      // לשון ימנית עליונה
      width: W * 0.82,
      height: H * 0.58,
      left: W * 0.28,
      top: H * -0.04,
      color: AURORA_GREEN,
      opacity: 0.82,
    },
    {
      // פריחה תחתונה (הכי בהירה, שמאל-מרכז)
      width: W * 1.08,
      height: H * 0.7,
      left: W * -0.28,
      top: H * 0.4,
      color: AURORA_GREEN,
      opacity: 1,
    },
    {
      // חיבור S במרכז-ימין
      width: W * 0.58,
      height: H * 0.42,
      left: W * 0.2,
      top: H * 0.26,
      color: AURORA_GREEN_BRAND,
      opacity: 0.55,
    },
  ];
}

const Glow = memo(function Glow({ spec, gid }: { spec: Ribbon; gid: string }) {
  const rx = spec.width / 2;
  const ry = spec.height / 2;
  return (
    <Svg width={spec.width} height={spec.height}>
      <Defs>
        <RadialGradient id={gid} cx={rx} cy={ry} rx={rx} ry={ry} gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor={spec.color} stopOpacity={0.95} />
          <Stop offset="32%" stopColor={spec.color} stopOpacity={0.48} />
          <Stop offset="62%" stopColor={AURORA_GREEN_DEEP} stopOpacity={0.18} />
          <Stop offset="100%" stopColor={AURORA_BASE} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx={rx} cy={ry} rx={rx} ry={ry} fill={`url(#${gid})`} />
    </Svg>
  );
});

/**
 * רקע אורורה ירוק-כהה — fallback פרוצדורלי כש-expo-gl לא זמין.
 * האנימציה האמיתית היא ה-shader ב-GradientBackground.
 */
export const DarkGreenAuroraBackground = memo(function DarkGreenAuroraBackground({
  style,
  animated = true,
}: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [box, setBox] = useState({ w: FALLBACK.width, h: FALLBACK.height });
  const [reduceMotion, setReduceMotion] = useState(false);
  const [runtimePaused, setRuntimePaused] = useState(isAuroraPaused);
  const phase = useSharedValue(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!(width > 0 && height > 0)) return;
    setBox((prev) =>
      Math.abs(prev.w - width) < 1 && Math.abs(prev.h - height) < 1 ? prev : { w: width, h: height },
    );
  };

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (alive) setReduceMotion(value);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  useEffect(() => subscribeAuroraRuntime(() => setRuntimePaused(isAuroraPaused())), []);

  const motionOn = animated && !reduceMotion && !runtimePaused;

  useEffect(() => {
    if (!motionOn) {
      phase.value = 0;
      return;
    }
    phase.value = withRepeat(
      withTiming(1, { duration: LOOP_MS, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(phase);
  }, [motionOn, phase]);

  // phase=0 = פוזת התקציר. תנועה קטנה — לא לסובב את כל המסך.
  const upperStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: phase.value * 10 },
      { translateY: phase.value * 14 },
      { scale: 1 + phase.value * 0.05 },
      { rotate: `${12 + phase.value * 5}deg` },
    ],
  }));
  const lowerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: -phase.value * 12 },
      { translateY: -phase.value * 10 },
      { scale: 1.02 - phase.value * 0.04 },
      { rotate: `${-32 + phase.value * 6}deg` },
    ],
  }));
  const midStyle = useAnimatedStyle(() => ({
    opacity: 0.42 + phase.value * 0.2,
    transform: [
      { translateX: phase.value * 8 },
      { translateY: -phase.value * 8 },
      { rotate: `${4 - phase.value * 4}deg` },
    ],
  }));

  const [upper, lower, mid] = ribbonLayout(box.w, box.h);

  return (
    <View
      pointerEvents="none"
      onLayout={onLayout}
      style={[styles.root, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.base} />
      <View pointerEvents="none" shouldRasterizeIOS={false} style={styles.glowLayer}>
        <Animated.View
          style={[
            styles.ribbon,
            { left: upper.left, top: upper.top, width: upper.width, height: upper.height, opacity: upper.opacity },
            upperStyle,
          ]}
        >
          <Glow spec={upper} gid={`aurora-u-${uid}`} />
        </Animated.View>
        <Animated.View
          style={[
            styles.ribbon,
            { left: lower.left, top: lower.top, width: lower.width, height: lower.height, opacity: lower.opacity },
            lowerStyle,
          ]}
        >
          <Glow spec={lower} gid={`aurora-l-${uid}`} />
        </Animated.View>
        <Animated.View
          style={[
            styles.ribbon,
            { left: mid.left, top: mid.top, width: mid.width, height: mid.height, opacity: mid.opacity },
            midStyle,
          ]}
        >
          <Glow spec={mid} gid={`aurora-m-${uid}`} />
        </Animated.View>
      </View>
    </View>
  );
});

/** שכבת אורורה אחת לשורש האפליקציה — ראו AuroraHost ב-GradientBackground. */
export function useAuroraHosted(): boolean {
  return useContext(AuroraHostContext);
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    backgroundColor: AURORA_BASE,
  },
  base: {
    ...StyleSheet.absoluteFill,
    backgroundColor: AURORA_BASE,
  },
  ribbon: {
    position: 'absolute',
  },
  glowLayer: {
    ...StyleSheet.absoluteFill,
    opacity: AURORA_LAYER_OPACITY,
  },
});
