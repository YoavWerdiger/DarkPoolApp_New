// ============================================
// Chat Group Screen - Modern Design (from reference)
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
  Image,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import UICard from '../../components/ui/UICard';
import { useTheme } from '../../context/ThemeContext';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigation, useRoute } from '@react-navigation/native';
import ChatMessage from '../../components/chat/ChatMessage';
import ChatInput from '../../components/chat/ChatInput';
import ChatTypingIndicator from '../../components/chat/ChatTypingIndicator';
import ReactionPicker from '../../components/chat/ReactionPicker';
import ReactionDetailsModal from '../../components/chat/ReactionDetailsModal';
import ForwardMessageModal from '../../components/chat/ForwardMessageModal';
import UnreadDivider from '../../components/chat/UnreadDivider';
import LongPressOverlay from '../../components/chat/LongPressOverlay';
import ChatSearchBottomSheet from '../../components/chat/ChatSearchBottomSheet';
import { MessageSnapshot } from '../../types/MessageSnapshot';
import { ChatMessage as ChatMessageType, ChatMessageType as MessageType } from '../../types/chat.types';
import { Ionicons } from '@expo/vector-icons';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { he } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { chatMessageService } from '../../services/chat/chatMessageService';

// ============================================
// Design Colors (from reference design)
// ============================================
const COLORS = {
  background: {
    primary: 'transparent',
    secondary: 'rgba(6, 18, 12, 0.85)',
    tertiary: 'rgba(10, 24, 16, 0.9)',
  },
  border: 'rgba(255, 255, 255, 0.08)',
  text: {
    primary: '#FFFFFF',
    secondary: 'rgba(209, 213, 219, 0.9)',
    tertiary: 'rgba(148, 163, 184, 0.9)',
  },
  accent: '#0FB96E',
  accentDark: '#0A8F55',
  success: '#22C55E',
  danger: '#EF4444', // red-500
};

