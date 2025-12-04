// ============================================
// Chat Group Screen
// ============================================
// מסך הצ'אט עם ההודעות - המסך המרכזי
// ============================================

import React, { useMemo, useEffect, useRef, useState } from 'react';
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigation, useRoute } from '@react-navigation/native';
import ChatMessage from '../../components/chat/ChatMessage';
import ChatInput from '../../components/chat/ChatInput';
import ChatTypingIndicator from '../../components/chat/ChatTypingIndicator';
import { ChatMessage as ChatMessageType, ChatMessageType as MessageType } from '../../types/chat.types';
import * as Haptics from 'expo-haptics';

export default function ChatGroupScreen() {
  const DesignTokens = useDesignTokens();
  const styles = useMemo(() => createStyles(DesignTokens), [DesignTokens]);
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();

  const { groupId } = route.params as { groupId: string };

  const {
    currentGroup,
    messages,
    typingUsers,
    isLoadingMessages,
    isSendingMessage,
    selectGroup,
    sendMessage,
    loadMoreMessages,
    editMessage,
    deleteMessage,
    forwardMessage,
    addReaction,
    removeReaction,
    starMessage,
    unstarMessage,
    setTyping,
  } = useChat();

  const [replyTo, setReplyTo] = useState<{
    id: string;
    senderName: string;
    content: string;
  } | undefined>();
  const [selectedMessage, setSelectedMessage] = useState<ChatMessageType | null>(null);

  const flatListRef = useRef<FlatList>(null);

  // Load group on mount
  useEffect(() => {
    if (groupId) {
      selectGroup(groupId);
    }
  }, [groupId]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  // ============================================
  // Handle Actions
  // ============================================

  const handleSendMessage = async (content: string, mediaUrl?: string, mediaType?: MessageType) => {
    if (!groupId || !content.trim() && !mediaUrl) return;

    await sendMessage({
      group_id: groupId,
      content: content.trim(),
      message_type: mediaType || MessageType.TEXT,
      media_url: mediaUrl,
      reply_to_message_id: replyTo?.id,
    });

    setReplyTo(undefined);
  };

  const handleTyping = async (isTyping: boolean) => {
    if (groupId) {
      await setTyping(groupId, isTyping);
    }
  };

  const handleMessageLongPress = (message: ChatMessageType) => {
    if (message.is_system_message || message.is_deleted) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedMessage(message);

    const isMyMessage = message.sender_id === user?.id;

    const options = [
      { text: '↩️ השב', onPress: () => handleReply(message) },
      { text: '⭐ הוסף למועדפים', onPress: () => handleStar(message) },
      { text: '📋 העתק', onPress: () => handleCopy(message) },
    ];

    if (isMyMessage) {
      options.push({ text: '✏️ ערוך', onPress: () => handleEdit(message) });
      options.push({ text: '🗑️ מחק', onPress: () => handleDelete(message) });
    }

    options.push({ text: '↗️ העבר', onPress: () => handleForward(message) });
    options.push({ text: 'ביטול', onPress: () => {} });

    Alert.alert('פעולות', '', options);
  };

  const handleReply = (message: ChatMessageType) => {
    setReplyTo({
      id: message.id,
      senderName: message.sender?.display_name || 'משתמש',
      content: message.content || 'מדיה',
    });
    setSelectedMessage(null);
  };

  const handleStar = async (message: ChatMessageType) => {
    if (message.is_starred_by_me) {
      await unstarMessage(message.id);
    } else {
      await starMessage(message.id, groupId);
    }
    setSelectedMessage(null);
  };

  const handleCopy = (message: ChatMessageType) => {
    // TODO: implement clipboard copy
    Alert.alert('הועתק', 'ההודעה הועתקה ללוח');
    setSelectedMessage(null);
  };

  const handleEdit = (message: ChatMessageType) => {
    Alert.prompt(
      'ערוך הודעה',
      '',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'שמור',
          onPress: async (newContent) => {
            if (newContent && newContent.trim()) {
              await editMessage(message.id, newContent.trim());
            }
          },
        },
      ],
      'plain-text',
      message.content
    );
    setSelectedMessage(null);
  };

  const handleDelete = (message: ChatMessageType) => {
    Alert.alert(
      'מחק הודעה',
      'האם למחוק את ההודעה?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק רק אצלי',
          onPress: async () => {
            await deleteMessage(message.id, false);
          },
        },
        {
          text: 'מחק לכולם',
          style: 'destructive',
          onPress: async () => {
            await deleteMessage(message.id, true);
          },
        },
      ]
    );
    setSelectedMessage(null);
  };

  const handleForward = (message: ChatMessageType) => {
    // TODO: show group selection modal
    Alert.alert('העבר הודעה', 'בחר קבוצה להעברת ההודעה');
    setSelectedMessage(null);
  };

  const handleReactionPress = async (message: ChatMessageType, emoji: string) => {
    const myReaction = message.reactions?.find(
      r => r.emoji === emoji && r.reacted_by_me
    );

    if (myReaction) {
      await removeReaction(message.id, emoji);
    } else {
      await addReaction(message.id, emoji);
    }
  };

  const handleGroupInfoPress = () => {
    navigation.navigate('ChatGroupInfo' as never, { groupId } as never);
  };

  const handleLoadMore = () => {
    if (!isLoadingMessages) {
      loadMoreMessages();
    }
  };

  // ============================================
  // Render
  // ============================================

  const renderHeader = () => {
    if (!currentGroup) return null;

    return (
      <TouchableOpacity style={styles.header} onPress={handleGroupInfoPress}>
        {currentGroup.avatar_url ? (
          <Image source={{ uri: currentGroup.avatar_url }} style={styles.headerAvatar} />
        ) : (
          <View style={styles.headerAvatarPlaceholder}>
            <Text style={styles.headerAvatarText}>
              {currentGroup.name.charAt(0)}
            </Text>
          </View>
        )}
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{currentGroup.name}</Text>
          <Text style={styles.headerSubtitle}>
            {currentGroup.members_count} חברים
          </Text>
        </View>
        <TouchableOpacity onPress={handleGroupInfoPress} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>ℹ️</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderMessage = ({ item, index }: { item: ChatMessageType; index: number }) => {
    const isMe = item.sender_id === user?.id;
    const prevMessage = index > 0 ? messages[index - 1] : null;
    const showAvatar = !prevMessage || prevMessage.sender_id !== item.sender_id;
    const showSenderName = !isMe && showAvatar;

    return (
      <ChatMessage
        message={item}
        isMe={isMe}
        showAvatar={showAvatar}
        showSenderName={showSenderName}
        onLongPress={() => handleMessageLongPress(item)}
        onReply={() => handleReply(item)}
        onReactionPress={(emoji) => handleReactionPress(item, emoji)}
      />
    );
  };

  const renderFooter = () => {
    if (isLoadingMessages) {
      return (
        <View style={styles.loadingFooter}>
          <ActivityIndicator color={DesignTokens.colors.accent.primary} />
        </View>
      );
    }
    return null;
  };

  if (!currentGroup) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={DesignTokens.colors.accent.primary} />
        <Text style={styles.loadingText}>טוען...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {renderHeader()}

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        inverted={false}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.messagesList}
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
          autoscrollToTopThreshold: 10,
        }}
      />

      {typingUsers.length > 0 && <ChatTypingIndicator typingUsers={typingUsers} />}

      <ChatInput
        groupId={groupId}
        onSendMessage={handleSendMessage}
        onTyping={handleTyping}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(undefined)}
        disabled={isSendingMessage}
      />
    </KeyboardAvoidingView>
  );
}

// ============================================
// Styles
// ============================================

const createStyles = (tokens: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background.primary,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: tokens.colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.background.secondary,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.colors.accent.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: tokens.colors.text.primary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: tokens.colors.text.secondary,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtonText: {
    fontSize: 20,
  },

  messagesList: {
    paddingVertical: 12,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: tokens.colors.background.primary,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: tokens.colors.text.secondary,
  },

  loadingFooter: {
    padding: 16,
    alignItems: 'center',
  },
});

