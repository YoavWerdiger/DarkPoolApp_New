/**
 * MessageActionSheet — legacy API; עטוף ב-ChatBottomSheet (אותו glass כמו שאר שיטי הצ׳אט).
 * המסלול הפעיל ב-ChatGroupScreen הוא LongPressOverlay.
 */
import React, { useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Mic, FileText, MessageCircle, RotateCcw, Copy, Edit, Heart } from 'lucide-react-native';
import { Message, ReactionSummary } from '../../services/supabase';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { useDesignTokens } from '../ui/DesignTokens';
import {
  ChatBottomSheet,
  ChatSheetContent,
  ChatSheetTitle,
  useChatFitContentSnap,
} from './ChatBottomSheet';
import { GlassChip } from '../ui/GlassChip';
import { sheetContentBottomPadding } from '../ui/BottomSheet/sheetGlass';

interface MessageActionSheetProps {
  visible: boolean;
  onClose: () => void;
  message: Message;
  reactions: ReactionSummary[];
  onReply: () => void;
  onForward: () => void;
  onCopy: () => void;
  onReact: () => void;
  onReactionDetails: () => void;
  onEdit?: () => void;
  onPin?: () => void;
  onUnpin?: () => void;
  canPin?: boolean;
  canEdit?: boolean;
  isPinned?: boolean;
}