export default function ChatGroupScreen() {
  const DesignTokens = useDesignTokens();
  const { isDarkMode } = useTheme();
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
    loadMessagesAround,
    editMessage,
    deleteMessage,
    forwardMessage,
    addReaction,
    removeReaction,
    starMessage,
    unstarMessage,
    setTyping,
    initialUnreadInfo,
  } = useChat();

  const [replyTo, setReplyTo] = useState<{
    id: string;
    senderName: string;
    content: string;
  } | undefined>();

  const [inputAreaHeight, setInputAreaHeight] = useState(0);
  const [typingAreaHeight, setTypingAreaHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [scrollViewHeight, setScrollViewHeight] = useState(0);
  const [averageItemHeight, setAverageItemHeight] = useState(120);
  const [reactionPickerVisible, setReactionPickerVisible] = useState(false);
  const [selectedMessageForReaction, setSelectedMessageForReaction] = useState<ChatMessageType | null>(null);
  const [reactionDetailsModalVisible, setReactionDetailsModalVisible] = useState(false);
  const [selectedMessageForDetails, setSelectedMessageForDetails] = useState<ChatMessageType | null>(null);
  const [forwardModalVisible, setForwardModalVisible] = useState(false);
  const [selectedMessageForForward, setSelectedMessageForForward] = useState<ChatMessageType | null>(null);
  const [showScrollToBottomButton, setShowScrollToBottomButton] = useState(false);
  const [longPressMessage, setLongPressMessage] = useState<MessageSnapshot | null>(null);
  const [searchVisible, setSearchVisible] = useState(false);
  
  const flatListRef = useRef<FlatList>(null);
  const lastJumpedMessageRef = useRef<string | null>(null);
  const jumpTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (groupId) {
      selectGroup(groupId);
    }
  }, [groupId]);

  useEffect(() => {
    if (messages.length > 0 && currentGroup?.last_read_message_id) {
      const lastReadIndex = messages.findIndex(m => m.id === currentGroup.last_read_message_id);
      
      if (lastReadIndex !== -1) {
        const invertedIndex = messages.length - 1 - lastReadIndex;
        
        setTimeout(() => {
          try {
            flatListRef.current?.scrollToIndex({
              index: invertedIndex,
              animated: false,
              viewPosition: 0.5,
            });
          } catch (error) {
            // Silently handle
          }
        }, 300);
      }
    }
  }, [messages.length, currentGroup?.last_read_message_id]);

  // Debug log for messages changes
  useEffect(() => {
    console.log('📋 ChatGroupScreen: messages updated, length:', messages.length, 'last ID:', messages[messages.length - 1]?.id);
  }, [messages]);

  useEffect(() => {
    if (typingUsers.length === 0) {
      setTypingAreaHeight(0);
    }
  }, [typingUsers.length]);

  // ============================================
  // Handlers
  // ============================================

  const handleSendMessage = async (content: string, mediaUrl?: string, mediaType?: MessageType) => {
    console.log('🔍 ChatGroupScreen handleSendMessage called:', {
      groupId,
      content,
      contentLength: content?.trim()?.length,
      hasMediaUrl: !!mediaUrl,
      mediaType,
    });
    
    if (!groupId || (!content?.trim() && !mediaUrl)) {
      console.log('⚠️ ChatGroupScreen handleSendMessage: early return - missing groupId or content');
      return;
    }

    console.log('📤 ChatGroupScreen: Calling sendMessage...');
    const result = await sendMessage({
      group_id: groupId,
      content: content?.trim() || '',
      message_type: mediaType || MessageType.TEXT,
      media_url: mediaUrl,
      reply_to_message_id: replyTo?.id,
    });
    
    console.log('📤 ChatGroupScreen: sendMessage result:', result);

    if (!result.success) {
      throw new Error(result.error || 'לא ניתן לשלוח את ההודעה');
    }

    setReplyTo(undefined);
    
    setTimeout(() => {
      scrollToBottom();
      setShowScrollToBottomButton(false);
    }, 300);
  };

  const scrollToBottom = () => {
    if (!flatListRef.current || messages.length === 0) {
      return;
    }
    
    try {
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
    } catch (error) {
      // Silently handle
    }
  };

  const handleJumpToMessage = async (messageId: string) => {
    if (jumpTimeoutRef.current) {
      clearTimeout(jumpTimeoutRef.current);
    }
    
    let messageIndex = messages.findIndex(msg => msg.id === messageId);
    
    if (messageIndex === -1) {
      const result = await loadMessagesAround(messageId);
      
      if (!result.success) {
        console.error('❌ Error loading messages around:', result.error);
        return;
      }
      
      let attempts = 0;
      const maxAttempts = 30;
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        messageIndex = messages.findIndex(msg => msg.id === messageId);
        
        if (messageIndex !== -1) {
          break;
        }
        
        attempts++;
      }
      
      if (messageIndex === -1) {
        console.error('❌ Message still not found after loading messages around');
        return;
      }
    }
    
    if (!flatListRef.current) {
      return;
    }
    
    const flatListIndex = messages.length - 1 - messageIndex;
    
    const scrollToMessage = (retryCount = 0) => {
      if (!flatListRef.current) {
        if (retryCount < 3) {
          setTimeout(() => scrollToMessage(retryCount + 1), 200);
        }
        return;
      }
      
      try {
        const estimatedItemHeight = averageItemHeight || 120;
        const itemOffset = flatListIndex * estimatedItemHeight;
        const targetOffset = Math.max(0, itemOffset - scrollViewHeight / 2 + estimatedItemHeight / 2);
        
        flatListRef.current.scrollToOffset({
          offset: targetOffset,
          animated: true,
        });
        
        setTimeout(() => {
          lastJumpedMessageRef.current = null;
        }, 500);
      } catch (e) {
        if (retryCount < 2) {
          setTimeout(() => scrollToMessage(retryCount + 1), 300);
        } else {
          lastJumpedMessageRef.current = null;
        }
      }
    };
    
    if (lastJumpedMessageRef.current === messageId) {
      lastJumpedMessageRef.current = null;
    }
    
    lastJumpedMessageRef.current = messageId;
    
    jumpTimeoutRef.current = setTimeout(() => {
      scrollToMessage();
    }, 200);
  };

  const handleTyping = (isTyping: boolean) => {
    if (groupId) {
      setTyping(groupId, isTyping);
    }
  };

  const handleMessageLongPress = (message: ChatMessageType) => {
    const isMe = message.sender_id === user?.id;
    
    const snapshot: MessageSnapshot = {
      id: message.id,
      content: message.content || '',
      mediaUrl: message.media_url,
      senderName: message.sender?.display_name,
      senderAvatar: message.sender?.profile_picture,
      timestamp: message.created_at,
      type: message.message_type as any,
      isMe,
      channelId: groupId,
      reactions: message.reactions || [],
    };
    
    setLongPressMessage(snapshot);
  };
  
  const handleMessageAction = (action: string, payload?: any) => {
    const currentMessageId = longPressMessage?.id;
    setLongPressMessage(null);
    
    if (!currentMessageId) return;
    
    const message = messages.find(m => m.id === currentMessageId);
    if (!message) return;

    setTimeout(() => {
      switch (action) {
        case 'react':
          if (payload?.emoji) {
            handleReactionPress(message, payload.emoji);
          }
          break;
        case 'reply':
          handleReply(message);
          break;
        case 'forward':
          handleForward(message);
          break;
        case 'copy':
          handleCopy(message);
          break;
        case 'edit':
          handleEdit(message);
          break;
        case 'delete':
          handleDelete(message);
          break;
        case 'star':
          handleStar(message);
          break;
        case 'pin':
          Alert.alert('בקרוב', 'פיצ\'ר זה יהיה זמין בקרוב');
          break;
        case 'info':
          break;
      }
    }, 300);
  };

  const handleOpenReactionPicker = (message: ChatMessageType) => {
    setSelectedMessageForReaction(message);
    setReactionPickerVisible(true);
  };

  const handleReactionSelected = async (emoji: string) => {
    if (selectedMessageForReaction) {
      await handleReactionPress(selectedMessageForReaction, emoji);
      setSelectedMessageForReaction(null);
    }
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
          onPress: async (newContent?: string) => {
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
    setSelectedMessageForForward(message);
    setForwardModalVisible(true);
  };

  const handleForwardMessage = async (groupIds: string[]) => {
    if (!selectedMessageForForward) return;

    const result = await forwardMessage(selectedMessageForForward.id, groupIds);
    
    if (result.success) {
      Alert.alert('הצלחה', 'ההודעה הועברה בהצלחה');
      setForwardModalVisible(false);
      setSelectedMessageForForward(null);
    } else {
      Alert.alert('שגיאה', result.error || 'לא ניתן להעביר את ההודעה');
    }
  };

  const handleReactionPress = async (message: ChatMessageType, emoji: string) => {
    // מצא את כל הריאקציות הנוכחיות של המשתמש
    const myCurrentReactions = message.reactions?.filter(r => r.reacted_by_me) || [];
    
    // אם זה אותו אימוג'י שכבר נבחר - הסר אותו
    const existingReaction = myCurrentReactions.find(r => r.emoji === emoji);
    if (existingReaction) {
      await removeReaction(message.id, emoji);
      return;
    }
    
    // אם יש ריאקציה אחרת - הסר אותה קודם
    if (myCurrentReactions.length > 0) {
      await removeReaction(message.id, myCurrentReactions[0].emoji);
    }
    
    // הוסף את הריאקציה החדשה
    await addReaction(message.id, emoji);
  };

  const handleReactionDetailsPress = (message: ChatMessageType) => {
    setSelectedMessageForDetails(message);
    setReactionDetailsModalVisible(true);
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const handleGroupInfoPress = () => {
    (navigation as any).navigate('ChatGroupInfo', { groupId });
  };

  // ============================================
  // Render
  // ============================================

  const renderHeader = () => {
    if (!currentGroup) return null;

    return (
      <View
        style={{
          paddingHorizontal: 0,
          paddingTop: 0,
          paddingBottom: DesignTokens.spacing.sm,
        }}
      >
        <UICard
          variant="blur"
          padding="md"
          style={{
            marginHorizontal: 0,
            marginTop: 0,
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            borderBottomLeftRadius: DesignTokens.borderRadius['2xl'],
            borderBottomRightRadius: DesignTokens.borderRadius['2xl'],
          }}
        >
          <View style={styles.header}>
            {/* כפתור חזור (צד אחד) */}
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Ionicons
                name="chevron-forward"
                size={22}
                color={DesignTokens.colors.text.secondary}
              />
            </TouchableOpacity>

            {/* שם הקבוצה + אווטאר + סטטוס (מרכז, מיושר לימין) */}
            <TouchableOpacity style={styles.headerContent} onPress={handleGroupInfoPress}>
              <View style={styles.headerInfo}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
                  {/* אווטאר ליד השם */}
                <View style={styles.avatarContainer}>
                  {currentGroup.avatar_url ? (
                    <Image
                      source={{ uri: currentGroup.avatar_url }}
                      style={styles.headerAvatar}
                    />
                  ) : (
                    <View style={styles.headerAvatarPlaceholder}>
                      <Ionicons
                        name="people"
                        size={18}
                        color={DesignTokens.colors.text.secondary}
                      />
                    </View>
                  )}
                  {typingUsers.length > 0 && <View style={styles.onlineIndicator} />}
                </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.headerTitle} numberOfLines={1}>
                      {currentGroup.name}
                    </Text>
                    <Text style={styles.headerSubtitle}>
                      {typingUsers.length > 0
                        ? `${typingUsers[0]?.user?.display_name || 'מישהו'} מקליד...`
                        : `${currentGroup.members_count} חברים`}
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>

            {/* כפתור חיפוש (הצד השני) */}
            <TouchableOpacity
              style={styles.searchButton}
              onPress={() => setSearchVisible(true)}
            >
              <Ionicons
                name="search"
                size={20}
                color={DesignTokens.colors.text.secondary}
              />
            </TouchableOpacity>
          </View>
        </UICard>
      </View>
    );
  };

  const shouldShowDateDivider = (currentMessage: ChatMessageType, prevMessage: ChatMessageType | null): boolean => {
    if (!prevMessage) return true;
    
    const currentDate = new Date(currentMessage.created_at);
    const prevDate = new Date(prevMessage.created_at);
    
    return !isSameDay(currentDate, prevDate);
  };

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
    const dateKey = date.toISOString();
    return (
      <View key={`date-divider-${dateKey}`} style={styles.dateDivider}>
        <View style={styles.dateDividerLine} />
        <View style={styles.dateDividerBadge}>
          <Text style={styles.dateDividerText}>{formatDateDivider(date)}</Text>
        </View>
        <View style={styles.dateDividerLine} />
      </View>
    );
  };

  const shouldShowUnreadDivider = (messageId: string): boolean => {
    if (!initialUnreadInfo || initialUnreadInfo.count === 0) return false;
    if (!initialUnreadInfo.lastReadMessageId) return false;
    
    return messageId === initialUnreadInfo.lastReadMessageId;
  };

  const renderMessage = ({ item, index }: { item: ChatMessageType; index: number }) => {
    const isMe = item.sender_id === user?.id;
    // עם inverted וסדר יורד, ההודעה הקודמת ויזואלית (מעל) היא באינדקס index + 1
    const prevMessage = index < messages.length - 1 ? messages[index + 1] : null;
    const showAvatar = !prevMessage || prevMessage.sender_id !== item.sender_id;
    const showSenderName = !isMe && showAvatar;
    const showDivider = shouldShowDateDivider(item, prevMessage);
    const showUnreadDivider = shouldShowUnreadDivider(item.id);

    return (
      <View key={`message-wrapper-${item.id}-${index}`}>
        {showDivider && (
          <View key={`divider-${item.id}-${index}`}>
            {renderDateDivider(new Date(item.created_at))}
          </View>
        )}
        <ChatMessage
          key={`message-${item.id}-${index}`}
          message={item}
          isMe={isMe}
          showAvatar={showAvatar}
          showSenderName={showSenderName}
          onLongPress={() => handleMessageLongPress(item)}
          onReply={() => handleReply(item)}
          onReactionPress={(emoji) => handleReactionPress(item, emoji)}
          onReactionDetailsPress={() => handleReactionDetailsPress(item)}
          onJumpToMessage={handleJumpToMessage}
        />
        {showUnreadDivider && (
          <View key={`unread-divider-${item.id}-${index}`}>
            <UnreadDivider 
              unreadCount={initialUnreadInfo?.count || 0} 
            />
          </View>
        )}
      </View>
    );
  };

  const renderFooter = () => {
    if (isLoadingMessages) {
      return (
        <View style={styles.loadingFooter}>
          <ActivityIndicator color={COLORS.accent} />
        </View>
      );
    }
    return null;
  };

  const renderEmpty = () => {
    if (isLoadingMessages) return null;
    
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="chatbubbles-outline" size={64} color={COLORS.text.tertiary} />
        <Text style={styles.emptyText}>אין הודעות עדיין</Text>
        <Text style={styles.emptySubtext}>תתחיל שיחה!</Text>
      </View>
    );
  };

  // Typing Indicator with bouncing dots and user avatar
  const renderTypingIndicator = () => {
    if (typingUsers.length === 0) return null;

    // Get the first typing user
    const typingUser = typingUsers[0];
    
    // Try to get user profile picture from multiple sources
    let userAvatar: string | null = null;
    
    // First try from typingUser.user (if available)
    if ((typingUser.user as any)?.profile_picture) {
      userAvatar = (typingUser.user as any).profile_picture;
    }
    // Then try from members list
    else if (currentGroup?.members) {
      const member = currentGroup.members.find(m => m.user_id === typingUser.user_id);
      userAvatar = member?.user?.profile_picture || null;
    }
    
    return (
      <View style={styles.typingIndicatorContainer}>
        {/* User Avatar - w-8 h-8 rounded-full */}
        {userAvatar ? (
          <Image 
            source={{ uri: userAvatar }} 
            style={styles.typingAvatar}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.typingAvatarPlaceholder}>
            <Ionicons name="person" size={14} color={COLORS.text.secondary} />
          </View>
        )}
        
        {/* Typing Bubble - bg-[#1a1a1a] px-4 py-3 rounded-2xl rounded-bl-md */}
        <View style={styles.typingBubble}>
          <View style={styles.typingDots}>
            <BouncingDot delay={0} />
            <BouncingDot delay={150} />
            <BouncingDot delay={300} />
          </View>
        </View>
      </View>
    );
  };

  if (!currentGroup) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>טוען...</Text>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={['#000000', '#000A04', '#001A0A', '#001A0A', '#000A04', '#000000']}
      locations={[0, 0.2, 0.35, 0.65, 0.8, 1]}
      style={{ flex: 1 }}
    >
      {/* מחזירים גם את ה-top safe-area כדי שהכרטיס לא יגלוש לתוך הנוץ' */}
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          {renderHeader()}

          <View style={styles.messagesContainer}>
            <FlatList
              ref={flatListRef}
              data={messages}
              extraData={messages}
              renderItem={({ item, index }) => renderMessage({ item, index })}
              keyExtractor={(item) => item.id}
              inverted={true}
              onEndReached={loadMoreMessages}
              onEndReachedThreshold={0.5}
              ListHeaderComponent={renderFooter}
              ListEmptyComponent={renderEmpty}
              scrollEnabled={true}
              bounces={true}
              alwaysBounceVertical={true}
              directionalLockEnabled={false}
              initialNumToRender={15}
              maxToRenderPerBatch={8}
              windowSize={10}
              removeClippedSubviews={false}
              updateCellsBatchingPeriod={100}
              onScrollToIndexFailed={(info) => {
                if (info.averageItemLength && info.averageItemLength > 0) {
                  setAverageItemHeight(info.averageItemLength);
                }
                
                const estimatedItemHeight = info.averageItemLength || averageItemHeight || 120;
                const targetOffset = info.index * estimatedItemHeight;
                
                setTimeout(() => {
                  try {
                    if (flatListRef.current) {
                      flatListRef.current.scrollToOffset({
                        offset: targetOffset,
                        animated: true,
                      });
                    }
                  } catch (e) {
                    // Silently handle
                  }
                }, 200);
              }}
              contentContainerStyle={[
                messages.length === 0 ? styles.emptyList : styles.messagesList,
                { paddingTop: 0, paddingBottom: 0, flexGrow: 1 }
              ]}
              showsVerticalScrollIndicator={true}
              style={styles.flatListTransparent}
              onContentSizeChange={(width, height) => {
                setContentHeight(height);
                if (height > 0 && messages.length > 0) {
                  const calculatedHeight = height / messages.length;
                  setAverageItemHeight(calculatedHeight);
                }
              }}
              onLayout={(e) => {
                const { height } = e.nativeEvent.layout;
                setScrollViewHeight(height);
              }}
              onScroll={(e) => {
                const { contentOffset } = e.nativeEvent;
                const shouldShowButton = contentOffset.y > 100;
                setShowScrollToBottomButton(shouldShowButton);
              }}
              scrollEventThrottle={16}
            />
            
            {/* Scroll to bottom button */}
            {showScrollToBottomButton && (
              <TouchableOpacity
                style={styles.scrollToBottomButton}
                onPress={scrollToBottom}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-down" size={24} color={COLORS.text.primary} />
              </TouchableOpacity>
            )}
          </View>

        {/* Typing indicator in chat */}
        {typingUsers.length > 0 && renderTypingIndicator()}

        {/* Input pill - UICard glass, respects KeyboardAvoidingView & safe area via ChatInput */}
        <View
          style={{
            paddingHorizontal: DesignTokens.spacing.md, // פחות מרווח בצדדים – הכדור יותר רחב
            paddingBottom: 0,                           // לא יוצר "safe" מלאכותי מתחת לאיזור הכתיבה
            paddingTop: DesignTokens.spacing.xs,
          }}
        >
          <UICard
            variant="blur"
            padding="none"
            style={styles.inputPillCard}
          >
            <ChatInput
              groupId={groupId}
              onSendMessage={handleSendMessage}
              onTyping={handleTyping}
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(undefined)}
              disabled={isSendingMessage}
            />
          </UICard>
        </View>
      </KeyboardAvoidingView>

      {/* Modals */}
      <ReactionPicker
        visible={reactionPickerVisible}
        onClose={() => {
          setReactionPickerVisible(false);
          setSelectedMessageForReaction(null);
        }}
        onReaction={handleReactionSelected}
        messageReactions={selectedMessageForReaction?.reactions || []}
      />

      <ReactionDetailsModal
        visible={reactionDetailsModalVisible}
        onClose={() => {
          setReactionDetailsModalVisible(false);
          setSelectedMessageForDetails(null);
        }}
        message={selectedMessageForDetails}
      />

      <ForwardMessageModal
        visible={forwardModalVisible}
        onClose={() => {
          setForwardModalVisible(false);
          setSelectedMessageForForward(null);
        }}
        onForward={handleForwardMessage}
        currentGroupId={groupId}
      />

      <LongPressOverlay
        visible={!!longPressMessage}
        message={longPressMessage}
        onClose={() => setLongPressMessage(null)}
        onAction={handleMessageAction}
      />

      <ChatSearchBottomSheet
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        groupId={groupId}
        onMessagePress={handleJumpToMessage}
      />
    </SafeAreaView>
    </LinearGradient>
  );
}

