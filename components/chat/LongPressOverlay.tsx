import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Text, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageSnapshot } from '../../types/MessageSnapshot';
import ReactionBar from './ReactionBar';
import ContextMenu from './ContextMenu';
import { supabase } from '../../lib/supabase';
import BottomSheet from '../ui/BottomSheet/BottomSheet';
import { useDesignTokens, DesignTokens as CoreDesignTokens } from '../ui/DesignTokens';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';

import { HapticFeedback } from '../../utils/hapticFeedback';
import { logger } from '../../utils/logger';

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
  const [isAdmin, setIsAdmin] = React.useState(false);
  const DesignTokens = useDesignTokens();
  const messagePreviewStyles = useMemo(() => createMessagePreviewStyles(DesignTokens), [DesignTokens]);

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

  // snap point דינמי — חייב להיות לפני כל early return (Rules of Hooks)
  // edgeToEdge=true מקטין overhead של handle ל-~18px
  const snapPoint = React.useMemo(() => {
    if (!message) return 0.62;
    const mainCount = 4
      + (message.isMe && !message.id?.toString().startsWith('temp-') ? 1 : 0) // edit
      + (isAdmin ? 1 : 0); // pin
    const dangerCount = (message.isMe ? 1 : 0) + (message.isMe || isAdmin ? 1 : 0);
    const mainRows = Math.ceil(mainCount / 4);
    const dangerRows = dangerCount > 0 ? 1 : 0;
    const totalRows = mainRows + dangerRows;
    return Math.min(0.82, 0.52 + totalRows * 0.088);
  }, [message, isAdmin]);

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

    const isMe = message.isMe;
    const p = messagePreviewStyles;

    return (
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

        <View style={[p.bubble, isMe ? p.myBubble : p.theirBubble]}>
          {!isMe && message.senderName ? (
            <Text style={p.senderName} numberOfLines={1}>{message.senderName}</Text>
          ) : null}

          {isMedia && (
            <View style={p.mediaRow}>
              <Ionicons name={mediaIcon as any} size={16} color={DesignTokens.colors.text.secondary} />
              <Text style={p.mediaText}>{mediaLabel}</Text>
            </View>
          )}

          {message.content ? (
            <Text style={[p.msgText, isMe ? p.myText : p.theirText]} numberOfLines={4}>
              {message.content}
            </Text>
          ) : null}

          <Text style={[p.timeText, isMe ? p.myTime : p.theirTime]}>{timeText}</Text>
        </View>

        {!isMe && <View style={p.spacer} />}
      </View>
    );
  };

  return (
    <BottomSheet
      isOpen={visible}
      onClose={onClose}
      snapPoints={[snapPoint]}
      showHandle={true}
      enablePanDownToClose={true}
      backdropOpacity={0.5}
      useModal={true}
      edgeToEdge={true}
    >
      <View style={styles.sheet}>
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
    </BottomSheet>
  );
}

const createMessagePreviewStyles = (tokens: any) => StyleSheet.create({
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 4,
    gap: 8,
  },
  avatarCol: {
    alignSelf: 'flex-end',
    marginBottom: 2,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  avatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.text.primary,
  },
  spacer: { width: 34 + 8 },
  bubble: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  myBubble: {
    backgroundColor: tokens.colors.primary.dim,
    borderBottomRightRadius: 4,
    borderWidth: 1,
    borderColor: tokens.colors.border.active,
  },
  theirBubble: {
    backgroundColor: tokens.colors.background.cardSolid ?? 'rgba(255,255,255,0.08)',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  senderName: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.primary.main,
    textAlign: 'right',
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
  msgText: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'right',
  },
  myText: {
    color: '#fff',
  },
  theirText: {
    color: tokens.colors.text.primary,
  },
  timeText: {
    fontSize: 11,
    alignSelf: 'flex-end',
  },
  myTime: {
    color: 'rgba(255,255,255,0.5)',
  },
  theirTime: {
    color: tokens.colors.text.tertiary,
  },
});

const styles = StyleSheet.create({
  sheet: {
    // paddingBottom מוסר — BottomSheet כבר מוסיף contentPaddingBottom (~54px)
  },
  reactionWrapper: {
    alignItems: 'center',
    marginVertical: 10,
  },
});
