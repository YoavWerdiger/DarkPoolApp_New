import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useDesignTokens } from '../ui/DesignTokens';
import { HapticFeedback } from '../../utils/hapticFeedback';
import BottomSheet from '../ui/BottomSheet/BottomSheet';

interface ReactionPickerProps {
  visible: boolean;
  onClose: () => void;
  onReaction: (emoji: string) => void;
  messageReactions?: Array<{ emoji: string; reacted_by_me: boolean }>;
}

// רשימת אימוג'ים פופולריים - מסודרים בשורות של 8
const EMOJI_ROWS = [
  ['👍', '❤️', '😂', '😮', '😢', '😡', '👏', '🎉'],
  ['🔥', '💯', '✨', '🌟', '💪', '🙏', '🤔', '😍'],
  ['😎', '🤩', '🥳', '😴', '🤯', '😱', '🥺', '😤'],
];

export default function ReactionPicker({ 
  visible, 
  onClose, 
  onReaction,
  messageReactions = []
}: ReactionPickerProps) {
  const DesignTokens = useDesignTokens();
  
  // בדיקה אם ריאקציה כבר סומנה
  const isReactionSelected = (emoji: string) => {
    return messageReactions.some(r => r.emoji === emoji && r.reacted_by_me);
  };
  
  const styles = useMemo(() => StyleSheet.create({
    container: {
      backgroundColor: DesignTokens.colors.background.primary,
      paddingTop: DesignTokens.spacing.md,
      paddingBottom: DesignTokens.spacing.xl,
      paddingHorizontal: DesignTokens.spacing.md,
    },
    header: {
      alignItems: 'center',
      marginBottom: DesignTokens.spacing.md,
    },
    titleContainer: {
      backgroundColor: DesignTokens.colors.background.secondary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
    },
    title: {
      color: DesignTokens.colors.text.primary,
      fontSize: 17,
      fontWeight: '600',
      textAlign: 'center',
    },
    emojisGrid: {
      paddingHorizontal: 4,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    emojiButton: {
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
    },
    emojiButtonPressed: {
      backgroundColor: DesignTokens.colors.background.secondary,
      transform: [{ scale: 1.15 }],
    },
    emojiButtonSelected: {
      backgroundColor: DesignTokens.colors.primary.main + '20',
      borderWidth: 2,
      borderColor: DesignTokens.colors.primary.main,
    },
    emoji: {
      fontSize: 28,
    },
    selectedIndicator: {
      position: 'absolute',
      top: 2,
      right: 2,
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: DesignTokens.colors.primary.main,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selectedIndicatorText: {
      color: DesignTokens.colors.text.primary,
      fontSize: 10,
      fontWeight: '700',
    },
    cancelButton: {
      marginTop: DesignTokens.spacing.md,
      marginHorizontal: DesignTokens.spacing.sm,
      backgroundColor: DesignTokens.colors.background.secondary,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
    },
    cancelButtonText: {
      color: DesignTokens.colors.text.secondary,
      fontSize: 16,
      fontWeight: '500',
    },
  }), [DesignTokens]);
  
  const handleReaction = (emoji: string) => {
    void HapticFeedback.selection();
    onReaction(emoji);
    onClose();
  };

  return (
    <BottomSheet
      isOpen={visible}
      onClose={onClose}
      snapPoints={[0.35]}
      showHandle={true}
      enablePanDownToClose={true}
      useModal={true}
      backdropOpacity={0.15}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>בחר ריאקציה</Text>
          </View>
        </View>

        {/* Emojis Grid - שורות מסודרות */}
        <View style={styles.emojisGrid}>
          {EMOJI_ROWS.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.row}>
              {row.map((emoji, index) => {
                const isSelected = isReactionSelected(emoji);
                return (
                  <Pressable
                    key={`${rowIndex}-${index}`}
                    onPress={() => handleReaction(emoji)}
                    style={({ pressed }) => [
                      styles.emojiButton,
                      isSelected && styles.emojiButtonSelected,
                      pressed && styles.emojiButtonPressed
                    ]}
                  >
                    <Text style={styles.emoji}>{emoji}</Text>
                    {isSelected && (
                      <View style={styles.selectedIndicator}>
                        <Text style={styles.selectedIndicatorText}>✓</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {/* Close Button */}
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [
            styles.cancelButton,
            pressed && { opacity: 0.7 }
          ]}
        >
          <Text style={styles.cancelButtonText}>ביטול</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
