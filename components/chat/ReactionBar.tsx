import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useDesignTokens } from '../ui/DesignTokens';
import { HapticFeedback } from '../../utils/hapticFeedback';

interface ReactionBarProps {
  onReaction: (emoji: string) => void;
  currentReaction?: string | null; // האימוג'י הנוכחי של המשתמש
}

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥'];

export default function ReactionBar({ onReaction, currentReaction }: ReactionBarProps) {
  const DesignTokens = useDesignTokens();
  
  const styles = useMemo(() => StyleSheet.create({
    row: {
      flexDirection: 'row',
      backgroundColor: DesignTokens.colors.background.elevated,
      paddingHorizontal: DesignTokens.spacing.md,
      paddingVertical: DesignTokens.spacing.sm,
      borderRadius: DesignTokens.borderRadius.full,
      alignItems: 'center',
      gap: DesignTokens.spacing.xs,
      borderWidth: 1,
      borderColor: DesignTokens.colors.glass.card.border,
      ...DesignTokens.shadows.sm,
    },
    emojiBtn: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: DesignTokens.borderRadius.full,
    },
    emojiBtnSelected: {
      backgroundColor: DesignTokens.colors.primary.glow,
      transform: [{ scale: 1.05 }],
    },
    emoji: {
      fontSize: DesignTokens.typography.fontSize['3xl'],
    }
  }), [DesignTokens]);

  return (
    <View style={styles.row}>
      {EMOJIS.map(emoji => {
        // סמן רק את האימוג'י הנוכחי שהמשתמש בחר
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
              isSelected && !pressed && styles.emojiBtnSelected,
              pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] }
            ]}
            accessibilityLabel={`React ${emoji}`}
            accessibilityState={{ selected: isSelected }}
          >
            <Text style={styles.emoji}>{emoji}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
