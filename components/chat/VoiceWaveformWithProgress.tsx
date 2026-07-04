// ============================================
// Voice Waveform With Progress - להשמעת הקלטה
// סגנון WhatsApp: ברים מעוגלים, צפופים ואחידים, progress צבעוני
// ============================================

import React, { memo, useMemo } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useDesignTokens } from '../ui/DesignTokens';

interface VoiceWaveformWithProgressProps {
  progress: Animated.Value; // 0-1
  duration: number;
  isPlaying: boolean;
  waveformData?: number[]; // Optional actual waveform data
}

const BARS_COUNT = 46;
const MAX_BAR_HEIGHT = 26;
const MIN_BAR_HEIGHT = 3.5;

// החלקה גאוסיינית קלה כדי שהברים ייראו אורגניים
function smoothArray(arr: number[], passes: number = 2): number[] {
  let result = [...arr];
  for (let p = 0; p < passes; p++) {
    const smoothed = [...result];
    for (let i = 1; i < result.length - 1; i++) {
      smoothed[i] = result[i - 1] * 0.2 + result[i] * 0.6 + result[i + 1] * 0.2;
    }
    result = smoothed;
  }
  return result;
}

const generateFallbackWaveform = (): number[] => {
  const waveform: number[] = [];
  for (let i = 0; i < BARS_COUNT; i++) {
    const t = i / (BARS_COUNT - 1);
    const envelope = 1 - Math.pow(Math.abs(t - 0.5) * 2, 1.6) * 0.55;
    const wave =
      Math.sin(i * 0.8 + 0.3) * 0.18 +
      Math.sin(i * 1.9 + 1.1) * 0.12 +
      Math.sin(i * 0.4 + 2.7) * 0.14;
    waveform.push(Math.max(0.12, Math.min(0.95, 0.45 * envelope + wave)));
  }
  return smoothArray(waveform, 2);
};

const fallbackWaveform = generateFallbackWaveform();

function VoiceWaveformWithProgress({
  progress,
  waveformData,
}: VoiceWaveformWithProgressProps) {
  const DesignTokens = useDesignTokens();
  const primaryColor = DesignTokens.colors.primary.main;
  const inactiveColor = 'rgba(255, 255, 255, 0.25)';
  const nearActiveColor = 'rgba(255, 255, 255, 0.45)';

  const displayWaveform = useMemo((): number[] => {
    if (waveformData && waveformData.length >= 4) {
      const resampled: number[] = [];
      for (let i = 0; i < BARS_COUNT; i++) {
        const srcPos = (i / (BARS_COUNT - 1)) * (waveformData.length - 1);
        const lo = Math.floor(srcPos);
        const hi = Math.min(lo + 1, waveformData.length - 1);
        const frac = srcPos - lo;
        resampled.push(waveformData[lo] * (1 - frac) + waveformData[hi] * frac);
      }

      const minVal = Math.min(...resampled);
      const maxVal = Math.max(...resampled);
      const range = maxVal - minVal;
      const normalised = range > 0.04
        ? resampled.map(v => 0.12 + ((v - minVal) / range) * 0.83)
        : resampled.map(v => Math.max(0.12, Math.min(0.95, v)));

      return smoothArray(normalised, 2);
    }
    return fallbackWaveform;
  }, [waveformData]);

  return (
    <View style={styles.container}>
      {displayWaveform.map((value, index) => {
        const barFrac = (index + 0.5) / BARS_COUNT;
        const height = Math.max(MIN_BAR_HEIGHT, value * MAX_BAR_HEIGHT);

        const lookAhead = 0.04;
        const inputStart = Math.max(0, barFrac - lookAhead);

        return (
          <View key={index} style={styles.barCell}>
            <Animated.View
              style={[
                styles.bar,
                {
                  height,
                  backgroundColor: progress.interpolate({
                    inputRange: [0, inputStart, barFrac, Math.min(1, barFrac + lookAhead), 1],
                    outputRange: [
                      inactiveColor,
                      nearActiveColor,
                      primaryColor,
                      primaryColor,
                      primaryColor,
                    ],
                    extrapolate: 'clamp',
                  }),
                  opacity: progress.interpolate({
                    inputRange: [0, inputStart, barFrac, 1],
                    outputRange: [0.38, 0.6, 1, 1],
                    extrapolate: 'clamp',
                  }),
                },
              ]}
            />
          </View>
        );
      })}
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
    height: MAX_BAR_HEIGHT,
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
    borderRadius: 999, // קפסולה מלאה — קצוות מעוגלים
  },
});
