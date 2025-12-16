import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Platform, Text, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageSnapshot } from '../../types/MessageSnapshot';
import ReactionBar from './ReactionBar';
import ContextMenu from './ContextMenu';
import { supabase } from '../../lib/supabase';
import BottomSheet from '../ui/BottomSheet/BottomSheet';
import { useDesignTokens } from '../ui/DesignTokens';
import { format } from 'date-fns';

// רטט קצר ועדין בעת פתיחת התצוגה (עם fallback אם אין expo-haptics)
let Haptics: any = { selectionAsync: async () => {}, impactAsync: async () => {}, ImpactFeedbackStyle: { Light: 'Light' } };
try { Haptics = require('expo-haptics'); } catch {}

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
          .from('channel_members')
          .select('role')
          .eq('channel_id', channelId)
          .eq('user_id', userId)
          .single();

        if (!error && data) {
          setIsAdmin(data.role === 'admin' || data.role === 'owner');
        }
      } catch {}
    };
    if (message) {
      fetchRole();
    }
  }, [message]);

  useEffect(() => {
    if (visible && message) {
      // רטט קצר מאוד בעת פתיחה (אסתטי ועדין)
      try { Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle.Light); } catch {}
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
          />
        </View>
      </View>
    </BottomSheet>
  );
}

const createMessagePreviewStyles = (tokens: any) => StyleSheet.create({
  previewContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    alignItems: 'center',
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row-reverse',
    alignItems: 'flex-end',
    gap: 8,
  },
  myBubble: {
    backgroundColor: 'rgba(15, 185, 110, 0.25)',
    borderBottomRightRadius: 4,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(15, 185, 110, 0.4)',
    alignSelf: 'flex-end',
  },
  theirBubble: {
    backgroundColor: 'rgba(6, 18, 12, 0.8)',
    borderBottomLeftRadius: 4,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignSelf: 'flex-start',
  },
  avatar: {
    width: 32,
    height: 30,
    borderRadius: 16,
  },
  messageContent: {
    flex: 1,
    alignItems: 'flex-end',
  },
  senderName: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.text.primary,
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    color: '#FFFFFF',
    textAlign: 'right',
  },
  mediaImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 4,
  },
  timeText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 4,
    textAlign: 'right',
  },
});

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 0,
    paddingBottom: 8,
  },
  reactionWrapper: {
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  contextMenuWrapper: {
    flex: 1,
  },
});
