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
import { chatPalette } from './chatDesignTokens';
import {
  SHEET_GLASS_INTENSITY,
  SHEET_GLASS_OVERLAY,
  sheetContentBottomPadding,
} from '../ui/BottomSheet/sheetGlass';
import { BlurView } from 'expo-blur';

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
        <View style={styles.mediaThumb}>
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
        <View style={styles.mediaThumb}>
          <Mic size={24} color={DesignTokens.colors.text.tertiary} strokeWidth={2} />
        </View>
      );
    }

    if (message.type === 'file' || message.type === 'document') {
      return (
        <View style={styles.mediaThumb}>
          <FileText size={24} color={DesignTokens.colors.text.tertiary} strokeWidth={2} />
        </View>
      );
    }

    return (
      <View style={styles.textPreview}>
        <Text style={styles.previewBody} numberOfLines={3}>
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
          <Pressable
            key={index}
            onPress={onReactionDetails}
            style={styles.reactionChip}
          >
            <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
            {reaction.count > 1 && (
              <Text style={styles.reactionCount}>{reaction.count}</Text>
            )}
          </Pressable>
        ))}

        {remainingCount > 0 && (
          <View style={styles.reactionChip}>
            <Text style={styles.reactionCount}>+{remainingCount}</Text>
          </View>
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
      useGlassBackground
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

        <BlurView
          intensity={SHEET_GLASS_INTENSITY}
          tint="dark"
          style={styles.previewCard}
        >
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: SHEET_GLASS_OVERLAY }]}
          />
          <View style={styles.previewRow}>
            {renderMessageContent()}
            <View style={styles.previewMeta}>
              <Text style={styles.previewName}>
                {message.sender?.full_name || 'משתמש'}
              </Text>
              <Text style={styles.previewTime}>
                {new Date(message.created_at).toLocaleTimeString('he-IL', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          </View>
        </BlurView>

        {renderReactions()}

        <View style={styles.actionsGrid}>
          {actions.map((action) => (
            <Pressable
              key={action.key}
              onPress={() => handleAction(action.onPress)}
              style={({ pressed }) => [
                styles.actionTile,
                pressed && styles.actionTilePressed,
              ]}
            >
              {action.icon}
              <Text style={styles.actionLabel}>{action.label}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.75 }]}
        >
          <Text style={styles.cancelText}>ביטול</Text>
        </Pressable>
      </ChatSheetContent>
    </ChatBottomSheet>
  );
}

const styles = StyleSheet.create({
  previewCard: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
    borderTopColor: 'rgba(255,255,255,0.22)',
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
    backgroundColor: chatPalette.glassStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textPreview: {
    flex: 1,
  },
  previewBody: {
    color: chatPalette.text,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'right',
  },
  previewMeta: {
    flex: 1,
    alignItems: 'flex-end',
  },
  previewName: {
    color: chatPalette.textSecondary,
    fontSize: 13,
    marginBottom: 2,
  },
  previewTime: {
    color: chatPalette.textTertiary,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: chatPalette.glassBorderStrong,
    backgroundColor: chatPalette.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionEmoji: {
    fontSize: 16,
  },
  reactionCount: {
    fontSize: 11,
    color: chatPalette.textSecondary,
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
    backgroundColor: chatPalette.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: chatPalette.glassBorder,
    gap: 6,
  },
  actionTilePressed: {
    backgroundColor: chatPalette.glassStrong,
    opacity: 0.9,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: chatPalette.text,
    textAlign: 'center',
  },
  cancelBtn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: chatPalette.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: chatPalette.glassBorder,
  },
  cancelText: {
    color: chatPalette.text,
    fontSize: 16,
    fontWeight: '600',
  },
});
