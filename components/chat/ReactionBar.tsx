import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { HapticFeedback } from '../../utils/hapticFeedback';
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
    // פיל מלא בצבע הכרטיסים (טופו) לרוחב השיט
    <View style={[styles.pill, { backgroundColor: tokens.colors.background.cardSolid }]}>
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
              isSelected && { backgroundColor: tokens.colors.background.tertiary },
            ]}
            accessibilityLabel={`React ${emoji}`}
            accessibilityState={{ selected: isSelected }}
          >
            <Text style={styles.emoji}>{emoji}</Text>
          </TouchableOpacity>
        );
      })}
      {currentReaction && !EMOJIS.includes(currentReaction) ? (
        // ריאקציה שבחרתי מהרשימה המלאה — במקום ה-«+», מסומנת; לחיצה מסירה אותה
        <TouchableOpacity
          key="__custom_reaction__"
          hitSlop={HIT_SLOP}
          activeOpacity={0.65}
          onPress={() => {
            void HapticFeedback.selection();
            onReaction(currentReaction);
          }}
          style={[styles.emojiBtn, { backgroundColor: tokens.colors.background.tertiary }]}
          accessibilityLabel={`הסר ריאקציה ${currentReaction}`}
          accessibilityState={{ selected: true }}
        >
          <Text style={styles.emoji}>{currentReaction}</Text>
        </TouchableOpacity>
      ) : onOpenPicker ? (
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
            { backgroundColor: tokens.colors.background.tertiary },
          ]}
          accessibilityLabel="עוד אימוג'ים"
          accessibilityRole="button"
        >
          <Ionicons name="add" size={20} color={tokens.colors.text.secondary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'stretch',
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  emojiBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  plusBtn: {},
  emoji: {
    fontSize: 24,
  },
});
