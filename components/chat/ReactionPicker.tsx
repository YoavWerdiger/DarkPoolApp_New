import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useDesignTokens } from '../ui/DesignTokens';
import BottomSheet from '../ui/BottomSheet/BottomSheet';

interface ReactionPickerProps {
  visible: boolean;
  onClose: () => void;
  onReaction: (emoji: string) => void;
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
  onReaction 
}: ReactionPickerProps) {
  const DesignTokens = useDesignTokens();
  
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
    },
    emojiButtonPressed: {
      backgroundColor: DesignTokens.colors.background.secondary,
      borderRadius: 12,
      transform: [{ scale: 1.15 }],
    },
    emoji: {
      fontSize: 28,
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
          <Text style={styles.title}>בחר ריאקציה</Text>
        </View>

        {/* Emojis Grid - שורות מסודרות */}
        <View style={styles.emojisGrid}>
          {EMOJI_ROWS.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.row}>
              {row.map((emoji, index) => (
                <Pressable
                  key={`${rowIndex}-${index}`}
                  onPress={() => handleReaction(emoji)}
                  style={({ pressed }) => [
                    styles.emojiButton,
                    pressed && styles.emojiButtonPressed
                  ]}
                >
                  <Text style={styles.emoji}>{emoji}</Text>
                </Pressable>
              ))}
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
