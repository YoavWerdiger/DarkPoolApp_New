import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { useDesignTokens } from '../ui/DesignTokens';

interface UnreadDividerProps {
  unreadCount: number;
  onPress?: () => void;
  /** When true, fade out then call onDismissed (WhatsApp-style, no abrupt pop). */
  dismissing?: boolean;
  onDismissed?: () => void;
}

const FADE_OUT_MS = 420;
const AUTO_HIDE_MS = 60_000;

const UnreadDivider: React.FC<UnreadDividerProps> = ({
  unreadCount,
  onPress,
  dismissing = false,
  onDismissed,
}) => {
  const DesignTokens = useDesignTokens();
  const styles = useMemo(() => createStyles(DesignTokens), [DesignTokens]);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const dismissedRef = useRef(false);
  const onDismissedRef = useRef(onDismissed);
  onDismissedRef.current = onDismissed;

  const finishDismiss = () => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    onDismissedRef.current?.();
  };

  useEffect(() => {
    if (!dismissing) return;
    const anim = Animated.timing(fadeAnim, {
      toValue: 0,
      duration: FADE_OUT_MS,
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      if (finished) finishDismiss();
    });
    return () => anim.stop();
  }, [dismissing, fadeAnim]);

  useEffect(() => {
    if (dismissing || unreadCount <= 0) return;
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 1500,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) finishDismiss();
      });
    }, AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [dismissing, unreadCount, fadeAnim]);

  if (unreadCount <= 0) {
    return null;
  }

  const text = unreadCount === 1 ? 'הודעה חדשה' : `${unreadCount} הודעות חדשות`;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Pressable onPress={onPress} disabled={!onPress || dismissing}>
        <View style={styles.content}>
          <View style={styles.line} />
          <View style={styles.badge}>
            <Text style={styles.text}>{text}</Text>
          </View>
          <View style={styles.line} />
        </View>
      </Pressable>
    </Animated.View>
  );
};

const createStyles = (tokens: any) => StyleSheet.create({
  container: {
    marginVertical: 10,
    marginHorizontal: 10,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: {
    flex: 1,
    height: 1.5,
    backgroundColor: tokens.colors.primary.main,
    opacity: 0.6,
  },
  badge: {
    backgroundColor: tokens.colors.primary.main,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    marginHorizontal: 12,
  },
  text: {
    color: tokens.colors.text.inverse,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default UnreadDivider;
