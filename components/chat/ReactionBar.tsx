import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { DesignTokens } from '../ui/DesignTokens';

interface ReactionBarProps {
  onReaction: (emoji: string) => void;
}

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥'];

export default function ReactionBar({ onReaction }: ReactionBarProps) {
  return (
    <View style={styles.row}>
      {EMOJIS.map(emoji => (
        <TouchableOpacity
          key={emoji}
          onPress={() => onReaction(emoji)}
          style={styles.emojiBtn}
          accessibilityLabel={`React ${emoji}`}
          activeOpacity={0.6}
        >
          <Text style={styles.emoji}>{emoji}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: 'rgba(28, 28, 30, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 50,
    alignItems: 'center'
  },
  emojiBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24
  },
  emoji: {
    fontSize: 28,
  }
});
