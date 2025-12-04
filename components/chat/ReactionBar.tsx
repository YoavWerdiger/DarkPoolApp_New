import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useDesignTokens } from '../ui/DesignTokens';

interface ReactionBarProps {
  onReaction: (emoji: string) => void;
}

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥'];

export default function ReactionBar({ onReaction }: ReactionBarProps) {
  const DesignTokens = useDesignTokens();
  
  const styles = useMemo(() => StyleSheet.create({
    row: {
      flexDirection: 'row-reverse',
      backgroundColor: DesignTokens.colors.background.secondary,
      paddingHorizontal: DesignTokens.spacing.sm,
      paddingVertical: DesignTokens.spacing.xs,
      borderRadius: 50,
      alignItems: 'center',
      gap: DesignTokens.spacing.xs,
    },
    emojiBtn: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 22,
    },
    emoji: {
      fontSize: 28,
    }
  }), [DesignTokens]);

  return (
    <View style={styles.row}>
      {EMOJIS.map(emoji => (
        <Pressable
          key={emoji}
          onPress={() => onReaction(emoji)}
          style={({ pressed }) => [
            styles.emojiBtn,
            pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] }
          ]}
          accessibilityLabel={`React ${emoji}`}
        >
          <Text style={styles.emoji}>{emoji}</Text>
        </Pressable>
      ))}
    </View>
  );
}
