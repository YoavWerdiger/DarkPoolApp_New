// ============================================
// Chat Group Screen - עיצוב מושלם
// ============================================

import React, { useMemo, useEffect, useRef, useState } from 'react';
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { useTheme } from '../../context/ThemeContext';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigation, useRoute } from '@react-navigation/native';
import ChatMessage from '../../components/chat/ChatMessage';
import ChatInput from '../../components/chat/ChatInput';
import ChatTypingIndicator from '../../components/chat/ChatTypingIndicator';
import { ChatMessage as ChatMessageType, ChatMessageType as MessageType } from '../../types/chat.types';
import { Ionicons } from '@expo/vector-icons';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { he } from 'date-fns/locale';

export default function ChatGroupScreen() {
  const DesignTokens = useDesignTokens();
  const styles = useMemo(() => createStyles(DesignTokens), [DesignTokens]);
  const { isDarkMode } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();

  const { groupId } = route.params as { groupId: string };

  // תמונות רקע לפי theme
  const backgroundImage = isDarkMode
    ? 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/backgrounds/1.png'
    : 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/backgrounds/2.png';

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

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (groupId) {
      selectGroup(groupId);
    }
  }, [groupId]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  // ============================================
  // Handlers
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

  const handleTyping = (isTyping: boolean) => {
    if (groupId) {
      setTyping(groupId, isTyping);
    }
  };

  const handleMessageLongPress = (message: ChatMessageType) => {
    const isMyMessage = message.sender_id === user?.id;
    const options: any[] = [];

    options.push({ text: 'השב', onPress: () => handleReply(message) });
    options.push({ text: message.is_starred_by_me ? 'הסר מועדפים' : 'הוסף למועדפים', onPress: () => handleStar(message) });
    options.push({ text: 'העתק', onPress: () => handleCopy(message) });

    if (isMyMessage) {
      options.push({ text: 'ערוך', onPress: () => handleEdit(message) });
      options.push({ text: 'מחק', onPress: () => handleDelete(message) });
    }

    options.push({ text: 'העבר', onPress: () => handleForward(message) });
    options.push({ text: 'ביטול', style: 'cancel' });

    Alert.alert('פעולות הודעה', '', options);
  };

  const handleReply = (message: ChatMessageType) => {
    setReplyTo({
      id: message.id,
      senderName: message.sender?.display_name || 'משתמש',
      content: message.content || 'מדיה',
    });
  };

  const handleStar = async (message: ChatMessageType) => {
    if (message.is_starred_by_me) {
      await unstarMessage(message.id);
    } else {
      await starMessage(message.id, groupId);
    }
  };

  const handleCopy = (message: ChatMessageType) => {
    Alert.alert('הועתק', 'ההודעה הועתקה');
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
  };

  const handleDelete = (message: ChatMessageType) => {
    Alert.alert(
      'מחק הודעה',
      'האם למחוק?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק רק אצלי',
          onPress: async () => await deleteMessage(message.id, false),
        },
        {
          text: 'מחק לכולם',
          style: 'destructive',
          onPress: async () => await deleteMessage(message.id, true),
        },
      ]
    );
  };

  const handleForward = (message: ChatMessageType) => {
    Alert.alert('העבר הודעה', 'בחר קבוצה');
  };

  const handleReactionPress = async (message: ChatMessageType, emoji: string) => {
    const myReaction = message.reactions?.find(r => r.emoji === emoji && r.reacted_by_me);
    if (myReaction) {
      await removeReaction(message.id, emoji);
    } else {
      await addReaction(message.id, emoji);
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const handleGroupInfoPress = () => {
    navigation.navigate('ChatGroupInfo' as never, { groupId } as never);
  };

  // ============================================
  // Render
  // ============================================

  const renderHeader = () => {
    if (!currentGroup) return null;

    return (
      <View style={styles.header}>
        <TouchableOpacity style={styles.infoButton} onPress={handleGroupInfoPress}>
          <Ionicons name="information-circle-outline" size={26} color={DesignTokens.colors.text.secondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerInfo} onPress={handleGroupInfoPress}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {currentGroup.name}
          </Text>
          <Text style={styles.headerSubtitle}>
            {currentGroup.members_count} חברים
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color={DesignTokens.colors.text.primary} />
        </TouchableOpacity>
      </View>
    );
  };

  // פונקציה לזיהוי אם צריך divider
  const shouldShowDateDivider = (currentMessage: ChatMessageType, prevMessage: ChatMessageType | null): boolean => {
    if (!prevMessage) return true; // ההודעה הראשונה
    
    const currentDate = new Date(currentMessage.created_at);
    const prevDate = new Date(prevMessage.created_at);
    
    return !isSameDay(currentDate, prevDate);
  };

  // פונקציה לניסוח תאריך
  const formatDateDivider = (date: Date): string => {
    if (isToday(date)) {
      return 'היום';
    }
    if (isYesterday(date)) {
      return 'אתמול';
    }
    return format(date, 'd בMMMM yyyy', { locale: he });
  };

  const renderDateDivider = (date: Date) => {
    return (
      <View style={styles.dateDivider}>
        <View style={styles.dateDividerLine} />
        <Text style={styles.dateDividerText}>{formatDateDivider(date)}</Text>
        <View style={styles.dateDividerLine} />
      </View>
    );
  };

  const renderMessage = ({ item, index }: { item: ChatMessageType; index: number }) => {
    const isMe = item.sender_id === user?.id;
    const prevMessage = index > 0 ? messages[index - 1] : null;
    const showAvatar = !prevMessage || prevMessage.sender_id !== item.sender_id;
    const showSenderName = !isMe && showAvatar;
    const showDivider = shouldShowDateDivider(item, prevMessage);

    return (
      <View>
        {showDivider && renderDateDivider(new Date(item.created_at))}
        <ChatMessage
          message={item}
          isMe={isMe}
          showAvatar={showAvatar}
          showSenderName={showSenderName}
          onLongPress={() => handleMessageLongPress(item)}
          onReply={() => handleReply(item)}
          onReactionPress={(emoji) => handleReactionPress(item, emoji)}
        />
      </View>
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

  const renderEmpty = () => {
    if (isLoadingMessages) return null;
    
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="chatbubbles-outline" size={64} color={DesignTokens.colors.text.secondary} />
        <Text style={styles.emptyText}>אין הודעות עדיין</Text>
        <Text style={styles.emptySubtext}>תתחיל שיחה!</Text>
      </View>
    );
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
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {renderHeader()}

        <ImageBackground
          source={{ uri: backgroundImage }}
          style={styles.backgroundImage}
          resizeMode="cover"
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item.id}
            inverted={false}
            onEndReached={loadMoreMessages}
            onEndReachedThreshold={0.5}
            ListFooterComponent={renderFooter}
            ListEmptyComponent={renderEmpty}
            contentContainerStyle={messages.length === 0 ? styles.emptyList : styles.messagesList}
            showsVerticalScrollIndicator={false}
            style={styles.flatListTransparent}
          />
        </ImageBackground>

        {typingUsers.length > 0 && (
          <View style={styles.typingContainer}>
            <ChatTypingIndicator typingUsers={typingUsers} />
          </View>
        )}

        <View style={styles.inputContainer}>
          <ChatInput
            groupId={groupId}
            onSendMessage={handleSendMessage}
            onTyping={handleTyping}
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(undefined)}
            disabled={isSendingMessage}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ============================================
// Styles
// ============================================

const createStyles = (tokens: any) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tokens.colors.background.primary,
  },
  
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background.primary,
  },

  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },

  flatListTransparent: {
    backgroundColor: 'transparent',
  },

  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: tokens.colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.background.secondary,
  },

  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: -8,
  },

  headerInfo: {
    flex: 1,
    marginHorizontal: 12,
    alignItems: 'flex-end',
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.text.primary,
    marginBottom: 2,
    textAlign: 'right',
  },

  headerSubtitle: {
    fontSize: 13,
    color: tokens.colors.text.secondary,
    fontWeight: '500',
    textAlign: 'right',
  },

  infoButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },

  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  dateDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  dateDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: tokens.colors.text.secondary,
    opacity: 0.3,
  },
  dateDividerText: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.text.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    textAlign: 'center',
    backgroundColor: tokens.colors.background.primary + 'CC', // חצי שקוף
    borderRadius: 12,
    overflow: 'hidden',
  },

  emptyList: {
    flex: 1,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },

  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: tokens.colors.text.primary,
    marginTop: 16,
    marginBottom: 4,
  },

  emptySubtext: {
    fontSize: 15,
    color: tokens.colors.text.secondary,
  },

  typingContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: tokens.colors.background.primary,
  },

  inputContainer: {
    backgroundColor: tokens.colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.background.secondary,
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
