// ============================================
// Chat Typing Indicator Component
// ============================================
// אינדיקטור "מקליד..." בצ'אט
// ============================================

import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useDesignTokens } from '../ui/DesignTokens';
import { ChatTypingIndicator as TypingUser } from '../../types/chat.types';

interface ChatTypingIndicatorProps {
  typingUsers: TypingUser[];
}

export default function ChatTypingIndicator({ typingUsers }: ChatTypingIndicatorProps) {
  const DesignTokens = useDesignTokens();
  const styles = useMemo(() => createStyles(DesignTokens), [DesignTokens]);

  const dot1Anim = useRef(new Animated.Value(0)).current;
  const dot2Anim = useRef(new Animated.Value(0)).current;
  const dot3Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (typingUsers.length > 0) {
      // אנימציית נקודות
      const createAnimation = (animValue: Animated.Value, delay: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(animValue, {
              toValue: -6,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.timing(animValue, {
              toValue: 0,
              duration: 400,
              useNativeDriver: true,
            }),
          ])
        );
      };

      const animation = Animated.parallel([
        createAnimation(dot1Anim, 0),
        createAnimation(dot2Anim, 150),
        createAnimation(dot3Anim, 300),
      ]);

      animation.start();

      return () => {
        animation.stop();
      };
    }
  }, [typingUsers.length, dot1Anim, dot2Anim, dot3Anim]);

  if (typingUsers.length === 0) {
    return null;
  }

  // יצירת טקסט "מקליד..."
  const typingText =
    typingUsers.length === 1
      ? `${typingUsers[0].user?.display_name || 'מישהו'} מקליד...`
      : typingUsers.length === 2
      ? `${typingUsers[0].user?.display_name} ו-${typingUsers[1].user?.display_name} מקלידים...`
      : `${typingUsers.length} משתמשים מקלידים...`;

  return (
    <View style={styles.container}>
      <View style={styles.bubble}>
        <Text style={styles.text}>{typingText}</Text>
        <View style={styles.dots}>
          <Animated.View
            style={[
              styles.dot,
              { transform: [{ translateY: dot1Anim }] },
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              { transform: [{ translateY: dot2Anim }] },
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              { transform: [{ translateY: dot3Anim }] },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

// ============================================
// Styles
// ============================================

const createStyles = (tokens: any) => StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.background.secondary,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    gap: 8,
  },
  text: {
    fontSize: 14,
    color: tokens.colors.text.secondary,
    fontStyle: 'italic',
  },
  dots: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: tokens.colors.text.secondary,
  },
});

