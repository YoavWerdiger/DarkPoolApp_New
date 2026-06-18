import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, StyleSheet, Text, Image, Dimensions, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageSnapshot } from '../../types/MessageSnapshot';
import ReactionBar from './ReactionBar';
import ContextMenu from './ContextMenu';
import { supabase } from '../../lib/supabase';
import { ChatBottomSheet } from './ChatBottomSheet';
import { useDesignTokens } from '../ui/DesignTokens';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import TradeMessage from './TradeMessage';

import { HapticFeedback } from '../../utils/hapticFeedback';
import { logger } from '../../utils/logger';

const SCREEN_HEIGHT = Dimensions.get('window').height;
/** אזור handle סטנדרטי — תואם BottomSheet (paddingVertical 22 + minHeight 88) */
const SHEET_HANDLE_HEIGHT = 88;

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
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const DesignTokens = useDesignTokens();
  const messagePreviewStyles = useMemo(() => createMessagePreviewStyles(DesignTokens), [DesignTokens]);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          paddingHorizontal: DesignTokens.spacing.md,
          paddingTop: DesignTokens.spacing.sm,
        },
        reactionWrapper: {
          alignItems: 'center',
          marginVertical: DesignTokens.spacing.md,
        },
      }),
    [DesignTokens],
  );

  const sheetBottomPad = useMemo(() => {
    const minBottom = Platform.OS === 'android' ? 24 : 20;
    const safeBottom = Math.max(insets.bottom, minBottom);
    const extra = Platform.OS === 'android' ? 12 : 20;
    return safeBottom + extra;
  }, [insets.bottom]);

  // מצא את הריאקציה הנוכחית של המשתמש (רק אחת!)
  const currentUserReaction = React.useMemo(() => {
    if (!message?.reactions || !Array.isArray(message.reactions)) return null;
    // חיפוש הריאקציה שבה המשתמש הגיב (reacted_by_me === true)
    // אמור להיות רק ריאקציה אחת של המשתמש
    const myReaction = message.reactions.find((r: any) => 
      r.reacted_by_me === true
    );
    // מחזיר את האימוג'י של הריאקציה שמצאנו, או null אם אין
    return myReaction?.emoji || null;
  }, [message?.reactions]);

  React.useEffect(() => {
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
      // רטט קצר מאוד בעת פתיחה (אסתטי ועדין)
      try { HapticFeedback.impactLight(); } catch { /* non-critical */ }
    }
  }, [visible, message]);

  useEffect(() => {
    setContentHeight(null);
  }, [message?.id, visible, isAdmin]);

  const handleContentLayout = useCallback((height: number) => {
    if (height > 0) {
      setContentHeight((prev) => (prev === height ? prev : height));
    }
  }, []);

  // snap point לפי גובה תוכן מדוד — לא אחוז קבוע מהמסך
  const snapPoint = useMemo(() => {
    if (!message) return 0.35;

    if (contentHeight != null && contentHeight > 0) {
      const totalPx = contentHeight + SHEET_HANDLE_HEIGHT + sheetBottomPad;
      return Math.min(0.92, Math.max(0.14, totalPx / SCREEN_HEIGHT));
    }

    // הערכה ראשונית עד onLayout — שמרנית ונמוכה
    const mainCount = 4
      + (message.isMe && !message.id?.toString().startsWith('temp-') ? 1 : 0)
      + (message.isMe ? 1 : 0)
      + (isAdmin ? 1 : 0);
    const dangerCount = (message.isMe ? 1 : 0) + (message.isMe || isAdmin ? 1 : 0);
    const previewLines = message.content ? Math.min(4, message.content.split('\n').length + Math.ceil(message.content.length / 40)) : 0;
    const isTrade = isTradeMessageType(message.type) || !!parseTradeFromContent(message.content);
    const previewPx = isTrade
      ? 240
      : 72 + previewLines * 22 + (message.mediaUrl ? 24 : 0);
    const reactionPx = 58;
    const menuRowPx = 82;
    const mainRows = Math.ceil(mainCount / 4);
    const dangerRows = dangerCount > 0 ? 1 : 0;
    const menuPx = mainRows * menuRowPx + dangerRows * menuRowPx + 34;
    const estimatedPx = previewPx + reactionPx + menuPx + SHEET_HANDLE_HEIGHT + sheetBottomPad;
    return Math.min(0.88, Math.max(0.14, estimatedPx / SCREEN_HEIGHT));
  }, [message, isAdmin, contentHeight, sheetBottomPad]);

  if (!message) {
    return null;
  }

  const handleReaction = (emoji: string) => {
    onAction('react', { messageId: message?.id, emoji });
  };

  const handleOptionSelect = (option: string) => {
    onAction(option, message);
  };

  const renderMessagePreview = () => {
    if (!message) return null;

    const timeText = message.timestamp
      ? format(new Date(message.timestamp), 'HH:mm')
      : message.createdAt
      ? format(new Date(message.createdAt), 'HH:mm')
      : '';

    const isMedia = !!(message.mediaUrl && (message.type === 'image' || message.type === 'video'));
    const mediaIcon = message.type === 'video' ? 'videocam' : 'image';
    const mediaLabel = message.type === 'video' ? 'סרטון' : 'תמונה';
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
                {isMedia && (
                  <View style={p.mediaRow}>
                    <Ionicons name={mediaIcon as any} size={16} color={mediaIconColor} />
                    <Text style={[p.mediaText, isMe && p.myMediaText]}>{mediaLabel}</Text>
                  </View>
                )}

                {message.content ? (
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
    >
      <View
        style={styles.container}
        onLayout={(e) => handleContentLayout(e.nativeEvent.layout.height)}
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
      </View>
    </ChatBottomSheet>
  );
}

const createMessagePreviewStyles = (tokens: any) => StyleSheet.create({
  previewWrap: {
    paddingTop: tokens.spacing.xs,
    paddingBottom: tokens.spacing.xs,
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
    maxWidth: '82%',
    gap: 6,
  },
  avatarCol: {
    marginBottom: 2,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
    backgroundColor: tokens.colors.bubbleOther,
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
