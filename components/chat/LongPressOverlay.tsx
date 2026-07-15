import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { View, StyleSheet, Text, Image, Platform, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageSnapshot } from '../../types/MessageSnapshot';
import ReactionBar from './ReactionBar';
import ContextMenu from './ContextMenu';
import { supabase } from '../../lib/supabase';
import {
  ChatBottomSheet,
  ChatSheetContent,
  useChatFitContentSnap,
} from './ChatBottomSheet';
import { useDesignTokens } from '../ui/DesignTokens';
import { chatPalette } from './chatDesignTokens';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import TradeMessage from './TradeMessage';

import { HapticFeedback } from '../../utils/hapticFeedback';
import { logger } from '../../utils/logger';

const SCREEN_HEIGHT = Dimensions.get('window').height;

type ParsedTrade = {
  id: string;
  symbol: string;
  direction: 'long' | 'short';
  entry_price: number;
  exit_price: number;
  quantity: number;
  entry_date: string;
  exit_date: string;
  pnl: number;
  return_percentage?: number;
  notes?: string;
};

function isTradeMessageType(type?: string): boolean {
  return (type ?? '').toLowerCase() === 'trade';
}

function parseTradeFromContent(content: string): ParsedTrade | null {
  if (!content?.trim()) return null;
  try {
    const o = JSON.parse(content.trim()) as { trade?: ParsedTrade };
    const t = o.trade;
    if (!t || typeof t.symbol !== 'string') return null;
    return t;
  } catch {
    return null;
  }
}

interface LongPressOverlayProps {
  visible: boolean;
  message: MessageSnapshot | null;
  onClose: () => void;
  onAction: (actionName: string, payload?: any) => void;
}


