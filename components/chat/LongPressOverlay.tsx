import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Platform, Text, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageSnapshot } from '../../types/MessageSnapshot';
import ReactionBar from './ReactionBar';
import ContextMenu from './ContextMenu';
import { supabase } from '../../lib/supabase';
import BottomSheet from '../ui/BottomSheet/BottomSheet';
import { useDesignTokens, DesignTokens as CoreDesignTokens } from '../ui/DesignTokens';
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

    return (
      <View style={messagePreviewStyles.previewContainer}>
        <View 
          style={[
            messagePreviewStyles.bubble,
            message.isMe ? messagePreviewStyles.myBubble : messagePreviewStyles.theirBubble
          ]}
        >
          {/* Avatar */}
          {!message.isMe && message.senderAvatar && (
            <Image 
              source={{ uri: message.senderAvatar }} 
              style={messagePreviewStyles.avatar} 
            />
          )}

          {/* Content */}
          <View style={messagePreviewStyles.messageContent}>
            {/* Sender Name */}
            {!message.isMe && message.senderName && (
              <Text style={messagePreviewStyles.senderName}>
                {message.senderName}
              </Text>
            )}

            {/* Media or Text */}
            {message.mediaUrl && (message.type === 'image' || message.type === 'video') ? (
              <Image 
                source={{ uri: message.mediaUrl }} 
                style={messagePreviewStyles.mediaImage}
                resizeMode="cover"
              />
            ) : message.content ? (
              <Text style={messagePreviewStyles.messageText} numberOfLines={4}>
                {message.content}
              </Text>
            ) : null}

            {/* Timestamp */}
            {timeText && (
              <Text style={messagePreviewStyles.timeText}>
                {timeText}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <BottomSheet
      isOpen={visible}
      onClose={onClose}
      snapPoints={[0.75]} // הגדלתי ל-75% כדי שיהיה יותר מקום
      showHandle={true}
      enablePanDownToClose={true}
      backdropOpacity={0.4}
      useModal={true}
    >
      <View style={styles.content}>
        {/* Message Preview */}
        {renderMessagePreview()}

        {/* Reaction Bar */}
        <View style={styles.reactionWrapper}>
          <ReactionBar onReaction={handleReaction} currentReaction={currentUserReaction} />
        </View>

        {/* Context Menu */}
        <View style={styles.contextMenuWrapper}>
          <ContextMenu 
            onSelect={handleOptionSelect} 
            isAdmin={isAdmin}
            isMe={message.isMe}
            canEdit={!message.id?.toString().startsWith('temp-')}
          />
        </View>
      </View>
    </BottomSheet>
  );
}

const createMessagePreviewStyles = (tokens: any) => StyleSheet.create({
  previewContainer: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.lg,
    paddingBottom: tokens.spacing.md,
    alignItems: 'center',
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: tokens.borderRadius.lg,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: tokens.spacing.sm,
  },
  myBubble: {
    backgroundColor: tokens.colors.primary.dim,
    borderBottomRightRadius: tokens.borderRadius.xs,
    borderTopLeftRadius: tokens.borderRadius.lg,
    borderTopRightRadius: tokens.borderRadius.lg,
    borderBottomLeftRadius: tokens.borderRadius.lg,
    borderWidth: tokens.layout.borderWidth.normal,
    borderColor: tokens.colors.border.active,
    alignSelf: 'flex-end',
  },
  theirBubble: {
    backgroundColor: tokens.colors.background.cardSolid,
    borderBottomLeftRadius: tokens.borderRadius.xs,
    borderTopLeftRadius: tokens.borderRadius.lg,
    borderTopRightRadius: tokens.borderRadius.lg,
    borderBottomRightRadius: tokens.borderRadius.lg,
    borderWidth: tokens.layout.borderWidth.normal,
    borderColor: tokens.colors.border.primary,
    alignSelf: 'flex-start',
  },
  avatar: {
    width: 32,
    height: 30,
    borderRadius: tokens.borderRadius.lg,
  },
  messageContent: {
    flex: 1,
    alignItems: 'flex-end',
  },
  senderName: {
    fontSize: tokens.typography.label.size,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.text.primary,
    marginBottom: tokens.spacing.xs,
  },
  messageText: {
    fontSize: tokens.typography.fontSize.base,
    lineHeight: Math.round(tokens.typography.fontSize.base * tokens.typography.lineHeight.normal),
    color: tokens.colors.text.primary,
    textAlign: 'right',
  },
  mediaImage: {
    width: 200,
    height: 200,
    borderRadius: tokens.borderRadius.md,
    marginBottom: tokens.spacing.xs,
  },
  timeText: {
    fontSize: tokens.typography.fontSize.xs,
    color: tokens.colors.text.secondary,
    marginTop: tokens.spacing.xs,
    textAlign: 'right',
  },
});

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 0,
    paddingBottom: CoreDesignTokens.spacing.sm,
  },
  reactionWrapper: {
    alignItems: 'center',
    marginBottom: CoreDesignTokens.spacing.lg,
    marginTop: CoreDesignTokens.spacing.sm,
  },
  contextMenuWrapper: {
    flex: 1,
  },
});
