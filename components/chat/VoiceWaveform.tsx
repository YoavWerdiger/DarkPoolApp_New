// ============================================
// Voice Waveform - גלי קול בזמן הקלטה
// רץ ברציפות, מתרחב מהאמצע לפי רמת הקול
// ============================================

import React, { useEffect, useRef, useState, memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useDesignTokens } from '../ui/DesignTokens';

interface VoiceWaveformProps {
  isRecording: boolean;
  audioLevel?: number; // 0-1
}

const BARS_COUNT = 28;
const UPDATE_INTERVAL = 100; // ms – reduced from 45ms to lower CPU usage

export default function VoiceWaveform({ isRecording, audioLevel = 0 }: VoiceWaveformProps) {
  const DesignTokens = useDesignTokens();
  const barColor = DesignTokens.colors.primary.main;
  
  // מערך ערכים - מתעדכן ב-interval קבוע
  const [barValues, setBarValues] = useState<number[]>(() => 
    Array(BARS_COUNT).fill(0.1)
  );
  
  // שמירת ה-audioLevel האחרון ב-ref כדי לגשת אליו מה-interval
  const audioLevelRef = useRef(audioLevel);
  audioLevelRef.current = audioLevel;
  
  useEffect(() => {
    if (!isRecording) {
      // איפוס
      setBarValues(Array(BARS_COUNT).fill(0.1));
      return;
    }
    
    // interval שרץ כל הזמן ומזיז את ה-bars
    const interval = setInterval(() => {
      setBarValues(prev => {
        const newValues = [...prev];
        // הזזה שמאלה
        for (let i = 0; i < BARS_COUNT - 1; i++) {
          newValues[i] = newValues[i + 1];
        }
        // הוספת ערך חדש מימין - הערך הנוכחי של audioLevel עם הגברה
        const currentLevel = audioLevelRef.current;
        // הגברת הרגישות - כפול 1.5 והוספת רעש קל לטבעיות
        const amplified = (currentLevel || 0.1) * 1.5;
        const noise = Math.random() * 0.1;
        newValues[BARS_COUNT - 1] = Math.max(0.1, Math.min(1, amplified + noise));
        return newValues;
      });
    }, UPDATE_INTERVAL);
    
    return () => clearInterval(interval);
  }, [isRecording]);
  
  return (
    <View style={styles.container}>
      {barValues.map((value, index) => (
        <Bar key={index} value={value} color={barColor} />
      ))}
    </View>
  );
}

// קומפוננטת Bar פשוטה - גובה ישיר בלי אנימציה מורכבת
const Bar = memo(({ value, color }: { value: number; color: string }) => {
  const height = 3 + value * 18; // 3-21px
  
  return (
    <View style={styles.barWrapper}>
      <View
        style={[
          styles.bar,
          { 
            backgroundColor: color,
            height,
            opacity: 0.5 + value * 0.5,
          },
        ]}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flex: 1,
    minWidth: 0,
    height: 24,
  },
  barWrapper: {
    width: 3,
    marginRight: 2,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bar: {
    width: 2.5,
    borderRadius: 1.25,
  },
});

