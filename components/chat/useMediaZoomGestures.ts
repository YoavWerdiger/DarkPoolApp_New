import { useCallback, useEffect } from 'react';
import { Dimensions } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
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

  const screenW = useSharedValue(width);
  const screenH = useSharedValue(height);
  screenW.value = width;
  screenH.value = height;

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
  };

  const resetZoomWorklet = () => {
    'worklet';
    commitTransform(1, 0, 0, true);
  };

  const resetZoomImmediate = useCallback(() => {
    scale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedScale.value = 1;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    isPinching.value = false;
  }, []);

  const resetZoom = useCallback(() => {
    scale.value = withSpring(1, MEDIA_ZOOM_SPRING);
    translateX.value = withSpring(0, MEDIA_ZOOM_SPRING);
    translateY.value = withSpring(0, MEDIA_ZOOM_SPRING);
    savedScale.value = 1;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    isPinching.value = false;
  }, []);

  useEffect(() => {
    if (resetKey === undefined) return;
    resetZoomImmediate();
  }, [resetKey, resetZoomImmediate]);

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
      if (isPinching.value || scale.value <= 1) return;
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    })
    .onEnd((event) => {
      'worklet';
      if (isPinching.value) return;
      if (scale.value <= 1) {
        resetZoomWorklet();
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
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return {
    zoomGesture,
    animatedStyle,
    resetZoom,
    resetZoomImmediate,
  };
}
