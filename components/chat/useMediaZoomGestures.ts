import { useCallback, useEffect } from 'react';
import { Dimensions } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT } = Dimensions.get('window');

/** Soft spring — WhatsApp / Photos-like zoom settle */
export const MEDIA_ZOOM_SPRING = { damping: 22, stiffness: 180, mass: 0.85 };
export const MEDIA_MIN_ZOOM = 1;
export const MEDIA_MAX_ZOOM = 5;
export const MEDIA_DOUBLE_TAP_ZOOM = 2.5;

export type UseMediaZoomGesturesOptions = {
  /** Reset zoom when this key changes (e.g. media index / url) */
  resetKey?: string | number | boolean | null;
  /** Screen size for focal-point math + pan clamps (defaults to window) */
  width?: number;
  height?: number;
  /** Optional single-tap (e.g. dismiss keyboard in preview). Exclusive with double-tap. */
  onSingleTap?: () => void;
  /** משיכה למטה כשאין זום — סוגר כמו בוואטסאפ */
  onSwipeDismiss?: () => void;
  /** החלקה אופקית כשאין זום — מעבר בין קבצים (1 = שמאלה/הבא ב-RTL, -1 = הקודם) */
  onSwipeHorizontal?: (direction: 1 | -1) => void;
  /** האם יש קובץ בכיוון (1 = הבא, -1 = הקודם) — אחרת התנגדות גומי בלי מעבר */
  canSwipeNext?: boolean;
  canSwipePrev?: boolean;
  /** Fires when zoom settles above/below 1 (e.g. to disable gallery paging). */
  onZoomChange?: (zoomed: boolean) => void;
};

/**
 * Smooth pinch / pan / double-tap zoom (Apple Photos focal-point math).
 * Attach the gesture to an untransformed wrapper; apply `animatedStyle` to the media only.
 */
