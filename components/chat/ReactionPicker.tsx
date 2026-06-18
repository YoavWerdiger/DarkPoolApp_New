import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HapticFeedback } from '../../utils/hapticFeedback';
import {
  ChatBottomSheet,
  ChatSheetCancelButton,
  ChatSheetContent,
  ChatSheetTitle,
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

  const isReactionSelected = (emoji: string) =>
    messageReactions.some((r) => r.emoji === emoji && r.reacted_by_me);

  const handleReaction = (emoji: string) => {
    void HapticFeedback.selection();
    onReaction(emoji);
    onClose();
  };

  return (
    <ChatBottomSheet visible={visible} onClose={onClose} snapPoints={[0.35]}>
      <ChatSheetContent style={{ paddingBottom: insets.bottom + 12 }}>
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

        <ChatSheetCancelButton onPress={onClose} />
      </ChatSheetContent>
    </ChatBottomSheet>
  );
}
