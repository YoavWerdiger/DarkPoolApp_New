// ============================================
// Chat Message Component
// ============================================
// הצגת הודעה בודדת בצ'אט
// ============================================

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useDesignTokens } from '../ui/DesignTokens';
import { ChatMessage as ChatMessageType, ChatMessageType as MessageType } from '../../types/chat.types';
import { formatDistanceToNow } from 'date-fns';
import { he } from 'date-fns/locale';

interface ChatMessageProps {
  message: ChatMessageType;
  isMe: boolean;
  showAvatar?: boolean;
  showSenderName?: boolean;
  onLongPress?: () => void;
  onPress?: () => void;
  onReply?: () => void;
  onReactionPress?: (emoji: string) => void;
  onAvatarPress?: () => void;
}

export default function ChatMessage({
  message,
  isMe,
  showAvatar = true,
  showSenderName = true,
  onLongPress,
  onPress,
  onReply,
  onReactionPress,
  onAvatarPress,
}: ChatMessageProps) {
  const DesignTokens = useDesignTokens();
  const styles = useMemo(() => createStyles(DesignTokens), [DesignTokens]);

  // הודעת מערכת
  if (message.is_system_message) {
    return (
      <View style={styles.systemMessageContainer}>
        <Text style={styles.systemMessageText}>
          {getSystemMessageText(message)}
        </Text>
      </View>
    );
  }

  // הודעה מחוקה
  if (message.is_deleted) {
    return (
      <View style={[styles.messageContainer, isMe ? styles.myMessage : styles.theirMessage]}>
        <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble, styles.deletedBubble]}>
          <Text style={[styles.messageText, styles.deletedText]}>
            🚫 הודעה זו נמחקה
          </Text>
        </View>
      </View>
    );
  }

  const timeText = formatDistanceToNow(new Date(message.created_at), {
    addSuffix: true,
    locale: he,
  });

  return (
    <View style={[styles.messageContainer, isMe ? styles.myMessage : styles.theirMessage]}>
      {/* Avatar */}
      {!isMe && showAvatar && (
        <TouchableOpacity onPress={onAvatarPress} style={styles.avatarContainer}>
          {message.sender?.profile_picture ? (
            <Image source={{ uri: message.sender.profile_picture }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>
                {message.sender?.display_name?.charAt(0) || '?'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* Message Content */}
      <View style={styles.messageContent}>
        {/* Sender Name */}
        {!isMe && showSenderName && (
          <Text style={styles.senderName}>
            {message.sender?.display_name || 'משתמש'}
          </Text>
        )}

        {/* Reply To */}
        {message.reply_to && (
          <TouchableOpacity 
            style={styles.replyContainer}
            onPress={() => onReply?.()}
          >
            <View style={styles.replyBar} />
            <View>
              <Text style={styles.replyName}>{message.reply_to.sender_name}</Text>
              <Text style={styles.replyText} numberOfLines={1}>
                {message.reply_to.content || getMediaTypeText(message.reply_to.message_type)}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Bubble */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onPress}
          onLongPress={onLongPress}
          style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}
        >
          {/* Forwarded Tag */}
          {message.is_forwarded && (
            <View style={styles.forwardedTag}>
              <Text style={styles.forwardedText}>↩️ הועבר</Text>
            </View>
          )}

          {/* Media Content */}
          {renderMediaContent(message, styles)}

          {/* Text Content */}
          {message.content && (
            <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
              {message.content}
            </Text>
          )}

          {/* Metadata */}
          <View style={styles.metadata}>
            {message.is_edited && (
              <Text style={styles.editedText}>נערך · </Text>
            )}
            <Text style={styles.timeText}>{timeText}</Text>
            {isMe && (
              <Text style={styles.checkmark}>
                {message.is_sending ? '⏱' : message.read_by_count > 0 ? '✓✓' : '✓'}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <View style={styles.reactionsContainer}>
            {message.reactions.map((reaction, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.reactionBubble,
                  reaction.reacted_by_me && styles.myReaction,
                ]}
                onPress={() => onReactionPress?.(reaction.emoji)}
              >
                <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                <Text style={styles.reactionCount}>{reaction.count}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Spacer for avatar on my messages */}
      {isMe && showAvatar && <View style={styles.avatarSpacer} />}
    </View>
  );
}

// ============================================
// Helper Functions
// ============================================

function renderMediaContent(message: ChatMessageType, styles: any) {
  if (!message.media_url) return null;

  switch (message.message_type) {
    case MessageType.IMAGE:
      return (
        <Image
          source={{ uri: message.media_thumbnail_url || message.media_url }}
          style={styles.mediaImage}
          resizeMode="cover"
        />
      );

    case MessageType.VIDEO:
      return (
        <View style={styles.mediaVideo}>
          {message.media_thumbnail_url && (
            <Image
              source={{ uri: message.media_thumbnail_url }}
              style={styles.mediaImage}
              resizeMode="cover"
            />
          )}
          <View style={styles.playButton}>
            <Text style={styles.playIcon}>▶️</Text>
          </View>
        </View>
      );

    case MessageType.AUDIO:
      return (
        <View style={styles.mediaAudio}>
          <Text style={styles.audioIcon}>🎤</Text>
          <Text style={styles.audioDuration}>
            {formatDuration(message.media_duration || 0)}
          </Text>
        </View>
      );

    case MessageType.DOCUMENT:
      return (
        <View style={styles.mediaDocument}>
          <Text style={styles.documentIcon}>📎</Text>
          <Text style={styles.documentName} numberOfLines={1}>
            {message.media_file_name || 'מסמך'}
          </Text>
        </View>
      );

    default:
      return null;
  }
}

function getSystemMessageText(message: ChatMessageType): string {
  const data = message.system_message_data || {};
  
  switch (message.system_message_type) {
    case 'group_created':
      return '🎉 הקבוצה נוצרה';
    case 'user_joined':
      return `👋 ${data.user_name || 'משתמש'} הצטרף לקבוצה`;
    case 'user_left':
      return `👋 ${data.user_name || 'משתמש'} עזב את הקבוצה`;
    case 'member_added':
      return `➕ ${data.user_name || 'משתמש'} נוסף לקבוצה`;
    case 'member_removed':
      return `➖ ${data.user_name || 'משתמש'} הוסר מהקבוצה`;
    case 'member_promoted':
      return `⭐ ${data.user_name || 'משתמש'} הועלה לאדמין`;
    case 'member_demoted':
      return `📉 ${data.user_name || 'משתמש'} הורד מאדמין`;
    case 'group_name_changed':
      return `📝 שם הקבוצה שונה ל-"${data.new_value}"`;
    case 'group_avatar_changed':
      return '🖼️ תמונת הקבוצה שונתה';
    case 'group_description_changed':
      return '📝 תיאור הקבוצה שונה';
    default:
      return '📌 פעולה בקבוצה';
  }
}

function getMediaTypeText(type: MessageType): string {
  switch (type) {
    case MessageType.IMAGE:
      return '📷 תמונה';
    case MessageType.VIDEO:
      return '🎥 סרטון';
    case MessageType.AUDIO:
      return '🎤 הודעה קולית';
    case MessageType.DOCUMENT:
      return '📎 מסמך';
    default:
      return '';
  }
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ============================================
// Styles
// ============================================

const createStyles = (tokens: any) => StyleSheet.create({
  messageContainer: {
    flexDirection: 'row',
    marginVertical: 4,
    paddingHorizontal: 12,
    alignItems: 'flex-end',
  },
  myMessage: {
    justifyContent: 'flex-end',
  },
  theirMessage: {
    justifyContent: 'flex-start',
  },
  
  avatarContainer: {
    marginRight: 8,
    marginBottom: 4,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarPlaceholder: {
    backgroundColor: tokens.colors.accent.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  avatarSpacer: {
    width: 40,
  },
  
  messageContent: {
    maxWidth: '75%',
  },
  
  senderName: {
    fontSize: 12,
    color: tokens.colors.text.secondary,
    marginBottom: 4,
    marginLeft: 12,
  },
  
  replyContainer: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.background.secondary,
    borderRadius: 8,
    padding: 8,
    marginBottom: 4,
  },
  replyBar: {
    width: 3,
    backgroundColor: tokens.colors.accent.primary,
    borderRadius: 2,
    marginRight: 8,
  },
  replyName: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.accent.primary,
    marginBottom: 2,
  },
  replyText: {
    fontSize: 12,
    color: tokens.colors.text.secondary,
  },
  
  bubble: {
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    maxWidth: '100%',
  },
  myBubble: {
    backgroundColor: '#007AFF', // כחול בהיר
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    backgroundColor: '#3A3A3C', // אפור בהיר - contrast טוב
    borderBottomLeftRadius: 4,
  },
  deletedBubble: {
    opacity: 0.6,
  },
  
  forwardedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  forwardedText: {
    fontSize: 11,
    fontStyle: 'italic',
    opacity: 0.7,
  },
  
  mediaImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 4,
  },
  mediaVideo: {
    position: 'relative',
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 4,
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -25 }, { translateY: -25 }],
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    fontSize: 24,
  },
  
  mediaAudio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 150,
  },
  audioIcon: {
    fontSize: 24,
  },
  audioDuration: {
    fontSize: 14,
    fontWeight: '500',
  },
  
  mediaDocument: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 150,
  },
  documentIcon: {
    fontSize: 24,
  },
  documentName: {
    fontSize: 14,
    flex: 1,
  },
  
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  theirMessageText: {
    color: tokens.colors.text.primary,
  },
  deletedText: {
    fontStyle: 'italic',
    opacity: 0.6,
  },
  
  metadata: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  editedText: {
    fontSize: 11,
    opacity: 0.6,
  },
  timeText: {
    fontSize: 11,
    opacity: 0.6,
  },
  checkmark: {
    fontSize: 12,
    marginLeft: 4,
  },
  
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  reactionBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.background.secondary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  myReaction: {
    backgroundColor: tokens.colors.accent.secondary,
    borderWidth: 1,
    borderColor: tokens.colors.accent.primary,
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 11,
    fontWeight: '600',
    color: tokens.colors.text.primary,
  },
  
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 12,
  },
  systemMessageText: {
    fontSize: 13,
    color: tokens.colors.text.secondary,
    backgroundColor: tokens.colors.background.secondary,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
  },
});