export default function LongPressOverlay({
  visible,
  message,
  onClose,
  onAction
}: LongPressOverlayProps) {
  const insets = useSafeAreaInsets();
  const [isAdmin, setIsAdmin] = useState(false);
  const DesignTokens = useDesignTokens();
  const messagePreviewStyles = useMemo(() => createMessagePreviewStyles(DesignTokens), [DesignTokens]);

  // הערכת snap ראשונית לפי תוכן (עד onLayout מדייק) — כמו ReactionDetails
  const initialSnapEstimate = useMemo(() => {
    if (!message) return 0.35;
    const mainCount = 4
      + (message.isMe && !message.id?.toString().startsWith('temp-') ? 1 : 0)
      + (isAdmin ? 1 : 0);
    const dangerCount = (message.isMe ? 1 : 0) + (message.isMe || isAdmin ? 1 : 0);
    const previewLines = message.content
      ? Math.min(4, message.content.split('\n').length + Math.ceil(message.content.length / 40))
      : 0;
    const isTrade = isTradeMessageType(message.type) || !!parseTradeFromContent(message.content);
    const previewPx = isTrade
      ? 220
      : 64 + previewLines * 20 + (message.mediaUrl ? 20 : 0);
    const reactionPx = 52;
    const menuRowPx = 74;
    const mainRows = Math.ceil(mainCount / 4);
    const dangerRows = dangerCount > 0 ? 1 : 0;
    const menuPx = mainRows * menuRowPx + dangerRows * menuRowPx + 24;
    const estimatedPx = previewPx + reactionPx + menuPx + 42 + Math.max(insets.bottom, 16);
    return Math.min(0.88, Math.max(0.22, estimatedPx / SCREEN_HEIGHT));
  }, [message, isAdmin, insets.bottom]);

  // snap לפי גובה מדוד — אותו hook כמו שאר ה-sheets
  const { snapPoint, onContentLayout } = useChatFitContentSnap(
    initialSnapEstimate,
    0.92,
    0.12,
    `${message?.id ?? ''}-${visible}-${isAdmin}`,
  );

  const sheetBottomPad = useMemo(() => {
    const minBottom = Platform.OS === 'android' ? 16 : 8;
    return Math.max(insets.bottom, minBottom);
  }, [insets.bottom]);

  const currentUserReaction = useMemo(() => {
    if (!message?.reactions || !Array.isArray(message.reactions)) return null;
    const myReaction = message.reactions.find((r: any) =>
      r.reacted_by_me === true
    );
    return myReaction?.emoji || null;
  }, [message?.reactions]);

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const userId = auth.user?.id;
        const channelId = message?.channelId;
        if (!userId || !channelId) return;

        const { data, error } = await supabase
          .from('chat_group_members')
          .select('role')
          .eq('group_id', channelId)
          .eq('user_id', userId)
          .single();

        if (!error && data) {
          setIsAdmin(data.role === 'admin' || data.role === 'owner');
        }
      } catch (error) {
        logger.error('LongPressOverlay', 'Failed to fetch role', error);
      }
    };
    if (message) {
      fetchRole();
    }
  }, [message]);

  useEffect(() => {
    if (visible && message) {
      try { HapticFeedback.impactLight(); } catch { /* non-critical */ }
    }
  }, [visible, message]);

  const handleReaction = useCallback((emoji: string) => {
    onAction('react', { messageId: message?.id, emoji });
  }, [message?.id, onAction]);

  const handleOptionSelect = useCallback((option: string) => {
    onAction(option, message);
  }, [message, onAction]);

  if (!message) {
    return null;
  }

  const renderMessagePreview = () => {
    const timeText = message.timestamp
      ? format(new Date(message.timestamp), 'HH:mm')
      : message.createdAt
      ? format(new Date(message.createdAt), 'HH:mm')
      : '';

    const contentTrimmed = (message.content ?? '').trim();
    const isAudio =
      message.type === 'audio' ||
      (message.type as string) === 'voice' ||
      (contentTrimmed.startsWith('{') && contentTrimmed.includes('waveformData'));
    const isMedia = !!(message.mediaUrl && (message.type === 'image' || message.type === 'video'));
    const mediaIcon = isAudio ? 'mic' : message.type === 'video' ? 'videocam' : 'image';
    const mediaLabel = isAudio ? 'הקלטה' : message.type === 'video' ? 'סרטון' : 'תמונה';
    const tradeFromContent = parseTradeFromContent(message.content);
    const isTrade = isTradeMessageType(message.type) || !!tradeFromContent;
    const tradePayload = tradeFromContent;

    const isMe = message.isMe;
    const p = messagePreviewStyles;
    const mediaIconColor = isMe ? 'rgba(255,255,255,0.75)' : DesignTokens.colors.text.secondary;

    return (
      <View style={[p.previewWrap, isMe ? p.previewWrapMe : p.previewWrapOther]}>
        <View style={p.row}>
          {!isMe && (
            <View style={p.avatarCol}>
              {message.senderAvatar ? (
                <Image source={{ uri: message.senderAvatar }} style={p.avatar} />
              ) : (
                <View style={[p.avatar, p.avatarFallback]}>
                  <Text style={p.avatarLetter}>
                    {(message.senderName ?? '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={[p.bubble, isMe ? p.myBubble : p.theirBubble, isTrade && p.tradeBubble]}>
            {!isMe && message.senderName ? (
              <Text style={p.senderName} numberOfLines={1}>{message.senderName}</Text>
            ) : null}

            {isTrade && tradePayload ? (
              <TradeMessage trade={tradePayload} isMe={!!isMe} embeddedInBubble />
            ) : (
              <>
                {(isMedia || isAudio) && (
                  <View style={p.mediaRow}>
                    <Ionicons name={mediaIcon as any} size={16} color={mediaIconColor} />
                    <Text style={[p.mediaText, isMe && p.myMediaText]}>{mediaLabel}</Text>
                  </View>
                )}

                {message.content && !isAudio ? (
                  <Text style={[p.msgText, isMe ? p.myText : p.theirText]} numberOfLines={4}>
                    {message.content}
                  </Text>
                ) : null}
              </>
            )}

            <Text style={[p.timeText, isMe ? p.myTime : p.theirTime, isTrade && p.timeInTradeBubble]}>
              {timeText}
            </Text>
          </View>
        </View>
      </View>
    );
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
      {/* direction:ltr — FlatList inverted + forceRTL הופכים את ציר X;
          בתוך השיט בלי inverted, חייבים LTR כדי ש-other יישאר משמאל כמו בצ׳אט. */}
      <ChatSheetContent
        style={{
          direction: 'ltr',
          paddingBottom: sheetBottomPad,
          paddingHorizontal: 10,
          backgroundColor: 'transparent',
        }}
        onLayout={onContentLayout}
      >
        {renderMessagePreview()}

        <View style={styles.reactionWrapper}>
          <ReactionBar onReaction={handleReaction} currentReaction={currentUserReaction} />
        </View>

        <ContextMenu
          onSelect={handleOptionSelect}
          isAdmin={isAdmin}
          isMe={message.isMe}
          canEdit={!message.id?.toString().startsWith('temp-')}
        />
      </ChatSheetContent>
    </ChatBottomSheet>
  );
}

const styles = StyleSheet.create({
  reactionWrapper: {
    alignItems: 'center',
    marginVertical: 12,
  },
});

const createMessagePreviewStyles = (tokens: any) => StyleSheet.create({
  previewWrap: {
    paddingTop: tokens.spacing.xs,
    paddingBottom: tokens.spacing.xs,
    width: '100%',
  },
  previewWrapMe: {
    alignItems: 'flex-end',
  },
  previewWrapOther: {
    alignItems: 'flex-start',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    maxWidth: '80%',
  },
  avatarCol: {
    marginRight: 6,
    marginBottom: 2,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  avatarFallback: {
    backgroundColor: tokens.colors.border.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.text.primary,
  },
  bubble: {
    flexShrink: 1,
    borderRadius: 16,
    paddingTop: 4,
    paddingBottom: 5,
    paddingHorizontal: 9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.16,
    shadowRadius: 3,
    elevation: 2,
  },
  myBubble: {
    backgroundColor: tokens.colors.bubbleMe,
    borderBottomRightRadius: 4,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
  },
  theirBubble: {
    backgroundColor: '#2C2F2C',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: chatPalette.glassBorderStrong,
    borderBottomLeftRadius: 4,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
  },
  tradeBubble: {
    paddingHorizontal: 0,
    paddingTop: 0,
    overflow: 'hidden',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.primary.main,
    textAlign: 'right',
    alignSelf: 'stretch',
    marginTop: 0,
    marginBottom: 1,
    lineHeight: 16,
  },
  mediaRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
  },
  mediaText: {
    fontSize: 14,
    color: tokens.colors.text.secondary,
  },
  myMediaText: {
    color: 'rgba(255,255,255,0.75)',
  },
  msgText: {
    fontSize: 16,
    lineHeight: 21,
    textAlign: 'right',
    marginTop: 0,
  },
  myText: {
    color: '#FFFFFF',
  },
  theirText: {
    color: tokens.colors.text.primary,
  },
  timeText: {
    fontSize: 11,
    alignSelf: 'flex-end',
    marginTop: 3,
  },
  myTime: {
    color: 'rgba(255,255,255,0.5)',
  },
  theirTime: {
    color: tokens.colors.text.tertiary,
  },
  timeInTradeBubble: {
    paddingHorizontal: 9,
    paddingBottom: 2,
  },
});
