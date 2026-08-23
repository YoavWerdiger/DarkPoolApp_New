/**
 * ActionMenu — legacy API שעטוף ב-ChatBottomSheet (אותו chrome כמו שאר שיטי הצ׳אט).
 * המסלול הפעיל ב-ChatGroupScreen הוא LongPressOverlay; כאן לשמירת תאימות.
 */
import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Plus, Copy, Share, Star, Flag, Trash2, Edit, Reply, Forward, Info, Pin } from 'lucide-react-native';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { useDesignTokens } from '../ui/DesignTokens';
import { chatPalette } from './chatDesignTokens';
import {
  ChatBottomSheet,
  ChatSheetContent,
  useChatFitContentSnap,
} from './ChatBottomSheet';
import {
  SHEET_GLASS_INTENSITY,
  SHEET_GLASS_OVERLAY,
} from '../ui/BottomSheet/sheetGlass';

type ActionItem = {
  key: string;
  label: string;
  icon?: string;
  destructive?: boolean;
  onPress: () => void;
};

interface ActionMenuProps {
  visible: boolean;
  onClose: () => void;
  isMe: boolean;
  items: ActionItem[];
  preview?: React.ReactNode;
  onReact?: (emoji: string) => void;
  onOpenPicker?: () => void;
  messageId?: string;
  currentReactions?: { [emoji: string]: string[] };
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '💯', '🎉', '👏'];

export default function ActionMenu({
  visible,
  onClose,
  isMe,
  items,
  preview,
  onReact,
  onOpenPicker,
}: ActionMenuProps) {
  const DesignTokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const [selectedReaction, setSelectedReaction] = useState<string | null>(null);

  const sheetBottomPad = useMemo(() => {
    const minBottom = Platform.OS === 'android' ? 16 : 8;
    return Math.max(insets.bottom, minBottom);
  }, [insets.bottom]);

  const { snapPoint, onContentLayout } = useChatFitContentSnap(
    preview ? 0.48 : 0.38,
    0.92,
    0.18,
    `${visible}-${items.length}-${!!preview}`,
  );

  useEffect(() => {
    if (!visible) setSelectedReaction(null);
  }, [visible]);

  const handleReactionPress = (emoji: string) => {
    setSelectedReaction(emoji);
    void HapticFeedback.selection();
    onReact?.(emoji);
    setTimeout(() => onClose(), 150);
  };

  const getIcon = (iconName?: string, isDestructive?: boolean) => {
    const iconProps = {
      size: 20,
      color: isDestructive ? DesignTokens.colors.danger.main : DesignTokens.colors.text.primary,
    };

    switch (iconName) {
      case 'copy': return <Copy {...iconProps} />;
      case 'share': return <Share {...iconProps} />;
      case 'star': return <Star {...iconProps} />;
      case 'flag': return <Flag {...iconProps} />;
      case 'trash': return <Trash2 {...iconProps} />;
      case 'edit': return <Edit {...iconProps} />;
      case 'reply': return <Reply {...iconProps} />;
      case 'forward': return <Forward {...iconProps} />;
      case 'info': return <Info {...iconProps} />;
      case 'pin': return <Pin {...iconProps} />;
      default: return null;
    }
  };

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
          direction: 'ltr',
          paddingBottom: sheetBottomPad,
          backgroundColor: 'transparent',
        }}
      >
        {preview ? (
          <View style={[styles.previewWrap, isMe ? styles.previewMe : styles.previewOther]}>
            {preview}
          </View>
        ) : null}

        <View style={styles.reactionRow}>
          <BlurView
            intensity={SHEET_GLASS_INTENSITY}
            tint="dark"
            style={styles.reactionPill}
          >
            <View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, styles.reactionPillOverlay]}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.reactionScroll}
            >
              {QUICK_REACTIONS.map((emoji) => (
                <Pressable
                  key={emoji}
                  onPress={() => handleReactionPress(emoji)}
                  style={({ pressed }) => [
                    styles.emojiBtn,
                    (pressed || selectedReaction === emoji) && styles.emojiBtnActive,
                  ]}
                >
                  <Text style={styles.emoji}>{emoji}</Text>
                </Pressable>
              ))}
              {onOpenPicker ? (
                <Pressable
                  onPress={() => {
                    void HapticFeedback.selection();
                    onOpenPicker();
                  }}
                  style={({ pressed }) => [styles.emojiBtn, pressed && styles.emojiBtnActive]}
                >
                  <Plus size={22} color={DesignTokens.colors.text.primary} strokeWidth={2} />
                </Pressable>
              ) : null}
            </ScrollView>
          </BlurView>
        </View>

        <BlurView
          intensity={SHEET_GLASS_INTENSITY}
          tint="dark"
          style={styles.actionsList}
        >
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, styles.actionsListOverlay]}
          />
          {items.map((item, i) => (
            <Pressable
              key={item.key}
              onPress={() => {
                void HapticFeedback.selection();
                onClose();
                setTimeout(item.onPress, 100);
              }}
              style={({ pressed }) => [
                styles.actionRow,
                i < items.length - 1 && styles.actionRowBorder,
                pressed && styles.actionRowPressed,
              ]}
            >
              {item.icon ? (
                <View style={styles.actionIcon}>{getIcon(item.icon, item.destructive)}</View>
              ) : null}
              <Text
                style={[
                  styles.actionLabel,
                  {
                    color: item.destructive
                      ? DesignTokens.colors.danger.main
                      : DesignTokens.colors.text.primary,
                  },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </BlurView>
      </ChatSheetContent>
    </ChatBottomSheet>
  );
}

const styles = StyleSheet.create({
  previewWrap: {
    marginBottom: 12,
    maxWidth: '85%',
  },
  previewMe: {
    alignSelf: 'flex-end',
  },
  previewOther: {
    alignSelf: 'flex-start',
  },
  reactionRow: {
    marginBottom: 12,
    alignItems: 'center',
  },
  reactionPill: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
    borderTopColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
    maxWidth: '100%',
  },
  reactionPillOverlay: {
    backgroundColor: SHEET_GLASS_OVERLAY,
    borderRadius: 999,
  },
  reactionScroll: {
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  emojiBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  emojiBtnActive: {
    backgroundColor: chatPalette.glassStrong,
    transform: [{ scale: 0.92 }],
  },
  emoji: {
    fontSize: 24,
  },
  actionsList: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
    borderTopColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
    paddingTop: 4,
  },
  actionsListOverlay: {
    backgroundColor: SHEET_GLASS_OVERLAY,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 44,
  },
  actionRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: chatPalette.glassBorder,
  },
  actionRowPressed: {
    backgroundColor: chatPalette.glassStrong,
  },
  actionIcon: {
    marginRight: 10,
    width: 20,
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '400',
    flex: 1,
    textAlign: 'right',
  },
});
