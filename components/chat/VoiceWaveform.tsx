// ============================================
// Voice Waveform - גלי קול אמיתיים בזמן הקלטה
// כל בר = דגימת עוצמה אמיתית מה-metering, גלילה מימין לשמאל (סגנון וואטסאפ).
// ============================================

import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useDesignTokens } from '../ui/DesignTokens';

interface VoiceWaveformProps {
  isRecording: boolean;
  // ref חי של עוצמת הקול (0-1) — נקרא ישירות בלי לגרום ל-re-render של ChatInput
  audioLevelRef?: React.MutableRefObject<number>;
}

const BARS_COUNT = 48;       // הרבה ברים דקים — מראה עדין כמו וואטסאפ
const MIN_H = 2;             // גובה מינימלי — נקודה דקה בשקט
const MAX_H = 22;
const SAMPLE_INTERVAL = 45;  // ms — קצב גלילה מהיר וחלק

export default function VoiceWaveform({ isRecording, audioLevelRef }: VoiceWaveformProps) {
  const DesignTokens = useDesignTokens();
  const styles = React.useMemo(() => createStyles(DesignTokens), [DesignTokens]);

  // היסטוריית עוצמות אמיתית — הישן משמאל, החדש מימין
  const [levels, setLevels] = useState<number[]>(() => Array(BARS_COUNT).fill(0));

  useEffect(() => {
    if (!isRecording) {
      setLevels(Array(BARS_COUNT).fill(0));
      return;
    }

    const id = setInterval(() => {
      const raw = Math.max(0, Math.min(1, audioLevelRef?.current ?? 0));
      setLevels(prev => {
        const next = prev.slice(1);
        // החלקה מול הדגימה הקודמת — מעבר רך בין ברים, מראה חלק כמו וואטסאפ
        const last = prev[prev.length - 1] ?? raw;
        next.push(last * 0.4 + raw * 0.6);
        return next;
      });
    }, SAMPLE_INTERVAL);

    return () => clearInterval(id);
  }, [isRecording, audioLevelRef]);

  return (
    <View style={styles.container}>
      {levels.map((lvl, index) => {
        const height = MIN_H + lvl * (MAX_H - MIN_H);
        return (
          <View key={index} style={styles.barCell}>
            <View style={[styles.bar, { height }]} />
          </View>
        );
      })}
    </View>
  );
}

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    alignSelf: 'stretch',
    width: '100%',
    minWidth: 0,
    height: 28,
  },
  barCell: {
    flex: 1,
    minWidth: 0,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bar: {
    width: 2,
    backgroundColor: tokens.colors.text.secondary, // אפור נקי (לבן 70%) כמו וואטסאפ
    borderRadius: 999, // קפסולה — קצוות מעוגלים
  },
});
