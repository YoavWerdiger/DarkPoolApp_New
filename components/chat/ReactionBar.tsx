import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useDesignTokens } from '../ui/DesignTokens';

interface ReactionBarProps {
  onReaction: (emoji: string) => void;
  currentReaction?: string | null; // האימוג'י הנוכחי של המשתמש
}

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥'];

export default function ReactionBar({ onReaction, currentReaction }: ReactionBarProps) {
  const DesignTokens = useDesignTokens();
  
  const styles = useMemo(() => StyleSheet.create({
    row: {
      flexDirection: 'row-reverse',
      backgroundColor: 'rgba(6, 18, 12, 0.8)',
      paddingHorizontal: DesignTokens.spacing.md,
      paddingVertical: DesignTokens.spacing.sm,
      borderRadius: 50,
      alignItems: 'center',
      gap: DesignTokens.spacing.xs,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 3,
    },
    emojiBtn: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 22,
    },
    emojiBtnSelected: {
      backgroundColor: 'rgba(5, 209, 87, 0.25)',
      transform: [{ scale: 1.05 }],
    },
    emoji: {
      fontSize: 28,
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
            onPress={() => onReaction(emoji)}
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
