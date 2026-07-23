import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { HapticFeedback } from '../../utils/hapticFeedback';

interface ReactionBarProps {
  onReaction: (emoji: string) => void;
  currentReaction?: string | null;
}

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥'];

export default function ReactionBar({ onReaction, currentReaction }: ReactionBarProps) {
  return (
    <View style={styles.row}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  // יושב ישירות על ChatBottomSheet glass — בלי pill/card מקונן
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 2,
    gap: 2,
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