export function useMediaZoomGestures(options: UseMediaZoomGesturesOptions = {}) {
  const {
    resetKey,
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
    onSingleTap,
    onZoomChange,
    onSwipeDismiss,
    onSwipeHorizontal,
    canSwipeNext = true,
    canSwipePrev = true,
  } = options;

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pinchFocalX = useSharedValue(0);
  const pinchFocalY = useSharedValue(0);
  const pinchStartScale = useSharedValue(1);
  const pinchStartTranslateX = useSharedValue(0);
  const pinchStartTranslateY = useSharedValue(0);
  const isPinching = useSharedValue(false);
  const dismissY = useSharedValue(0);
  const dismissEnabled = useSharedValue(onSwipeDismiss ? 1 : 0);

  const screenW = useSharedValue(width);
  const screenH = useSharedValue(height);

  // אסור לכתוב ל-shared value בגוף ה-render — מציף WARN של Reanimated
  useEffect(() => {
    screenW.value = width;
    screenH.value = height;
  }, [width, height, screenW, screenH]);

  useEffect(() => {
    dismissEnabled.value = onSwipeDismiss ? 1 : 0;
  }, [onSwipeDismiss, dismissEnabled]);

  const fireDismiss = useCallback(() => {
    onSwipeDismiss?.();
  }, [onSwipeDismiss]);

  const swipeEnabled = useSharedValue(onSwipeHorizontal ? 1 : 0);
  const swipeNextOk = useSharedValue(canSwipeNext ? 1 : 0);
  const swipePrevOk = useSharedValue(canSwipePrev ? 1 : 0);
  /** אחרי מעבר: הקובץ החדש נכנס מהצד הזה (פיקסלים), כמו מעבר סטוריז */
  const enterFrom = useSharedValue(0);
  useEffect(() => {
    swipeEnabled.value = onSwipeHorizontal ? 1 : 0;
    swipeNextOk.value = canSwipeNext ? 1 : 0;
    swipePrevOk.value = canSwipePrev ? 1 : 0;
  }, [onSwipeHorizontal, canSwipeNext, canSwipePrev, swipeEnabled, swipeNextOk, swipePrevOk]);
  const fireSwipe = useCallback(
    (direction: 1 | -1) => {
      onSwipeHorizontal?.(direction);
    },
    [onSwipeHorizontal],
  );

  const clampTranslation = (tx: number, ty: number, s: number) => {
    'worklet';
    if (s <= 1) return { x: 0, y: 0 };
    const maxX = (screenW.value * (s - 1)) / 2;
    const maxY = (screenH.value * (s - 1)) / 2;
    return {
      x: Math.max(-maxX, Math.min(maxX, tx)),
      y: Math.max(-maxY, Math.min(maxY, ty)),
    };
  };

  const notifyZoomChange = useCallback(
    (zoomed: boolean) => {
      onZoomChange?.(zoomed);
    },
    [onZoomChange]
  );

  const commitTransform = (s: number, tx: number, ty: number, animate: boolean) => {
    'worklet';
    const clamped = clampTranslation(tx, ty, s);
    if (animate) {
      scale.value = withSpring(s, MEDIA_ZOOM_SPRING);
      translateX.value = withSpring(clamped.x, MEDIA_ZOOM_SPRING);
      translateY.value = withSpring(clamped.y, MEDIA_ZOOM_SPRING);
    } else {
      scale.value = s;
      translateX.value = clamped.x;
      translateY.value = clamped.y;
    }
    savedScale.value = s;
    savedTranslateX.value = clamped.x;
    savedTranslateY.value = clamped.y;
    runOnJS(notifyZoomChange)(s > 1.05);
  };

  const resetZoomWorklet = () => {
    'worklet';
    commitTransform(1, 0, 0, true);
  };

  const resetZoomImmediate = useCallback(() => {
    scale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    dismissY.value = 0;
    savedScale.value = 1;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    isPinching.value = false;
    onZoomChange?.(false);
  }, [onZoomChange, dismissY, isPinching, savedScale, savedTranslateX, savedTranslateY, scale, translateX, translateY]);

  const resetZoom = useCallback(() => {
    scale.value = withSpring(1, MEDIA_ZOOM_SPRING);
    translateX.value = withSpring(0, MEDIA_ZOOM_SPRING);
    translateY.value = withSpring(0, MEDIA_ZOOM_SPRING);
    savedScale.value = 1;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    isPinching.value = false;
    onZoomChange?.(false);
  }, [onZoomChange]);

  useEffect(() => {
    if (resetKey === undefined) return;
    const from = enterFrom.value;
    resetZoomImmediate();
    if (from !== 0) {
      // החדש מחליק פנימה מהצד הנגדי
      enterFrom.value = 0;
      translateX.value = from;
      translateX.value = withTiming(0, { duration: 240, easing: Easing.out(Easing.cubic) });
    }
  }, [resetKey, resetZoomImmediate, enterFrom, translateX]);

  const pinchGesture = Gesture.Pinch()
    .onStart((event) => {
      'worklet';
      isPinching.value = true;
      pinchStartScale.value = scale.value;
      pinchStartTranslateX.value = translateX.value;
      pinchStartTranslateY.value = translateY.value;
      pinchFocalX.value = event.focalX - screenW.value / 2;
      pinchFocalY.value = event.focalY - screenH.value / 2;
    })
    .onUpdate((event) => {
      'worklet';
      if (event.numberOfPointers < 2) return;
      const rawScale = pinchStartScale.value * event.scale;
      let newScale = rawScale;
      if (rawScale < MEDIA_MIN_ZOOM) {
        newScale = MEDIA_MIN_ZOOM - (MEDIA_MIN_ZOOM - rawScale) * 0.35;
      } else if (rawScale > MEDIA_MAX_ZOOM) {
        newScale = MEDIA_MAX_ZOOM + (rawScale - MEDIA_MAX_ZOOM) * 0.25;
      }
      const start = pinchStartScale.value || 1;
      const scaleRatio = newScale / start;
      const focalX = pinchFocalX.value;
      const focalY = pinchFocalY.value;
      scale.value = newScale;
      translateX.value =
        focalX * (1 - scaleRatio) + pinchStartTranslateX.value * scaleRatio;
      translateY.value =
        focalY * (1 - scaleRatio) + pinchStartTranslateY.value * scaleRatio;
    })
    .onEnd(() => {
      'worklet';
      isPinching.value = false;
      if (scale.value < MEDIA_MIN_ZOOM) {
        resetZoomWorklet();
        return;
      }
      const targetScale = Math.min(MEDIA_MAX_ZOOM, scale.value);
      const clamped = clampTranslation(translateX.value, translateY.value, targetScale);
      commitTransform(targetScale, clamped.x, clamped.y, true);
    });

  const panGesture = Gesture.Pan()
    .maxPointers(1)
    .minDistance(8)
    .onStart(() => {
      'worklet';
      if (isPinching.value) return;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      'worklet';
      if (isPinching.value) return;
      if (scale.value <= 1) {
        // החלקה אופקית — התמונה זזה עם האצבע (מרוסן)
        if (swipeEnabled.value && Math.abs(event.translationX) > Math.abs(event.translationY)) {
          const dir = event.translationX > 0 ? 1 : -1;
          const ok = dir === 1 ? swipeNextOk.value : swipePrevOk.value;
          // עוקב אחרי האצבע 1:1; בקצה — התנגדות גומי
          translateX.value = ok ? event.translationX : event.translationX * 0.25;
          dismissY.value = 0;
          return;
        }
        if (!dismissEnabled.value) return;
        if (event.translationY <= 0 || Math.abs(event.translationX) > Math.abs(event.translationY)) {
          dismissY.value = 0;
          return;
        }
        dismissY.value = event.translationY;
        return;
      }
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    })
    .onEnd((event) => {
      'worklet';
      if (isPinching.value) return;
      if (scale.value <= 1) {
        const swipeDir: 1 | -1 = event.translationX > 0 ? 1 : -1;
        if (
          swipeEnabled.value &&
          (swipeDir === 1 ? swipeNextOk.value : swipePrevOk.value) &&
          Math.abs(event.translationX) > Math.abs(event.translationY) &&
          (Math.abs(event.translationX) > screenW.value * 0.22 || Math.abs(event.velocityX) > 600)
        ) {
          // הנוכחי יוצא מהמסך, ואז מחליפים — החדש ייכנס מהצד השני (ראה resetKey)
          enterFrom.value = -swipeDir * screenW.value;
          translateX.value = withTiming(
            swipeDir * screenW.value,
            { duration: 200, easing: Easing.out(Easing.quad) },
            (finished) => {
              if (finished) runOnJS(fireSwipe)(swipeDir);
            },
          );
          return;
        }
        translateX.value = withSpring(0, MEDIA_ZOOM_SPRING);
        if (dismissEnabled.value && (dismissY.value > 120 || event.velocityY > 900)) {
          runOnJS(fireDismiss)();
          return;
        }
        dismissY.value = withSpring(0, MEDIA_ZOOM_SPRING);
        return;
      }
      const nextX = translateX.value + event.velocityX * 0.08;
      const nextY = translateY.value + event.velocityY * 0.08;
      const clamped = clampTranslation(nextX, nextY, scale.value);
      translateX.value = withSpring(clamped.x, MEDIA_ZOOM_SPRING);
      translateY.value = withSpring(clamped.y, MEDIA_ZOOM_SPRING);
      savedTranslateX.value = clamped.x;
      savedTranslateY.value = clamped.y;
      savedScale.value = scale.value;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(280)
    .onEnd((event) => {
      'worklet';
      if (scale.value > 1.05) {
        resetZoomWorklet();
        return;
      }
      const fX = event.x - screenW.value / 2;
      const fY = event.y - screenH.value / 2;
      const nextX = -fX * (MEDIA_DOUBLE_TAP_ZOOM - 1);
      const nextY = -fY * (MEDIA_DOUBLE_TAP_ZOOM - 1);
      commitTransform(MEDIA_DOUBLE_TAP_ZOOM, nextX, nextY, true);
    });

  const singleTapGesture = onSingleTap
    ? Gesture.Tap()
        .numberOfTaps(1)
        .maxDuration(250)
        .onEnd(() => {
          'worklet';
          runOnJS(onSingleTap)();
        })
    : null;

  const tapGestures = singleTapGesture
    ? Gesture.Exclusive(doubleTapGesture, singleTapGesture)
    : doubleTapGesture;

  const zoomGesture = Gesture.Simultaneous(pinchGesture, panGesture, tapGestures);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value + dismissY.value },
      { scale: scale.value },
    ],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dismissY.value, [0, 280], [1, 0.15], Extrapolation.CLAMP),
  }));

  return {
    zoomGesture,
    animatedStyle,
    backdropStyle,
    resetZoom,
    resetZoomImmediate,
  };
}
