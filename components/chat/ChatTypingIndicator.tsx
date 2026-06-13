import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useDesignTokens } from '../ui/DesignTokens';
import { ChatTypingIndicator as TypingUser } from '../../types/chat.types';

interface ChatTypingIndicatorProps {
  typingUsers: TypingUser[];
}

function ChatTypingIndicator({ typingUsers }: ChatTypingIndicatorProps) {
  const DesignTokens = useDesignTokens();
  const styles = useMemo(() => createStyles(DesignTokens), [DesignTokens]);

  const dot1Anim = useRef(new Animated.Value(0)).current;
  const dot2Anim = useRef(new Animated.Value(0)).current;
  const dot3Anim = useRef(new Animated.Value(0)).current;

  // Entrance animation
  const enterAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(6)).current;

  useEffect(() => {
    if (typingUsers.length > 0) {
      // Slide + fade in
      Animated.parallel([
        Animated.spring(enterAnim, {
          toValue: 1,
          speed: 22,
          bounciness: 6,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          speed: 22,
          bounciness: 4,
          useNativeDriver: true,
        }),
      ]).start();

      // Bouncing dots
      const createDotAnim = (val: Animated.Value, delay: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(val, { toValue: -5, duration: 380, useNativeDriver: true }),
            Animated.timing(val, { toValue: 0,  duration: 380, useNativeDriver: true }),
          ])
        );

      const dots = Animated.parallel([
        createDotAnim(dot1Anim, 0),
        createDotAnim(dot2Anim, 140),
        createDotAnim(dot3Anim, 280),
      ]);
      dots.start();

      return () => {
        dots.stop();
        enterAnim.setValue(0);
        slideAnim.setValue(6);
      };
    }
  }, [typingUsers.length, dot1Anim, dot2Anim, dot3Anim, enterAnim, slideAnim]);

  if (typingUsers.length === 0) return null;

  const typingText =
    typingUsers.length === 1
      ? `${typingUsers[0].user?.display_name ?? 'מישהו'} מקליד...`
      : typingUsers.length === 2
      ? `${typingUsers[0].user?.display_name ?? 'מישהו'} ו-${typingUsers[1].user?.display_name ?? 'מישהו'} מקלידים...`
      : `${typingUsers.length} משתמשים מקלידים...`;

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity: enterAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={styles.bubble}>
        <View style={styles.dots}>
          <Animated.View style={[styles.dot, { transform: [{ translateY: dot1Anim }] }]} />
          <Animated.View style={[styles.dot, { transform: [{ translateY: dot2Anim }] }]} />
          <Animated.View style={[styles.dot, { transform: [{ translateY: dot3Anim }] }]} />
        </View>
        <Text style={styles.text}>{typingText}</Text>
      </View>
    </Animated.View>
  );
}

const createStyles = (tokens: any) => StyleSheet.create({
  container: {
    paddingHorizontal: tokens.spacing.md,
    paddingBottom: tokens.spacing.xs,
  },
  bubble: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: tokens.colors.background.secondary,
    borderRadius: tokens.borderRadius.lg,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm + 1,
    alignSelf: 'flex-end',
    gap: tokens.spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  text: {
    fontSize: tokens.typography.bodySmall.size,
    color: tokens.colors.text.secondary,
    fontStyle: 'italic',
  },
  dots: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: tokens.colors.text.tertiary,
  },
});

export default ChatTypingIndicator;
