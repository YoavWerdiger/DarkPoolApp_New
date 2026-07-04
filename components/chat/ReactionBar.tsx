import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useDesignTokens } from '../ui/DesignTokens';
import { HapticFeedback } from '../../utils/hapticFeedback';

interface ReactionBarProps {
  onReaction: (emoji: string) => void;
  currentReaction?: string | null;
}

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥'];

export default function ReactionBar({ onReaction, currentReaction }: ReactionBarProps) {
  const tokens = useDesignTokens();

  return (
    <BlurView
      intensity={Platform.OS === 'ios' ? 50 : 25}
      tint="dark"
      style={styles.pill}
    >
      <View style={[StyleSheet.absoluteFill, styles.pillOverlay]} />
      {EMOJIS.map(emoji => {
        const isSelected = currentReaction === emoji;
        return (
          <Pressable
            key={emoji}
            onPress={() => {
              void HapticFeedback.selection();
              onReaction(emoji);
            }}
            style={({ pressed }) => [
              styles.emojiBtn,
              isSelected && styles.emojiBtnSelected,
              pressed && styles.emojiBtnPressed,
            ]}
            accessibilityLabel={`React ${emoji}`}
            accessibilityState={{ selected: isSelected }}
          >
            <Text style={[styles.emoji, isSelected && styles.emojiSelected]}>{emoji}</Text>
          </Pressable>
        );
      })}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    borderRadius: 999,
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
    gap: 2,
  },
  pillOverlay: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 999,
  },
  emojiBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  emojiBtnSelected: {
    backgroundColor: 'rgba(0,200,5,0.22)',
    transform: [{ scale: 1.1 }],
  },
  emojiBtnPressed: {
    opacity: 0.65,
    transform: [{ scale: 0.9 }],
  },
  emoji: {
    fontSize: 26,
  },
  emojiSelected: {
    transform: [{ scale: 1.1 }],
  },
});
