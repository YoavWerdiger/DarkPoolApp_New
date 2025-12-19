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

    // הקלטה - אנימציות דינמיות לפי audioLevel
    let animationFrame: number;
    let lastUpdate = Date.now();
    
    const animateWaves = () => {
      if (!isRecording) return;
      
      const now = Date.now();
      const deltaTime = (now - lastUpdate) / 1000; // seconds
      lastUpdate = now;
      
      const baseLevel = Math.max(0.2, Math.min(1, audioLevel || 0.2));
      
      Animated.parallel(
        barAnimations.map((anim, index) => {
          // כל פס מקבל גובה שונה בהתבסס על audioLevel
          // וריאציה בין הפסים - כל פס קצת שונה עם תנועה דינמית
          const phase = (index / BARS_COUNT) * Math.PI * 2;
          const timePhase = now * 0.003; // מהיר יותר
          const variation = (Math.sin(phase + timePhase) + 1) / 2; // 0-1
          
          // גובה בסיסי + וריאציה דינמית
          const minHeight = 0.2;
          const maxHeight = 0.2 + (baseLevel * 0.8);
          const targetHeight = minHeight + (maxHeight - minHeight) * (0.4 + variation * 0.6);
          
          return Animated.timing(anim, {
            toValue: Math.max(0.2, Math.min(1, targetHeight)),
            duration: 50, // מהיר מאוד - מגיב מיד
            useNativeDriver: false,
          });
        })
      ).start();
      
      animationFrame = requestAnimationFrame(animateWaves);
    };

    animateWaves();
    
    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
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
    minWidth: 0, // מאפשר להתכווץ
    height: 40,
    paddingHorizontal: 4,
  },
  bar: {
    width: 3,
    backgroundColor: tokens.colors.primary.main,
    borderRadius: 1.5,
    minHeight: 4,
    maxHeight: 32,
  },
});

