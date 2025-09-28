import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { DesignTokens } from '../ui/DesignTokens';

interface ReactionBarProps {
  onReaction: (emoji: string) => void;
}

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '😍', '➕'];

export default function ReactionBar({ onReaction }: ReactionBarProps) {
  return (
    <View style={styles.row}>
      {EMOJIS.map(emoji => (
        <TouchableOpacity
          key={emoji}
          onPress={() => onReaction(emoji)}
          style={styles.emojiBtn}
          accessibilityLabel={`React ${emoji}`}
        >
          <Text style={styles.emoji}>{emoji}</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={[styles.emojiBtn, styles.plus]}>
        <Text style={styles.emoji}>+</Text>
      </TouchableOpacity>
      <View style={{ width: 16 }} />
      <View style={styles.otherTag}><Text style={styles.otherTagText}>other</Text></View>
      <View style={{ width: 8 }} />
      <Text style={styles.otherPlain}>other</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 32,
    paddingVertical: 24,
    borderRadius: 72,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    elevation: 12,
  },
  emojiBtn: {
    paddingHorizontal: 28,
    paddingVertical: 18,
    minWidth: 148,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 60,
  },
  plus: {
    backgroundColor: '#222',
    borderRadius: 44,
  },
  otherTag: {
    backgroundColor: '#3A3A3A',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  otherTagText: {
    color: '#E5E7EB',
    fontSize: 18,
    fontWeight: '600',
  },
  otherPlain: {
    color: '#E5E7EB',
    fontSize: 18,
  },
});
