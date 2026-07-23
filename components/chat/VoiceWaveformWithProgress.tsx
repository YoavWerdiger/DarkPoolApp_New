// ============================================
// Voice Waveform With Progress — השמעה + סקראב
// Reanimated UI-thread playhead (כמו הוויבפורם / סקראבר וידאו)
// ============================================

import React, { memo, useMemo, useState } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import Animated, {
  interpolateColor,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useDesignTokens } from '../ui/DesignTokens';
import { flatWaveformBars, normalizeWaveformSamples, WAVEFORM_DISPLAY_BARS } from '../../utils/waveformSamples';

export interface VoiceWaveformWithProgressProps {
  /** 0–1 — SharedValue על ה-UI thread */
  progress: SharedValue<number>;
  duration?: number;
  isPlaying?: boolean;
  waveformData?: number[];
  /** מאפשר גרירה/טאפ לסייק */
  interactive?: boolean;
  onScrubStart?: () => void;
  onScrubUpdate?: (progress01: number) => void;
  onScrubEnd?: (progress01: number) => void;
  thumbColor?: string;
  activeColor?: string;
  inactiveColor?: string;
  nearActiveColor?: string;
}

const BARS_COUNT = WAVEFORM_DISPLAY_BARS;
const MAX_BAR_HEIGHT = 26;
const MIN_BAR_HEIGHT = 3.5;
const THUMB_SIZE = 12;

function WaveBar({
  index,
  value,
  progress,
  activeColor,
  inactiveColor,
  nearActiveColor,
}: {
  index: number;
  value: number;
  progress: SharedValue<number>;
  activeColor: string;
  inactiveColor: string;
  nearActiveColor: string;
}) {
  const barFrac = (index + 0.5) / BARS_COUNT;
  const lookAhead = 0.04;
  const inputStart = Math.max(0, barFrac - lookAhead);
  const height = Math.max(MIN_BAR_HEIGHT, value * MAX_BAR_HEIGHT);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const color =
      p <= inputStart
        ? inactiveColor
        : p >= barFrac
          ? activeColor
          : interpolateColor(
              p,
              [inputStart, barFrac],
              [nearActiveColor, activeColor],
            );
    const opacity =
      p <= inputStart ? 0.38 : p >= barFrac ? 1 : 0.38 + ((p - inputStart) / (barFrac - inputStart || 1)) * 0.62;
    return {
      height,
      backgroundColor: color,
      opacity,
    };
  });

  return (
    <View style={styles.barCell}>
      <Animated.View style={[styles.bar, style]} />
    </View>
  );
}

function VoiceWaveformWithProgress({
  progress,
  waveformData,
  interactive = false,
  onScrubStart,
  onScrubUpdate,
  onScrubEnd,
  thumbColor,
  activeColor,
  inactiveColor = 'rgba(255, 255, 255, 0.25)',
  nearActiveColor = 'rgba(255, 255, 255, 0.45)',
}: VoiceWaveformWithProgressProps) {
  const DesignTokens = useDesignTokens();
  const resolvedActive = activeColor ?? DesignTokens.colors.primary.main;
  const resolvedThumb = thumbColor ?? DesignTokens.colors.accent.main;

  const trackWidthSV = useSharedValue(0);
  const scrubStartSV = useSharedValue(0);
  const isScrubbingSV = useSharedValue(0);
  const [trackWidth, setTrackWidth] = useState(0);

  const displayWaveform = useMemo((): number[] => {
    if (waveformData && waveformData.length >= 2) {
      return normalizeWaveformSamples(waveformData, BARS_COUNT);
    }
    return flatWaveformBars(BARS_COUNT);
  }, [waveformData]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - trackWidth) > 0.5) {
      setTrackWidth(w);
      trackWidthSV.value = w;
    }
  };

  const thumbStyle = useAnimatedStyle(() => {
    const w = trackWidthSV.value;
    const p = Math.max(0, Math.min(1, progress.value));
    if (w <= 0) return { opacity: 0, transform: [{ translateX: 0 }] };
    return {
      opacity: 1,
      transform: [{ translateX: p * w - THUMB_SIZE / 2 }],
    };
  });

  const clampProgress = (raw: number) => {
    'worklet';
    return Math.max(0, Math.min(1, raw));
  };

  const panGesture = Gesture.Pan()
    .enabled(interactive)
    .minDistance(2)
    .onStart(() => {
      'worklet';
      isScrubbingSV.value = 1;
      scrubStartSV.value = progress.value;
      if (onScrubStart) runOnJS(onScrubStart)();
    })
    .onUpdate((e) => {
      'worklet';
      const w = trackWidthSV.value;
      if (w <= 0) return;
      const next = clampProgress(scrubStartSV.value + e.translationX / w);
      progress.value = next;
      if (onScrubUpdate) runOnJS(onScrubUpdate)(next);
    })
    .onEnd(() => {
      'worklet';
      isScrubbingSV.value = 0;
      const final = clampProgress(progress.value);
      progress.value = final;
      if (onScrubEnd) runOnJS(onScrubEnd)(final);
    })
    .onFinalize(() => {
      'worklet';
      if (isScrubbingSV.value > 0.5) {
        isScrubbingSV.value = 0;
        if (onScrubEnd) runOnJS(onScrubEnd)(clampProgress(progress.value));
      }
    });

  const tapGesture = Gesture.Tap()
    .enabled(interactive)
    .onEnd((e) => {
      'worklet';
      const w = trackWidthSV.value;
      if (w <= 0) return;
      const next = clampProgress(e.x / w);
      progress.value = next;
      if (onScrubStart) runOnJS(onScrubStart)();
      if (onScrubEnd) runOnJS(onScrubEnd)(next);
    });

  const gesture = Gesture.Exclusive(panGesture, tapGesture);

  const bars = (
    <View style={styles.barsRow} onLayout={onLayout}>
      {displayWaveform.map((value, index) => (
        <WaveBar
          key={index}
          index={index}
          value={value}
          progress={progress}
          activeColor={resolvedActive}
          inactiveColor={inactiveColor}
          nearActiveColor={nearActiveColor}
        />
      ))}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.thumb,
          { backgroundColor: resolvedThumb, width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: THUMB_SIZE / 2 },
          thumbStyle,
        ]}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      {interactive ? <GestureDetector gesture={gesture}>{bars}</GestureDetector> : bars}
    </View>
  );
}

export default memo(VoiceWaveformWithProgress);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    alignSelf: 'stretch',
    width: '100%',
    minWidth: 0,
    height: MAX_BAR_HEIGHT + 4,
  },
  barsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    width: '100%',
    minWidth: 0,
    height: MAX_BAR_HEIGHT + 4,
    position: 'relative',
  },
  barCell: {
    flex: 1,
    minWidth: 0,
    height: MAX_BAR_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bar: {
    width: 3,
    borderRadius: 999,
  },
  thumb: {
    position: 'absolute',
    left: 0,
    top: '50%',
    marginTop: -THUMB_SIZE / 2,
    zIndex: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
    elevation: 3,
  },
});
