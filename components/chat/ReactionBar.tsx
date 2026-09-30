import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { GlassChip } from '../ui/GlassChip';
import { useDesignTokens } from '../ui/DesignTokens';

interface ReactionBarProps {
  onReaction: (emoji: string) => void;
  currentReaction?: string | null;
  /** נקרא בלחיצה על כפתור "+" — פותח שיט אימוג'ים מלא */
  onOpenPicker?: () => void;
}

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥'];
const HIT_SLOP = { top: 6, bottom: 6, left: 4, right: 4 };

/**
 * שורת ריאקציות לשיט Action (LongPressOverlay).
 * משטח שטוח עדין — בלי BlurView מקונן מעל זכוכית השיט (פחות עומס).
 * TouchableOpacity מ-RNGH נשאר כדי לעבוד עם Pan של BottomSheet.
 */
export default function ReactionBar({ onReaction, currentReaction, onOpenPicker }: ReactionBarProps) {
  const tokens = useDesignTokens();
  return (
    <GlassChip
      disableBlur
      style={[styles.pill, { backgroundColor: tokens.colors.background.tertiary }]}
      contentContainerStyle={styles.pillContent}
    >
      {EMOJIS.map(emoji => {
        const isSelected = currentReaction === emoji;
        return (
          <TouchableOpacity
            key={emoji}
            hitSlop={HIT_SLOP}
            activeOpacity={0.65}
            onPress={() => {
              void HapticFeedback.selection();
              onReaction(emoji);
            }}
            style={[
              styles.emojiBtn,
              isSelected && { backgroundColor: tokens.colors.primary.dim },
            ]}
            accessibilityLabel={`React ${emoji}`}
            accessibilityState={{ selected: isSelected }}
          >
            <Text style={styles.emoji}>{emoji}</Text>
          </TouchableOpacity>
        );
      })}
      {onOpenPicker ? (
        <TouchableOpacity
          key="__open_picker__"
          hitSlop={HIT_SLOP}
          activeOpacity={0.65}
          onPress={() => {
            void HapticFeedback.selection();
            onOpenPicker();
          }}
          style={[
            styles.emojiBtn,
            styles.plusBtn,
            { backgroundColor: tokens.colors.background.cardSolid },
          ]}
          accessibilityLabel="עוד אימוג'ים"
          accessibilityRole="button"
        >
          <Ionicons name="add" size={20} color={tokens.colors.text.secondary} />
        </TouchableOpacity>
      ) : null}
    </GlassChip>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 22,
    minHeight: 0,
    overflow: 'hidden',
  },
  pillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    minHeight: 0,
    gap: 2,
  },
  emojiBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  plusBtn: {
    marginLeft: 4,
  },
  emoji: {
    fontSize: 24,
  },
});
