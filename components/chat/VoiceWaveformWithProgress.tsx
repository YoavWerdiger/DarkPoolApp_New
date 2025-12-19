// ============================================
// Voice Waveform with Progress - גלי קול עם progress bar
// ============================================

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useDesignTokens } from '../ui/DesignTokens';

interface VoiceWaveformWithProgressProps {
  progress: Animated.AnimatedValue; // 0-1
  duration?: number; // משך ההקלטה בשניות (לא בשימוש כרגע, אבל נשמר ל-compatibility)
  isPlaying?: boolean; // האם מנגן כרגע
}

const BARS_COUNT = 30; // מספר פסים

export default function VoiceWaveformWithProgress({ 
  progress, 
  duration, // לא בשימוש כרגע
  isPlaying = false 
}: VoiceWaveformWithProgressProps) {
  const DesignTokens = useDesignTokens();
  const styles = React.useMemo(() => createStyles(DesignTokens), [DesignTokens]);
  
  // יצירת גבהים סטטיים ל-waveforms (לא דינמיים כמו בזמן הקלטה)
  // כל פס מקבל גובה אקראי אבל קבוע
  const barHeights = React.useMemo(() => {
    return Array.from({ length: BARS_COUNT }, () => {
      // גבהים אקראיים בין 0.3 ל-1.0
      return 0.3 + Math.random() * 0.7;
    });
  }, []);

  // מעקב אחרי progress value
  const [progressValue, setProgressValue] = useState(0);

  useEffect(() => {
    const listenerId = progress.addListener(({ value }) => {
      setProgressValue(value);
    });

    return () => {
      progress.removeListener(listenerId);
    };
  }, [progress]);

  return (
    <View style={styles.container}>
      {barHeights.map((height, index) => {
        // חישוב אם הפס הזה צריך להיות "מואר" לפי ה-progress
        // progress הוא 0-1, אנחנו רוצים שהפסים משמאל (RTL) יהיו מוארים
        // index 0 = משמאל (RTL), index 29 = מימין
        // barPosition = 0 (משמאל) עד 1 (מימין)
        const barPosition = index / (BARS_COUNT - 1); // 0-1 (0 = משמאל, 1 = מימין)
        
        // אם barPosition <= progressValue, הפס מואר (כבר עבר)
        // אחרת, הפס כהה (עוד לא הגענו)
        const isActive = barPosition <= progressValue;
        const opacity = isActive ? 0.8 : 0.3;
        
        return (
          <View key={index} style={styles.barContainer}>
            <Animated.View
              style={[
                styles.bar,
                {
                  height: height * 28, // גובה בין 8.4 ל-28
                  opacity: opacity,
                },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

const createStyles = (tokens: any) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    flex: 1,
    height: 40,
    paddingHorizontal: 4,
    position: 'relative',
  },
  barContainer: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    width: 3,
    backgroundColor: tokens.colors.primary.main,
    borderRadius: 1.5,
    minHeight: 9.6,
    maxHeight: 32,
  },
});
