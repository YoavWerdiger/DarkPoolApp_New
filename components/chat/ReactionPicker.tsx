import React, { useMemo } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HapticFeedback } from '../../utils/hapticFeedback';
import {
  ChatBottomSheet,
  ChatSheetCancelButton,
  ChatSheetTitle,
  useChatFitContentSnap,
  useChatSheetDismiss,
  useChatSheetStyles,
} from './ChatBottomSheet';

interface ReactionPickerProps {
  visible: boolean;
  onClose: () => void;
  onReaction: (emoji: string) => void;
  messageReactions?: Array<{ emoji: string; reacted_by_me: boolean }>;
}

const EMOJI_ROWS = [
  ['👍', '❤️', '😂', '😮', '😢', '😡', '👏', '🎉'],
  ['🔥', '💯', '✨', '🌟', '💪', '🙏', '🤔', '😍'],
  ['😎', '🤩', '🥳', '😴', '🤯', '😱', '🥺', '😤'],
];

export default function ReactionPicker({
  visible,
  onClose,
  onReaction,
  messageReactions = [],
}: ReactionPickerProps) {
  const sheet = useChatSheetStyles();
  const insets = useSafeAreaInsets();
  const dismiss = useChatSheetDismiss(onClose);

  const sheetBottomPad = useMemo(() => {
    const minBottom = Platform.OS === 'android' ? 16 : 8;
    return Math.max(insets.bottom, minBottom);
  }, [insets.bottom]);

  const { snapPoint, onContentLayout } = useChatFitContentSnap(
    0.38,
    0.55,
    0.28,
    visible,
  );

  const isReactionSelected = (emoji: string) =>
    messageReactions.some((r) => r.emoji === emoji && r.reacted_by_me);

  const handleReaction = (emoji: string) => {
    void HapticFeedback.selection();
    onReaction(emoji);
    dismiss();
  };

  return (
    <ChatBottomSheet
      visible={visible}
      onClose={onClose}
      snapPoints={[snapPoint]}
      fitContent
      showBrandWatermark={false}
      contentPaddingBottom={0}
    >
      <View
        style={{ paddingHorizontal: 16, paddingBottom: sheetBottomPad, direction: 'rtl' }}
        onLayout={onContentLayout}
      >
        <ChatSheetTitle title="בחר ריאקציה" />

        <View style={sheet.emojiGrid}>
          {EMOJI_ROWS.map((row, rowIndex) => (
            <View key={rowIndex} style={sheet.emojiRow}>
              {row.map((emoji, index) => {
                const isSelected = isReactionSelected(emoji);
                return (
                  <Pressable
                    key={`${rowIndex}-${index}`}
                    onPress={() => handleReaction(emoji)}
                    style={({ pressed }) => [
                      sheet.emojiButton,
                      isSelected && sheet.emojiButtonSelected,
                      pressed && sheet.emojiButtonPressed,
                    ]}
                  >
                    <Text style={sheet.emoji}>{emoji}</Text>
                    {isSelected ? (
                      <View style={sheet.emojiSelectedBadge}>
                        <Text style={sheet.emojiSelectedBadgeText}>✓</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        <ChatSheetCancelButton onPress={dismiss} />
      </View>
    </ChatBottomSheet>
  );
}
