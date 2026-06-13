// ============================================
// Voice Waveform - גלי קול בזמן הקלטה
// רץ ברציפות, מתרחב לפי רמת הקול
// עיצוב: חלק, טבעי, ממורכז, עם צבע ראשי
// ============================================

import React, { useEffect, useRef, memo, useCallback } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useDesignTokens } from '../ui/DesignTokens';

interface VoiceWaveformProps {
  isRecording: boolean;
  audioLevel?: number; // 0-1
}

const BARS_COUNT = 32;
const UPDATE_INTERVAL = 80; // ms — smooth but CPU-friendly

// Rolling average smoother — reduces choppiness between frames
function smoothValue(prev: number, next: number, factor: number): number {
  return prev + (next - prev) * factor;
}

// Bar component with spring-like Animated height
const Bar = memo(({ animValue, maxHeight, color, opacity }: {
  animValue: Animated.Value;
  maxHeight: number;
  color: string;
  opacity: number;
}) => {
  return (
    <View style={styles.barCell}>
      <Animated.View
        style={[
          styles.bar,
          {
            backgroundColor: color,
            opacity,
            height: animValue.interpolate({
              inputRange: [0, 1],
              outputRange: [3, maxHeight],
              extrapolate: 'clamp',
            }),
          },
        ]}
      />
    </View>
  );
});

export default function VoiceWaveform({ isRecording, audioLevel = 0 }: VoiceWaveformProps) {
  const DesignTokens = useDesignTokens();
  const primaryColor = DesignTokens.colors.primary.main;

  // Animated values — one per bar, persisted across renders
  const animValues = useRef<Animated.Value[]>(
    Array.from({ length: BARS_COUNT }, () => new Animated.Value(0.1))
  ).current;

  // Raw bar values (smoothed), kept in a ref to avoid stale closures
  const barDataRef = useRef<number[]>(Array(BARS_COUNT).fill(0.1));
  const audioLevelRef = useRef(audioLevel);
  audioLevelRef.current = audioLevel;

  // Animate a single bar to its target value with spring physics
  const animateBar = useCallback((index: number, targetValue: number) => {
    Animated.spring(animValues[index], {
      toValue: targetValue,
      useNativeDriver: false,
      speed: 18,        // fast response
      bounciness: 2,    // subtle spring — feels organic, not bouncy
    }).start();
  }, [animValues]);

  useEffect(() => {
    if (!isRecording) {
      // Gentle decay to baseline
      barDataRef.current = Array(BARS_COUNT).fill(0.1);
      animValues.forEach(av => {
        Animated.spring(av, {
          toValue: 0.1,
          useNativeDriver: false,
          speed: 10,
          bounciness: 0,
        }).start();
      });
      return;
    }

    const interval = setInterval(() => {
      const bars = barDataRef.current;

      // Shift bars left (oldest on left, newest on right — natural scroll direction)
      for (let i = 0; i < BARS_COUNT - 1; i++) {
        bars[i] = bars[i + 1];
      }

      // Build the new sample for the right edge
      const raw = audioLevelRef.current || 0;
      // Small random organic noise layered on top
      const noise = (Math.random() - 0.5) * 0.06;
      const newSample = Math.max(0.05, Math.min(1, raw + noise));

      // Smooth the new sample into the previous right-edge value
      bars[BARS_COUNT - 1] = smoothValue(bars[BARS_COUNT - 2] ?? newSample, newSample, 0.55);

      // Animate every bar to its new value
      for (let i = 0; i < BARS_COUNT; i++) {
        animateBar(i, bars[i]);
      }
    }, UPDATE_INTERVAL);

    return () => clearInterval(interval);
  }, [isRecording, animateBar]);

  return (
    <View style={styles.container}>
      {animValues.map((av, index) => {
        // Bars closer to the right (newest) are brighter/more opaque
        // Bars on the far left fade out, creating a natural trail effect
        const ageFactor = index / (BARS_COUNT - 1); // 0 (oldest) → 1 (newest)
        const opacity = 0.28 + ageFactor * 0.72; // 0.28 → 1.0

        return (
          <Bar
            key={index}
            animValue={av}
            maxHeight={24}
            color={primaryColor}
            opacity={opacity}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    alignSelf: 'stretch',
    width: '100%',
    minWidth: 0,
    height: 24,
  },
  barCell: {
    flex: 1,
    minWidth: 0,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bar: {
    width: 2.5,
    borderRadius: 2,
  },
});
