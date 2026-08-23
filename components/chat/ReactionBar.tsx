import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { chatPalette } from './chatDesignTokens';

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
  return (
    <View style={styles.pill}>
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
            style={[styles.emojiBtn, isSelected && styles.emojiBtnSelected]}
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
          style={[styles.emojiBtn, styles.plusBtn]}
          accessibilityLabel="עוד אימוג'ים"
          accessibilityRole="button"
        >
          <Ionicons name="add" size={20} color={chatPalette.textSecondary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    borderRadius: 22,
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
    gap: 2,
  },
  emojiBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  emojiBtnSelected: {
    backgroundColor: 'rgba(0,200,5,0.18)',
  },
  plusBtn: {
    marginLeft: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  emoji: {
    fontSize: 24,
  },
});