// ============================================
// Bouncing Dot Component for Typing Indicator
// ============================================

const BouncingDot = ({ delay }: { delay: number }) => {
  const bounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: -4,
          duration: 300,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  return (
    <Animated.View
      style={[
        styles.typingDot,
        { transform: [{ translateY: bounceAnim }] }
      ]}
    />
  );
};

// ============================================
// Styles - Exact Design from Reference
// ============================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  // Header row inside glass card
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  backButton: {
    padding: 8,
    // יותר רווח בינו לבין התמונה
    marginLeft: 5,
    marginRight: -3,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    // פחות רווח בין התמונה לטקסטים מימין
    gap: 6,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: -5,

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
    backgroundColor: COLORS.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.success,
    borderWidth: 2,
    borderColor: COLORS.background.secondary,
  },
  headerInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 2,
    marginRight: 5,
  },
  headerSubtitle: {
    fontSize: 12,
    marginRight: 5,
    color: COLORS.text.secondary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerButton: {
    padding: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
  },
  searchButton: {
    padding: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
  },

  messagesContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  flatListTransparent: {
    backgroundColor: 'transparent',
    flex: 1,
  },

  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 24,
  },

  // Date Divider
  dateDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  dateDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.text.tertiary,
    opacity: 0.3,
  },
  dateDividerBadge: {
    backgroundColor: COLORS.background.tertiary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginHorizontal: 8,
  },
  dateDividerText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.text.secondary,
    textAlign: 'center',
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
    color: COLORS.text.primary,
    marginTop: 16,
    marginBottom: 4,
  },

  emptySubtext: {
    fontSize: 15,
    color: COLORS.text.secondary,
  },

  // Typing Indicator - from reference design
  // flex gap-2 items-end
  typingIndicatorContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'transparent', // transparent so background image shows
    gap: 8,
  },
  // w-8 h-8 rounded-full object-cover
  typingAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  typingAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // bg-[#1a1a1a] px-4 py-3 rounded-2xl rounded-bl-md
  typingBubble: {
    backgroundColor: COLORS.background.secondary, // bg-[#1a1a1a]
    paddingHorizontal: 16, // px-4
    paddingVertical: 12, // py-3
    borderRadius: 20, // rounded-2xl
    borderBottomLeftRadius: 6, // rounded-bl-md (RTL)
  },
  // flex gap-1
  typingDots: {
    flexDirection: 'row',
    gap: 4, // gap-1 = 4px
  },
  // w-2 h-2 bg-gray-500 rounded-full
  typingDot: {
    width: 8, // w-2 = 8px
    height: 8, // h-2 = 8px
    borderRadius: 4, // rounded-full
    backgroundColor: COLORS.text.tertiary, // bg-gray-500
  },

  // Input pill card at bottom
  inputPillCard: {
    borderRadius: 999,
    overflow: 'hidden',
  },

  restrictedInputMessage: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 8,
  },
  restrictedInputText: {
    fontSize: 14,
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
  
  scrollToBottomButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background.primary,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.text.secondary,
  },

  loadingFooter: {
    padding: 16,
    alignItems: 'center',
  },
});
