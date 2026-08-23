import React, { useEffect, useMemo, useCallback, useState, useRef } from 'react';
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
import { SHEET_CLOSE_MS } from '../ui/BottomSheet';
import { useDesignTokens } from '../ui/DesignTokens';
import { chatPalette } from './chatDesignTokens';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import TradeMessage from './TradeMessage';

import { HapticFeedback } from '../../utils/hapticFeedback';
import { logger } from '../../utils/logger';

const SCREEN_HEIGHT = Dimensions.get('window').height;

/** הפרדה חזקה יותר רק לשיט Action של הצ׳אט (לא לכל שיטי האפליקציה). */
const ACTION_SHEET_BACKDROP = 0.78;

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

  // שומרים את ההודעה גם כשההורה מאפס message=null יחד עם visible=false —
  // אחרת return null מיידי תולש את ה-Modal בלי visible=false, ואז focus למקלדת נכשל.
  const cachedMessageRef = useRef<MessageSnapshot | null>(null);
  if (message) cachedMessageRef.current = message;
  const displayMessage = message ?? cachedMessageRef.current;

  const [keepMounted, setKeepMounted] = useState(visible);
  useEffect(() => {
    if (visible) {
      setKeepMounted(true);
      return;
    }
    if (!keepMounted) return;
    const t = setTimeout(() => setKeepMounted(false), SHEET_CLOSE_MS + 60);
    return () => clearTimeout(t);
  }, [visible, keepMounted]);

  // הערכת snap ראשונית לפי תוכן (עד onLayout מדייק) — כמו ReactionDetails
  const initialSnapEstimate = useMemo(() => {
    if (!displayMessage) return 0.35;
    const mainCount = 4
      + (displayMessage.isMe && !displayMessage.id?.toString().startsWith('temp-') ? 1 : 0)
      + (isAdmin ? 1 : 0);
    const dangerCount = (displayMessage.isMe ? 1 : 0) + (displayMessage.isMe || isAdmin ? 1 : 0);
    const previewLines = displayMessage.content
      ? Math.min(4, displayMessage.content.split('\n').length + Math.ceil(displayMessage.content.length / 40))
      : 0;
    const isTrade = isTradeMessageType(displayMessage.type) || !!parseTradeFromContent(displayMessage.content);
    const previewPx = isTrade
      ? 220
      : 64 + previewLines * 20 + (displayMessage.mediaUrl ? 20 : 0);
    const reactionPx = 58;
    const menuRowPx = 80;
    const mainRows = Math.ceil(mainCount / 4);
    const dangerRows = dangerCount > 0 ? 1 : 0;
    const menuPx = mainRows * menuRowPx + dangerRows * menuRowPx + 28;
    const estimatedPx = previewPx + reactionPx + menuPx + 42 + Math.max(insets.bottom, 16);
    return Math.min(0.88, Math.max(0.22, estimatedPx / SCREEN_HEIGHT));
  }, [displayMessage, isAdmin, insets.bottom]);

  // snap לפי גובה מדוד — אותו hook כמו שאר ה-sheets
  const { snapPoint, onContentLayout } = useChatFitContentSnap(
    initialSnapEstimate,
    0.92,
    0.12,
    `${displayMessage?.id ?? ''}-${visible}-${isAdmin}`,
  );

  const sheetBottomPad = useMemo(() => {
    const minBottom = Platform.OS === 'android' ? 16 : 8;
    return Math.max(insets.bottom, minBottom);
  }, [insets.bottom]);

  const currentUserReaction = useMemo(() => {
    if (!displayMessage?.reactions || !Array.isArray(displayMessage.reactions)) return null;
    const myReaction = displayMessage.reactions.find((r: any) =>
      r.reacted_by_me === true
    );
    return myReaction?.emoji || null;
  }, [displayMessage?.reactions]);

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const userId = auth.user?.id;
        const channelId = displayMessage?.channelId;
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
    if (displayMessage) {
      fetchRole();
    }
  }, [displayMessage?.id, displayMessage?.channelId]);

  useEffect(() => {
    if (visible && displayMessage) {
      try { HapticFeedback.impactLight(); } catch { /* non-critical */ }
    }
  }, [visible, displayMessage?.id]);

  const handleReaction = useCallback((emoji: string) => {
    onAction('react', { messageId: displayMessage?.id, emoji });
  }, [displayMessage?.id, onAction]);

  const handleOpenPicker = useCallback(() => {
    onAction('openReactionPicker', { messageId: displayMessage?.id });
  }, [displayMessage?.id, onAction]);

  const handleOptionSelect = useCallback((option: string) => {
    onAction(option, displayMessage);
  }, [displayMessage, onAction]);

  if (!displayMessage || (!visible && !keepMounted)) {
    return null;
  }

  const renderMessagePreview = () => {
    const timeText = displayMessage.timestamp
      ? format(new Date(displayMessage.timestamp), 'HH:mm')
      : displayMessage.createdAt
      ? format(new Date(displayMessage.createdAt), 'HH:mm')
      : '';

    const contentTrimmed = (displayMessage.content ?? '').trim();
    const isAudio =
      displayMessage.type === 'audio' ||
      (displayMessage.type as string) === 'voice' ||
      (contentTrimmed.startsWith('{') && contentTrimmed.includes('waveformData'));
    const isMedia = !!(displayMessage.mediaUrl && (displayMessage.type === 'image' || displayMessage.type === 'video'));
    const mediaIcon = isAudio ? 'mic' : displayMessage.type === 'video' ? 'videocam' : 'image';
    const mediaLabel = isAudio ? 'הקלטה' : displayMessage.type === 'video' ? 'סרטון' : 'תמונה';
    const tradeFromContent = parseTradeFromContent(displayMessage.content);
    const isTrade = isTradeMessageType(displayMessage.type) || !!tradeFromContent;
    const tradePayload = tradeFromContent;

    const isMe = displayMessage.isMe;
    const p = messagePreviewStyles;
    const mediaIconColor = isMe ? 'rgba(255,255,255,0.75)' : DesignTokens.colors.text.secondary;

    return (
      <View style={[p.previewWrap, isMe ? p.previewWrapMe : p.previewWrapOther]}>
        <View style={p.row}>
          {!isMe && (
            <View style={p.avatarCol}>
              {displayMessage.senderAvatar ? (
                <Image source={{ uri: displayMessage.senderAvatar }} style={p.avatar} />
              ) : (
                <View style={[p.avatar, p.avatarFallback]}>
                  <Text style={p.avatarLetter}>
                    {(displayMessage.senderName ?? '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={[p.bubble, isMe ? p.myBubble : p.theirBubble, isTrade && p.tradeBubble]}>
            {!isMe && displayMessage.senderName ? (
              <Text style={p.senderName} numberOfLines={1}>{displayMessage.senderName}</Text>
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

                {displayMessage.content && !isAudio ? (
                  <Text style={[p.msgText, isMe ? p.myText : p.theirText]} numberOfLines={4}>
                    {displayMessage.content}
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
      useGlassBackground
      showBrandBackground={false}
      showBrandWatermark={false}
      showHandle
      contentPaddingBottom={0}
      backdropOpacity={ACTION_SHEET_BACKDROP}
    >
      {/* direction:ltr — FlatList inverted + forceRTL הופכים את ציר X;
          בתוך השיט בלי inverted, חייבים LTR כדי ש-other יישאר משמאל כמו בצ׳אט. */}
      <ChatSheetContent
        style={{
          direction: 'ltr',
          paddingBottom: sheetBottomPad,
          paddingHorizontal: 12,
          backgroundColor: 'transparent',
        }}
        onLayout={onContentLayout}
      >
        {renderMessagePreview()}

        <View style={styles.reactionWrapper}>
          <ReactionBar
            onReaction={handleReaction}
            currentReaction={currentUserReaction}
            onOpenPicker={handleOpenPicker}
          />
        </View>

        <ContextMenu
          onSelect={handleOptionSelect}
          isAdmin={isAdmin}
          isMe={displayMessage.isMe}
          canEdit={!displayMessage.id?.toString().startsWith('temp-')}
        />
      </ChatSheetContent>
    </ChatBottomSheet>
  );
}

const styles = StyleSheet.create({
  reactionWrapper: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
});

const createMessagePreviewStyles = (tokens: any) => StyleSheet.create({
  previewWrap: {
    paddingTop: tokens.spacing.sm,
    paddingBottom: tokens.spacing.base,
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