export default function MessageActionSheet({
  visible,
  onClose,
  message,
  reactions,
  onReply,
  onForward,
  onCopy,
  onReact,
  onReactionDetails,
  onEdit,
  onPin,
  onUnpin,
  canPin = false,
  canEdit = false,
  isPinned = false,
}: MessageActionSheetProps) {
  const DesignTokens = useDesignTokens();
  const insets = useSafeAreaInsets();

  /** כמו MediaPickerSheet — מינימום אמין באנדרואיד כש-insets.bottom=0 (Galaxy) */
  const sheetBottomPad = useMemo(
    () => sheetContentBottomPadding(insets.bottom),
    [insets.bottom],
  );

  const actionCount = 4 + (canEdit && onEdit ? 1 : 0) + (canPin ? 1 : 0);
  const { snapPoint, onContentLayout } = useChatFitContentSnap(
    0.42 + Math.min(0.12, actionCount * 0.02),
    0.88,
    0.28,
    `${visible}-${actionCount}-${reactions?.length ?? 0}`,
  );

  const handleAction = (action: () => void) => {
    void HapticFeedback.selection();
    action();
    onClose();
  };

  const renderMessageContent = () => {
    if (message.type === 'image' || message.type === 'video') {
      return (
        <View style={[styles.mediaThumb, { backgroundColor: DesignTokens.colors.background.cardSolid }]}>
          <Ionicons
            name={message.type === 'image' ? 'image' : 'videocam'}
            size={24}
            color={DesignTokens.colors.text.tertiary}
          />
        </View>
      );
    }

    if (message.type === 'audio' || message.type === 'voice') {
      return (
        <View style={[styles.mediaThumb, { backgroundColor: DesignTokens.colors.background.cardSolid }]}>
          <Mic size={24} color={DesignTokens.colors.text.tertiary} strokeWidth={2} />
        </View>
      );
    }

    if (message.type === 'file' || message.type === 'document') {
      return (
        <View style={[styles.mediaThumb, { backgroundColor: DesignTokens.colors.background.cardSolid }]}>
          <FileText size={24} color={DesignTokens.colors.text.tertiary} strokeWidth={2} />
        </View>
      );
    }

    return (
      <View style={styles.textPreview}>
        <Text style={[styles.previewBody, { color: DesignTokens.colors.text.primary }]} numberOfLines={3}>
          {message.content}
        </Text>
      </View>
    );
  };

  const renderReactions = () => {
    if (!reactions || reactions.length === 0) return null;

    const displayReactions = reactions.slice(0, 5);
    const remainingCount = reactions.length > 5 ? reactions.length - 5 : 0;

    return (
      <View style={styles.reactionsRow}>
        {displayReactions.map((reaction, index) => (
          <GlassChip
            key={index}
            disableBlur
            onPress={onReactionDetails}
            style={[styles.reactionChip, { backgroundColor: DesignTokens.colors.background.primary }]}
            contentContainerStyle={styles.reactionChipContent}
          >
            <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
            {reaction.count > 1 && (
              <Text style={[styles.reactionCount, { color: DesignTokens.colors.text.secondary }]}>{reaction.count}</Text>
            )}
          </GlassChip>
        ))}

        {remainingCount > 0 && (
          <GlassChip
            disableBlur
            style={[styles.reactionChip, { backgroundColor: DesignTokens.colors.background.primary }]}
            contentContainerStyle={styles.reactionChipContent}
          >
            <Text style={[styles.reactionCount, { color: DesignTokens.colors.text.secondary }]}>+{remainingCount}</Text>
          </GlassChip>
        )}
      </View>
    );
  };

  const actions: Array<{
    key: string;
    label: string;
    icon: React.ReactNode;
    onPress: () => void;
  }> = [
    {
      key: 'reply',
      label: 'תגובה',
      icon: <MessageCircle size={26} color={DesignTokens.colors.accent?.main || '#00E5FF'} strokeWidth={2} />,
      onPress: onReply,
    },
    {
      key: 'forward',
      label: 'העבר',
      icon: <RotateCcw size={26} color={DesignTokens.colors.warning?.main || '#F59E0B'} strokeWidth={2} />,
      onPress: onForward,
    },
    {
      key: 'copy',
      label: 'העתק',
      icon: <Copy size={26} color={DesignTokens.colors.success?.main || '#10B981'} strokeWidth={2} />,
      onPress: onCopy,
    },
    ...(canEdit && onEdit
      ? [{
          key: 'edit',
          label: 'ערוך',
          icon: <Edit size={26} color={DesignTokens.colors.warning?.main || '#F59E0B'} strokeWidth={2} />,
          onPress: onEdit,
        }]
      : []),
    {
      key: 'react',
      label: 'ריאקציה',
      icon: <Heart size={26} color={DesignTokens.colors.danger?.main || '#EF4444'} strokeWidth={2} />,
      onPress: onReact,
    },
    ...(canPin
      ? [{
          key: 'star',
          label: isPinned ? 'הסר כוכב' : 'סמן בכוכב',
          icon: (
            <Ionicons
              name={isPinned ? 'star' : 'star-outline'}
              size={26}
              color="#FFD700"
            />
          ),
          onPress: () => {
            const fn = isPinned ? onUnpin : onPin;
            if (fn) fn();
          },
        }]
      : []),
  ];

  return (
    <ChatBottomSheet
      visible={visible}
      onClose={onClose}
      snapPoints={[snapPoint]}
      fitContent
      showBrandBackground={false}
      showBrandWatermark={false}
      contentPaddingBottom={0}
    >
      <ChatSheetContent
        onLayout={onContentLayout}
        style={{
          direction: 'rtl',
          paddingBottom: sheetBottomPad,
          backgroundColor: 'transparent',
        }}
      >
        <ChatSheetTitle title="פעולות הודעה" />

        <View
          style={[
            styles.previewCard,
            {
              backgroundColor: DesignTokens.colors.background.tertiary,
              borderColor: DesignTokens.colors.border.divider,
              borderTopColor: DesignTokens.colors.border.divider,
            },
          ]}
        >
          <View style={styles.previewRow}>
            {renderMessageContent()}
            <View style={styles.previewMeta}>
              <Text style={[styles.previewName, { color: DesignTokens.colors.text.secondary }]}>
                {message.sender?.full_name || 'משתמש'}
              </Text>
              <Text style={[styles.previewTime, { color: DesignTokens.colors.text.tertiary }]}>
                {new Date(message.created_at).toLocaleTimeString('he-IL', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          </View>
        </View>

        {renderReactions()}

        <View style={styles.actionsGrid}>
          {actions.map((action) => (
            <Pressable
              key={action.key}
              onPress={() => handleAction(action.onPress)}
              style={({ pressed }) => [
                styles.actionTile,
                {
                  backgroundColor: pressed
                    ? DesignTokens.colors.background.tertiary
                    : DesignTokens.colors.background.primary,
                  borderColor: DesignTokens.colors.border.divider,
                },
              ]}
            >
              {action.icon}
              <Text style={[styles.actionLabel, { color: DesignTokens.colors.text.primary }]}>{action.label}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={onClose}
          style={({ pressed }) => [
            styles.cancelBtn,
            {
              backgroundColor: DesignTokens.colors.background.primary,
              borderColor: DesignTokens.colors.border.divider,
            },
            pressed && { opacity: 0.75 },
          ]}
        >
          <Text style={[styles.cancelText, { color: DesignTokens.colors.text.primary }]}>ביטול</Text>
        </Pressable>
      </ChatSheetContent>
    </ChatBottomSheet>
  );
}

const styles = StyleSheet.create({
  previewCard: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    padding: 14,
    marginBottom: 12,
  },
  previewRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 10,
  },
  mediaThumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textPreview: {
    flex: 1,
  },
  previewBody: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  previewMeta: {
    flex: 1,
    alignItems: 'flex-end',
  },
  previewName: {
    fontSize: 13,
    marginBottom: 2,
  },
  previewTime: {
    fontSize: 11,
  },
  reactionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
  },
  reactionChip: {
    minWidth: 40,
    minHeight: 36,
    borderRadius: 999,
  },
  reactionChipContent: {
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'column',
  },
  reactionEmoji: {
    fontSize: 16,
  },
  reactionCount: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  actionTile: {
    width: 76,
    height: 76,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  cancelBtn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
