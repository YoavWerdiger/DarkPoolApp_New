// ============================================
// Voice Waveform - גלי קול בזמן הקלטה
// ============================================

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useDesignTokens } from '../ui/DesignTokens';

interface VoiceWaveformProps {
  isRecording: boolean;
  audioLevel?: number; // 0-1
}

const BARS_COUNT = 30; // מספר פסים

export default function VoiceWaveform({ isRecording, audioLevel = 0 }: VoiceWaveformProps) {
  const DesignTokens = useDesignTokens();
  const styles = React.useMemo(() => createStyles(DesignTokens), [DesignTokens]);
  
  // אנימציות לכל פס
  const barAnimations = useRef(
    Array.from({ length: BARS_COUNT }, () => new Animated.Value(0.2))
  ).current;

  useEffect(() => {
    if (!isRecording) {
      // עצירה - כל הפסים חוזרים למינימום
      Animated.parallel(
        barAnimations.map(anim =>
          Animated.timing(anim, {
            toValue: 0.2,
            duration: 200,
            useNativeDriver: false,
          })
        )
      ).start();
      return;
    }

    // הקלטה - אנימציות רנדומליות
    const animateWaves = () => {
      Animated.parallel(
        barAnimations.map((anim, index) => {
          // גובה רנדומלי מושפע מרמת הקול
          const randomHeight = 0.2 + Math.random() * (audioLevel || 0.5) * 0.8;
          
          return Animated.timing(anim, {
            toValue: randomHeight,
            duration: 150 + Math.random() * 100,
            useNativeDriver: false,
          });
        })
      ).start(() => {
        if (isRecording) {
          animateWaves(); // המשך אנימציה
        }
      });
    };

    animateWaves();
  }, [isRecording, audioLevel]);

  return (
    <View style={styles.container}>
      {barAnimations.map((anim, index) => {
        const height = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [4, 32],
        });

        return (
          <Animated.View
            key={index}
            style={[
              styles.bar,
              {
                height,
                opacity: anim,
              },
            ]}
          />
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
    paddingHorizontal: 8,
  },
  bar: {
    width: 3,
    backgroundColor: tokens.colors.accent.main,
    borderRadius: 2,
    minHeight: 4,
  },
});

