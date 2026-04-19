// ============================================
// Voice Waveform With Progress - להשמעת הקלטה
// מציג waveform עם progress indicator
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

const BARS_COUNT = 28;

// יצירת waveform סטטי פסאודו-רנדומי (fallback)
const generateStaticWaveform = (): number[] => {
  const waveform: number[] = [];
  for (let i = 0; i < BARS_COUNT; i++) {
    // יצירת תבנית טבעית - גבוה יותר באמצע עם יותר וריאציה
    const centerFactor = 1 - Math.abs((i - BARS_COUNT / 2) / (BARS_COUNT / 2)) * 0.4;
    const noise = Math.sin(i * 1.2) * 0.25 + Math.cos(i * 0.7) * 0.2;
    const value = 0.25 + centerFactor * 0.5 + noise;
    waveform.push(Math.max(0.15, Math.min(0.95, value)));
  }
  return waveform;
};

const staticWaveform = generateStaticWaveform();

function VoiceWaveformWithProgress({ progress, duration, isPlaying, waveformData }: VoiceWaveformWithProgressProps) {
  const DesignTokens = useDesignTokens();
  const barColor = DesignTokens.colors.primary.main;
  const inactiveColor = 'rgba(255, 255, 255, 0.3)';

  // Use provided waveform data or fallback to static
  const displayWaveform = useMemo(() => {
    if (waveformData && waveformData.length > 0) {
      // Resample to BARS_COUNT
      const result: number[] = [];
      const step = waveformData.length / BARS_COUNT;
      
      for (let i = 0; i < BARS_COUNT; i++) {
        const start = Math.floor(i * step);
        const end = Math.floor((i + 1) * step);
        let maxVal = 0;
        for (let j = start; j < end && j < waveformData.length; j++) {
          maxVal = Math.max(maxVal, waveformData[j]);
        }
        result.push(maxVal || waveformData[Math.floor(i * step)] || 0.3);
      }
      
      // Enhance contrast
      const minVal = Math.min(...result);
      const maxVal = Math.max(...result);
      const range = maxVal - minVal;
      
      if (range > 0.05) {
        return result.map(v => 0.15 + ((v - minVal) / range) * 0.85);
      }
      return result;
    }
    return staticWaveform;
  }, [waveformData]);

  return (
    <View style={styles.container}>
      {displayWaveform.map((value, index) => {
        const barProgress = (index + 1) / BARS_COUNT; // +1 to avoid 0
        const height = 3 + value * 18;

        const inputStart = Math.max(0.001, barProgress - 0.02);

        return (
          <View key={index} style={styles.barCell}>
            <Animated.View
              style={[
                styles.bar,
                {
                  height,
                  backgroundColor: progress.interpolate({
                    inputRange: [0, inputStart, barProgress, 1],
                    outputRange: [inactiveColor, inactiveColor, barColor, barColor],
                    extrapolate: 'clamp',
                  }),
                  opacity: progress.interpolate({
                    inputRange: [0, inputStart, barProgress, 1],
                    outputRange: [0.4, 0.4, 1, 1],
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
    borderRadius: 1.25,
  },
});
