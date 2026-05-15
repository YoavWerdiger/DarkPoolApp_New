// ============================================
// Chat Group Screen - Modern Design (from reference)
// ============================================

import { legacyAlert } from '../../utils/appDialog';
import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { View, FlatList, Text, StyleSheet, type ViewStyle, TouchableOpacity, Pressable, ActivityIndicator, Image, Modal, TextInput, Animated as RNAnimated, Easing, Platform, InteractionManager } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatScreenShell } from '../../components/chat/ChatScreenShell';
import UICard from '../../components/ui/UICard';
import { useDesignTokens } from '../../components/ui/DesignTokens';

import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useLockParentDrawerWhileFocused } from '../../hooks/useLockParentDrawerWhileFocused';
import ChatMessage from '../../components/chat/ChatMessage';
import ChatInput from '../../components/chat/ChatInput';

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
import { logger } from '../../utils/logger';
import { HapticFeedback } from '../../utils/hapticFeedback';

export default function ChatGroupScreen() {
  const DesignTokens = useDesignTokens();
  const styles = useMemo(() => createChatGroupStyles(DesignTokens), [DesignTokens]);
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  useLockParentDrawerWhileFocused();

  const flatListRef = useRef<FlatList<any>>(null);

  const { groupId = '', scrollToMessageId } = (route.params || {}) as { groupId: string; scrollToMessageId?: string };

  const {
    currentGroup,
    messages,
    typingUsers,
    isLoadingMessages,
    isSendingMessage,
    isConnected,
    realtimeConnectionState,
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

  // בדיקה אם זו קבוצת הכרזות
  const isAnnouncementGroup = useMemo(() => {
    if (!currentGroup?.name) return false;
    const lowerName = currentGroup.name.toLowerCase();
    return lowerName.includes('הכרזות') || lowerName.includes('announcement');
  }, [currentGroup?.name]);

  // With inverted={true}: messages[0] (newest) renders at the BOTTOM.
  // scrollToOffset(0) is always "go to newest" — simple and reliable.
  // onEndReached fires when scrolled to index N-1 (oldest) = user wants older history.
  const hasInitiallyRenderedRef = useRef(false);

  const scrollToBottom = useCallback((forceAnimated: boolean = false) => {
    const list = flatListRef.current;
    if (!list || messages.length === 0) return;
    setShowScrollToBottomButton(false);
    RNAnimated.timing(scrollBtnOpacity, { toValue: 0, duration: 120, useNativeDriver: true }).start();
    isAtBottomRef.current = true;
    // Always use animated: false for programmatic auto-scroll.
    // animated: true + simultaneous React re-render (message confirmed) causes
    // the scroll position to jump to unpredictable values (observed: ~3000px).
    // The snap at offset 0 is instant enough to feel natural.
    // Only use animated: true when the FAB button is explicitly tapped (forceAnimated=true)
    // and there are no pending re-renders.
    requestAnimationFrame(() => {
      list.scrollToOffset({ offset: 0, animated: forceAnimated });
    });
  }, [messages.length]);

  // עוקב אחרי האם המשתמש נמצא בתחתית הרשימה
  const isAtBottomRef = useRef(true);
  const isSendingRef = useRef(false);

  const lastScrollLogRef = useRef(0);
  const showScrollBtnRef = useRef(false);
  const handleScroll = useCallback((event: any) => {
    const { contentOffset } = event.nativeEvent;
    // Inverted list: offset 0 = bottom (newest messages). Higher offset = scrolled toward older.
    const offsetY = contentOffset.y;
    isAtBottomRef.current = offsetY < 80;
    const shouldShow = offsetY > 200;
    // Separate animation from state update — calling Animated.timing inside a
    // state updater is a side effect and breaks in React 18 strict mode.
    if (shouldShow !== showScrollBtnRef.current) {
      showScrollBtnRef.current = shouldShow;
      setShowScrollToBottomButton(shouldShow);
      RNAnimated.timing(scrollBtnOpacity, {
        toValue: shouldShow ? 1 : 0,
        duration: 180,
        useNativeDriver: true,
      }).start();
    }
    const now = Date.now();
    if (now - lastScrollLogRef.current > 500) {
      lastScrollLogRef.current = now;
      logger.debug('ChatGroupScreen', `onScroll offsetY=${offsetY.toFixed(0)} atBottom=${offsetY < 80}`);
    }
  }, []);

  // react-native-keyboard-controller (behavior="translate-with-padding") handles
  // keyboard show/hide natively via Reanimated — no manual scroll listeners needed.
  // Adding Keyboard listeners here would fight the controller's animation.

  // With inverted list, newest messages appear at offset 0 automatically.
  // No initial scroll needed — just track new messages for auto-scroll.
  const prevMessagesLengthRef = useRef(0);
  useEffect(() => {
    const newLength = messages.length;
    const prevLength = prevMessagesLengthRef.current;
    prevMessagesLengthRef.current = newLength;

    if (newLength > 0 && !hasInitiallyRenderedRef.current) {
      hasInitiallyRenderedRef.current = true;
      logger.debug('ChatGroupScreen', `initial messages loaded (${newLength})`);
      scrollToBottom(false);
      return;
    }

    const isNewMessage = newLength > prevLength && newLength - prevLength <= 3;
    if (!isNewMessage) return;

    const shouldScroll = isSendingRef.current || isAtBottomRef.current;
    if (shouldScroll) {
      // animated: false — prevents scroll conflicts with simultaneous re-renders
      scrollToBottom(false);
    }
  }, [messages.length, scrollToBottom]);

  const [replyTo, setReplyTo] = useState<{
    id: string;
    senderName: string;
    content: string;
  } | undefined>();

  const [averageItemHeight, setAverageItemHeight] = useState(120);
  const [reactionPickerVisible, setReactionPickerVisible] = useState(false);
  const [selectedMessageForReaction, setSelectedMessageForReaction] = useState<ChatMessageType | null>(null);
  const [reactionDetailsModalVisible, setReactionDetailsModalVisible] = useState(false);
  const [selectedMessageForDetails, setSelectedMessageForDetails] = useState<ChatMessageType | null>(null);
  const [forwardModalVisible, setForwardModalVisible] = useState(false);
  const [selectedMessageForForward, setSelectedMessageForForward] = useState<ChatMessageType | null>(null);
  const [showScrollToBottomButton, setShowScrollToBottomButton] = useState(false);
  const scrollBtnOpacity = useRef(new RNAnimated.Value(0)).current;
  // Stable extraData object — only changes when visible UX state changes
  const flatListExtraData = useMemo(() => ({
    h: highlightedMessageId,
    u: initialUnreadInfo?.count,
    uid: user?.id,
  }), [highlightedMessageId, initialUnreadInfo?.count, user?.id]);
  const [longPressMessage, setLongPressMessage] = useState<MessageSnapshot | null>(null);
  const [searchVisible, setSearchVisible] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  const lastJumpedMessageRef = useRef<string | null>(null);
  const jumpTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const messagesRef = useRef(messages);
  // Track IDs loaded at initial load – only animate truly new messages
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (jumpTimeoutRef.current) {
        clearTimeout(jumpTimeoutRef.current);
        jumpTimeoutRef.current = null;
      }
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = null;
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (groupId) {
      selectGroup(groupId);
      hasInitiallyRenderedRef.current = false;
      prevMessagesLengthRef.current = 0;
    }
  }, [groupId]);

  // Auto-navigate to groups list when removed from group by an admin.
  // ChatContext clears currentGroup when membership DELETE event fires.
  useEffect(() => {
    if (!groupId) return;
    if (currentGroup === null && !isLoadingMessages) {
      // Group was cleared — check if it's still in the groups list
      // If not, we were removed → go back to groups list
      (navigation as any).navigate('ChatGroupsList');
    }
  }, [currentGroup, isLoadingMessages, groupId]);

  // רענון הודעות רק כשחוזרים למסך (לא בהתמקדות הראשונה)
  const isFirstFocusRef = useRef(true);
  useEffect(() => {
    isFirstFocusRef.current = true;
  }, [groupId]);
  useFocusEffect(
    useCallback(() => {
      if (!groupId || !user) return;
      if (isFirstFocusRef.current) {
        isFirstFocusRef.current = false;
        return;
      }
      selectGroup(groupId);
    }, [groupId, user, selectGroup])
  );

  useEffect(() => {
    if (messages.length > 0 && currentGroup?.last_read_message_id) {
      // With inverted list, messages[0]=newest. If lastRead is not at index 0,
      // there are newer messages — scroll to show the last read message.
      const lastReadIndex = messages.findIndex(m => m.id === currentGroup.last_read_message_id);
      if (lastReadIndex > 0) {
        const timeoutId = setTimeout(() => {
          if (!isMountedRef.current) return;
          try {
            flatListRef.current?.scrollToIndex({
              index: lastReadIndex,
              animated: false,
              viewPosition: 0.5,
            });
          } catch { /* onScrollToIndexFailed will handle */ }
        }, 300);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [currentGroup?.last_read_message_id, messages.length]);

  useEffect(() => {
    if (scrollToMessageId && messages.length > 0) {
      const timer = setTimeout(() => handleJumpToMessage(scrollToMessageId), 400);
      return () => clearTimeout(timer);
    }
  }, [scrollToMessageId, messages.length > 0]);

  // ============================================
  // Handlers
  // ============================================

  // PERF: All handlers that flow into ChatInput or ChatMessage MUST be
  // useCallback'd with stable deps. Without it the children are forced to
  // re-render on every parent state update (new message arriving, scroll
  // event, anything), which is the root cause of "send button feels delayed".
  const handleSendMessage = useCallback(async (
    content: string,
    mediaUrl?: string,
    mediaType?: MessageType,
    metadata?: { waveformData?: number[]; media_urls?: any[]; mentioned_users?: string[]; mentions?: any[];[key: string]: any },
  ) => {
    const hasMediaGroup = mediaType === MessageType.MEDIA_GROUP && (metadata?.media_urls?.length ?? 0) > 0;

    if (!groupId || (!content?.trim() && !mediaUrl && !hasMediaGroup)) {
      return;
    }

    isSendingRef.current = true;

    try {
      const result = await sendMessage({
        group_id: groupId,
        content: content?.trim() || '',
        message_type: mediaType || MessageType.TEXT,
        media_url: mediaUrl,
        reply_to_message_id: replyTo?.id,
        metadata: metadata,
        media_file_name: metadata?.media_file_name,
        media_size: metadata?.media_size,
        media_thumbnail_url: metadata?.media_thumbnail_url,
        media_duration: metadata?.media_duration,
        media_urls: metadata?.media_urls,
        mentioned_users: metadata?.mentioned_users || [],
        existing_optimistic_id: metadata?.existing_optimistic_id,
      });

      if (!result.success && !(result as any).queued) {
        logger.error('ChatGroupScreen', 'Send message failed', result.error);
      } else {
        void HapticFeedback.impactLight();
      }

      setReplyTo(undefined);
      setShowScrollToBottomButton(false);
      // הגלילה עצמה תקרה דרך ה-useEffect של messages.length (שיורה כשה-optimistic message נכנס)
      // – זה מונע מספר פקודות scrollToOffset במקביל שמתבטלות זו את זו ב-iOS.
    } catch (e) {
      logger.error('ChatGroupScreen', 'Send message error', e);
    } finally {
      setTimeout(() => { isSendingRef.current = false; }, 500);
    }
  }, [groupId, replyTo?.id, sendMessage]);

  const handleJumpToMessage = useCallback(async (messageId: string) => {
    if (!isMountedRef.current) return;

    if (jumpTimeoutRef.current) {
      clearTimeout(jumpTimeoutRef.current);
      jumpTimeoutRef.current = null;
    }

    let messageIndex = messagesRef.current.findIndex(msg => msg.id === messageId);

    if (messageIndex === -1) {
      const result = await loadMessagesAround(messageId);

      if (!isMountedRef.current) return;

      if (!result.success) {
        return;
      }

      let attempts = 0;
      const maxAttempts = 30;

      while (attempts < maxAttempts && isMountedRef.current) {
        await new Promise(resolve => setTimeout(resolve, 100));
        if (!isMountedRef.current) return;

        messageIndex = messagesRef.current.findIndex(msg => msg.id === messageId);

        if (messageIndex !== -1) {
          break;
        }

        attempts++;
      }

      if (messageIndex === -1 || !isMountedRef.current) {
        return;
      }
    }

    if (!isMountedRef.current || !flatListRef.current) {
      return;
    }

    const scrollToMessage = () => {
      if (!isMountedRef.current || !flatListRef.current) return;

      // With inverted list, index in messages array = index in FlatList data
      try {
        flatListRef.current.scrollToIndex({
          index: messageIndex,
          animated: true,
          viewPosition: 0.5,
        });
      } catch {
        // onScrollToIndexFailed callback will handle the fallback
      }

      setHighlightedMessageId(messageId);
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setHighlightedMessageId(null);
          lastJumpedMessageRef.current = null;
        }
      }, 2000);
    };

    if (lastJumpedMessageRef.current === messageId) {
      lastJumpedMessageRef.current = null;
    }

    lastJumpedMessageRef.current = messageId;

    jumpTimeoutRef.current = setTimeout(() => {
      scrollToMessage();
    }, 50);
  }, [loadMessagesAround]);

  const handleTyping = useCallback((isTyping: boolean) => {
    if (groupId) {
      setTyping(groupId, isTyping);
    }
  }, [groupId, setTyping]);

  const handleMessageLongPress = useCallback((message: ChatMessageType) => {
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
  }, [groupId, user?.id]);

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
          handleDelete(message, false);
          break;
        case 'deleteForEveryone':
          handleDelete(message, true);
          break;
        case 'star':
          handleStar(message);
          break;
        case 'pin':
          handlePinMessage(message);
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

  const handleReply = useCallback((message: ChatMessageType) => {
    setReplyTo({
      id: message.id,
      senderName: message.sender?.display_name || 'משתמש',
      content: message.content || 'מדיה',
    });
  }, []);

  // Memoised onCancelReply so ChatInput's React.memo can short-circuit when
  // the user just types a key (was: `() => setReplyTo(undefined)` inline,
  // which gave a fresh function reference on every keystroke).
  const handleCancelReply = useCallback(() => setReplyTo(undefined), []);

  const handleStar = async (message: ChatMessageType) => {
    try {
      if (message.is_starred_by_me) {
        await unstarMessage(message.id);
        void HapticFeedback.selection();
      } else {
        await starMessage(message.id, groupId);
        void HapticFeedback.impactLight();
      }
    } catch (e) {
      logger.error('ChatGroupScreen', 'Star/unstar failed', e);
    }
  };

  const handlePinMessage = async (message: ChatMessageType) => {
    if (!user?.id) return;
    try {
      const { error } = await supabase
        .from('pinned_messages')
        .upsert({
          channel_id: groupId,
          message_id: message.id,
          pinned_by: user.id,
        }, { onConflict: 'channel_id,message_id' });

      if (error) {
        legacyAlert('שגיאה', 'לא ניתן להצמיד את ההודעה');
      } else {
        void HapticFeedback.impactLight();
      }
    } catch {
      legacyAlert('שגיאה', 'שגיאה בהצמדת ההודעה');
    }
  };

  const handleCopy = async (message: ChatMessageType) => {
    let textToCopy = message.content || message.media_url || '';
    if (message.message_type === MessageType.TRADE && message.content?.trim()) {
      try {
        const p = JSON.parse(message.content.trim()) as { trade?: { symbol?: string; pnl?: number } };
        const t = p.trade;
        if (t?.symbol) {
          textToCopy = `טרייד ${t.symbol}${typeof t.pnl === 'number' ? ` · P&L $${t.pnl.toFixed(2)}` : ''}`;
        }
      } catch {
        /* נשאר JSON גולמי */
      }
    }
    if (!textToCopy) return;
    try {
      const Clipboard = await import('expo-clipboard');
      await Clipboard.setStringAsync(textToCopy);
      void HapticFeedback.selection();
    } catch {
      /* clipboard unavailable on this platform */
    }
  };

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editModalText, setEditModalText] = useState('');
  const [editModalMessageId, setEditModalMessageId] = useState('');

  const handleEdit = (message: ChatMessageType) => {
    setEditModalText(message.content || '');
    setEditModalMessageId(message.id);
    setEditModalVisible(true);
  };

  const handleEditConfirm = async () => {
    if (editModalText.trim()) {
      try {
        const result = await editMessage(editModalMessageId, editModalText.trim());
        if (!result.success) {
          legacyAlert('שגיאה', result.error || 'לא ניתן לערוך את ההודעה');
          return;
        }
        void HapticFeedback.impactLight();
      } catch (e) {
        logger.error('ChatGroupScreen', 'Edit message failed', e);
        legacyAlert('שגיאה', 'לא ניתן לערוך את ההודעה');
        return;
      }
    }
    setEditModalVisible(false);
  };

  const handleDelete = (message: ChatMessageType, forEveryone: boolean) => {
    const doDelete = async () => {
      try {
        const result = await deleteMessage(message.id, forEveryone);
        if (!result.success) {
          legacyAlert('שגיאה', result.error || 'לא ניתן למחוק את ההודעה');
        } else {
          void HapticFeedback.impactLight();
        }
      } catch (e) {
        logger.error('ChatGroupScreen', 'Delete message failed', e);
        legacyAlert('שגיאה', 'לא ניתן למחוק את ההודעה');
      }
    };

    // אישור מחיקה
    legacyAlert(
      forEveryone ? 'מחק לכולם' : 'מחק אצלי',
      forEveryone ? 'ההודעה תימחק לכל המשתתפים' : 'ההודעה תוסתר רק אצלך',
      [
        { text: 'ביטול', style: 'cancel' },
        { text: 'מחק', style: 'destructive', onPress: doDelete },
      ]
    );
  };

  const handleForward = (message: ChatMessageType) => {
    setSelectedMessageForForward(message);
    setForwardModalVisible(true);
  };

  const isForwardingRef = useRef(false);
  const handleForwardMessage = async (groupIds: string[]) => {
    if (!selectedMessageForForward || isForwardingRef.current) return;
    isForwardingRef.current = true;
    try {
      const result = await forwardMessage(selectedMessageForForward.id, groupIds);

      if (result.success) {
        void HapticFeedback.impactLight();
        legacyAlert('הצלחה', 'ההודעה הועברה בהצלחה');
        setForwardModalVisible(false);
        setSelectedMessageForForward(null);
      } else {
        legacyAlert('שגיאה', result.error || 'לא ניתן להעביר את ההודעה');
      }
    } finally {
      isForwardingRef.current = false;
    }
  };

  const handleReactionPress = useCallback(async (message: ChatMessageType, emoji: string) => {
    if (message.id.startsWith('temp-')) return;

    try {
      const myCurrentReactions = message.reactions?.filter(r => r.reacted_by_me) || [];

      const existingReaction = myCurrentReactions.find(r => r.emoji === emoji);
      if (existingReaction) {
        await removeReaction(message.id, emoji);
        void HapticFeedback.selection();
        return;
      }

      if (myCurrentReactions.length > 0) {
        await removeReaction(message.id, myCurrentReactions[0].emoji);
      }

      await addReaction(message.id, emoji);
      void HapticFeedback.impactLight();
    } catch (e) {
      logger.error('ChatGroupScreen', 'Reaction press failed', e);
    }
  }, [addReaction, removeReaction]);

  const handleReactionDetailsPress = useCallback((message: ChatMessageType) => {
    setSelectedMessageForDetails(message);
    setReactionDetailsModalVisible(true);
  }, []);

  /** חזרה — למסך הקודם בסטאק (לרוב רשימת הצ'אטים). */
  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    // fallback במצבי deeplink/stack חריג
    (navigation as any).navigate('ChatGroupsList');
  };

  const handleGroupInfoPress = () => {
    (navigation as any).navigate('ChatGroupInfo', { groupId });
  };

  // ============================================
  // Render
  // ============================================

  const renderHeader = () => {
    if (!currentGroup) return null;

    /**
     * פס כלים LTR: חיפוש משמאל | במרכז טקסט ואז תמונה מימין לטקסט | חזרה מימין.
     * אייקון החזרה מפוך (scaleX) כדי שיכוון נכון לעברית.
     */
    const searchButton = (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="חיפוש בהודעות"
        style={styles.searchButton}
        onPress={() => setSearchVisible(true)}
      >
        <Ionicons name="search" size={20} color={DesignTokens.colors.text.primary} />
      </TouchableOpacity>
    );

    const backButton = (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="חזרה"
        style={styles.backButton}
        onPress={handleBack}
      >
        <View style={styles.headerBackIconFlip}>
          <Ionicons name="chevron-back" size={24} color={DesignTokens.colors.text.primary} />
        </View>
      </TouchableOpacity>
    );

    const center = (
      <TouchableOpacity style={styles.headerContent} onPress={handleGroupInfoPress} activeOpacity={0.7}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {currentGroup.name}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {typingUsers.length > 0
              ? `${typingUsers[0]?.user?.display_name || 'מישהו'} מקליד...`
              : `${currentGroup.members_count} חברים`}
          </Text>
        </View>
        <View style={styles.avatarContainer}>
          {currentGroup.avatar_url ? (
            <Image source={{ uri: currentGroup.avatar_url }} style={styles.headerAvatar} resizeMode="cover" />
          ) : (
            <View style={styles.headerAvatarPlaceholder}>
              <Ionicons name="people" size={18} color={DesignTokens.colors.text.secondary} />
            </View>
          )}
          {isConnected && <View style={styles.onlineIndicator} />}
        </View>
      </TouchableOpacity>
    );

    return (
      <UICard
        variant="glass"
        glassIntensity="light"
        padding="none"
        style={styles.headerGlassOuter}
        contentContainerStyle={styles.headerBarInner}
      >
        {searchButton}
        {center}
        {backButton}
      </UICard>
    );
  };

  const shouldShowDateDivider = useCallback((currentMessage: ChatMessageType, prevMessage: ChatMessageType | null): boolean => {
    if (!prevMessage) return true;
    const currentDate = new Date(currentMessage.created_at);
    const prevDate = new Date(prevMessage.created_at);
    return !isSameDay(currentDate, prevDate);
  }, []);

  const formatDateDivider = useCallback((date: Date): string => {
    if (isToday(date)) return 'היום';
    if (isYesterday(date)) return 'אתמול';
    return format(date, 'd בMMMM yyyy', { locale: he });
  }, []);

  const renderDateDivider = useCallback((date: Date) => {
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
  }, [formatDateDivider, styles]);

  const shouldShowUnreadDivider = useCallback((messageId: string): boolean => {
    if (!initialUnreadInfo || initialUnreadInfo.count === 0) return false;
    if (!initialUnreadInfo.lastReadMessageId) return false;
    return messageId === initialUnreadInfo.lastReadMessageId;
  }, [initialUnreadInfo]);

  const renderMessage = useCallback(
    ({ item, index }: { item: ChatMessageType; index: number }) => {
      const isMe = item.sender_id === user?.id;
      // C6: use ref so renderMessage doesn't need `messages` in its dependency array
      // Inverted list: index+1 = older message (above visually), index-1 = newer (below visually)
      const olderMessage = index < messagesRef.current.length - 1 ? messagesRef.current[index + 1] : null;
      const newerMessage = index > 0 ? messagesRef.current[index - 1] : null;
      // Date divider: compare against older neighbor (chronological order)
      // Avatar: show on BOTTOMMOST message of a sender run = when no newer neighbor from same sender
      // WhatsApp shows avatar on the newest message of each consecutive run.
      const timeDiff = olderMessage
        ? Math.abs(new Date(item.created_at).getTime() - new Date(olderMessage.created_at).getTime())
        : Infinity;
      const showAvatar = !newerMessage || newerMessage.sender_id !== item.sender_id || timeDiff > 5 * 60 * 1000;
      const showSenderName = !isMe && showAvatar;
      const showDivider = shouldShowDateDivider(item, olderMessage);
      // Keep prevMessage alias for date divider (expects older message)
      const prevMessage = olderMessage;
      const showUnreadDivider = shouldShowUnreadDivider(item.id);

      // No inner `key` props: FlatList already keys cells via `keyExtractor`,
      // and child elements inside a renderItem return are NOT in an array —
      // adding keys here costs reconciliation time without any benefit.
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
            onReactionDetailsPress={() => handleReactionDetailsPress(item)}
            onJumpToMessage={handleJumpToMessage}
            isHighlighted={item.id === highlightedMessageId}
          />
          {showUnreadDivider && (
            <UnreadDivider unreadCount={initialUnreadInfo?.count || 0} />
          )}
        </View>
      );
    },
    [
      // C6: removed `messages` – accessed via messagesRef.current to prevent O(N) re-renders
      user?.id,
      highlightedMessageId,
      initialUnreadInfo,
      handleMessageLongPress,
      handleReply,
      handleReactionPress,
      handleReactionDetailsPress,
      handleJumpToMessage,
      shouldShowDateDivider,
      shouldShowUnreadDivider,
      renderDateDivider,
    ]
  );

  const renderFooter = () => {
    if (isLoadingMessages) {
      return (
        <View style={styles.loadingFooter}>
          <ActivityIndicator color={DesignTokens.colors.primary.main} />
        </View>
      );
    }
    return null;
  };

  const renderEmpty = () => {
    if (isLoadingMessages) return null;

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="chatbubbles-outline" size={64} color={DesignTokens.colors.text.tertiary} />
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
            <Ionicons name="person" size={14} color={DesignTokens.colors.text.secondary} />
          </View>
        )}

        {/* Typing Bubble - bg-[#1a1a1a] px-4 py-3 rounded-2xl rounded-bl-md */}
        <View style={styles.typingBubble}>
          <View style={styles.typingDots}>
            <FadingDot delay={0} dotStyle={styles.typingDot} />
            <FadingDot delay={200} dotStyle={styles.typingDot} />
            <FadingDot delay={400} dotStyle={styles.typingDot} />
          </View>
        </View>
      </View>
    );
  };

  if (!groupId) return null;

  if (!currentGroup) {
    return (
      <ChatScreenShell>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
          <Text style={styles.loadingText}>טוען...</Text>
        </View>
      </ChatScreenShell>
    );
  }

  const chatMainColumn = (
    <View style={{ flex: 1 }}>
      {/* Safe area top spacer + Header */}
      <View style={{ paddingTop: insets.top + 4, paddingBottom: 2 }}>
        {renderHeader()}
      </View>

      {(realtimeConnectionState === 'reconnecting' || realtimeConnectionState === 'offline') && (
        <View style={styles.connectionBanner}>
          {realtimeConnectionState === 'reconnecting' ? (
            <ActivityIndicator size="small" color="#fff" style={{ marginRight: 6 }} />
          ) : null}
          <Text style={styles.connectionBannerText}>
            {realtimeConnectionState === 'reconnecting'
              ? 'מתחבר מחדש לצ׳אט...'
              : 'אין חיבור בזמן אמת. הודעות חדשות יופיעו כשיחזור החיבור.'}
          </Text>
        </View>
      )}

      {/* Messages area — minHeight:0 נדרש כדי שה-FlatList יקבל גלילה אמיתית בתוך עמודת flex */}
      <View style={styles.messagesAreaFlex}>
        <FlatList
          ref={flatListRef}
          data={messages}
          inverted
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          extraData={flatListExtraData}
          removeClippedSubviews={Platform.OS === 'android'}
          // Inverted: "end" of data = oldest messages = user scrolled to the top.
          // Guard: only fire after initial render is settled (prevents spurious
          // load on mount before scrollToBottom(false) corrects the position).
          onEndReached={() => {
            if (hasInitiallyRenderedRef.current) loadMoreMessages();
          }}
          onEndReachedThreshold={0.3}
          // ListFooterComponent appears at the visual TOP (oldest end) in inverted list
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          scrollEnabled={true}
          bounces={true}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          initialNumToRender={20}
          maxToRenderPerBatch={10}
          windowSize={11}
          updateCellsBatchingPeriod={50}
          contentContainerStyle={[
            messages.length === 0 ? styles.emptyList : styles.messagesList,
            { paddingTop: 8, paddingBottom: 12 },
          ]}
          showsVerticalScrollIndicator
          nestedScrollEnabled={Platform.OS === 'android'}
          style={styles.flatListTransparent}
          scrollEventThrottle={16}
          onScroll={handleScroll}
          onScrollToIndexFailed={(info) => {
            if (!isMountedRef.current) return;
            logger.warn('ChatGroupScreen', `onScrollToIndexFailed index=${info.index} avg=${info.averageItemLength?.toFixed(0)}`);
            // Scroll to estimated offset immediately, then retry the index scroll
            // once the FlatList has measured more items.
            const offset = info.index * (info.averageItemLength || averageItemHeight);
            flatListRef.current?.scrollToOffset({ offset, animated: false });
            setTimeout(() => {
              if (!isMountedRef.current) return;
              try {
                flatListRef.current?.scrollToIndex({
                  index: info.index,
                  animated: true,
                  viewPosition: 0.5,
                });
              } catch { /* give up gracefully */ }
            }, 150);
          }}
        />

      </View>

      {/* Input area */}
      <View style={styles.inputArea}>
        {/* Typing indicator - מעל ה-input */}
        {typingUsers.length > 0 && renderTypingIndicator()}
        {/* בדיקה אם זו קבוצת הכרזות ואם המשתמש לא admin */}
        {isAnnouncementGroup && !currentGroup?.is_admin ? (
          <View style={[styles.announcementOnlyView, { paddingBottom: 14 + insets.bottom }]}>
            <Ionicons name="megaphone-outline" size={18} color={DesignTokens.colors.text.tertiary} />
            <Text style={styles.announcementOnlyText}>
              רק מנהלי הקהילה יכולים לכתוב בצ'אט זה
            </Text>
          </View>
        ) : (
          <ChatInput
            groupId={groupId}
            onSendMessage={handleSendMessage}
            onTyping={handleTyping}
            replyTo={replyTo}
            onCancelReply={handleCancelReply}
            disabled={isSendingMessage}
          />
        )}
      </View>

    </View>
  );

  return (
    <ChatScreenShell>
      {/*
        KEYBOARD: `translate-with-padding` is the recommended `behavior` for
        chat screens per react-native-keyboard-controller's docs. It moves
        the view up using a Reanimated transform AND applies a one-shot
        paddingTop — the cheapest possible animation path, identical on
        iOS and Android. Compared to the old `padding` mode it eliminates
        the per-frame layout pass that caused the input area to feel
        "rubber-banded" while the keyboard slid in.
      */}
      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 6 : 0}
        style={{ flex: 1, backgroundColor: 'transparent' }}
      >
        {chatMainColumn}
      </KeyboardAvoidingView>

      {/* Modals - outside KeyboardAvoidingView */}
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

      {/* Scroll-to-bottom FAB — outside KAV so it never shifts with keyboard */}
      <RNAnimated.View
        pointerEvents={showScrollToBottomButton ? 'auto' : 'none'}
        style={[
          styles.scrollToBottomButton,
          { bottom: Math.max(72, insets.bottom + 66), opacity: scrollBtnOpacity },
        ]}
      >
        <Pressable
          onPress={() => scrollToBottom(true)}
          hitSlop={14}
          style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}
        >
          <Ionicons name="chevron-down" size={20} color="#fff" />
          {(initialUnreadInfo?.count ?? 0) > 0 && (
            <View style={styles.scrollBadge} pointerEvents="none">
              <Text style={styles.scrollBadgeText}>
                {initialUnreadInfo!.count > 99 ? '99+' : initialUnreadInfo!.count}
              </Text>
            </View>
          )}
        </Pressable>
      </RNAnimated.View>

      <ChatSearchBottomSheet
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        groupId={groupId}
        onMessagePress={handleJumpToMessage}
      />

      {/* Edit Message Modal – תואם לעיצוב האפליקציה */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: DesignTokens.colors.background.overlay || 'rgba(0,0,0,0.75)',
        }}>
          <View style={{
            backgroundColor: DesignTokens.colors.background.elevated2 || DesignTokens.colors.background.tertiary,
            borderRadius: 16,
            padding: 20,
            width: '85%',
            maxWidth: 400,
            borderWidth: 1,
            borderColor: DesignTokens.colors.border?.primary || 'rgba(255,255,255,0.08)',
          }}>
            <Text style={{
              color: DesignTokens.colors.text.primary,
              fontSize: 18,
              fontWeight: '700',
              marginBottom: 12,
              textAlign: 'right',
            }}>
              ערוך הודעה
            </Text>
            <TextInput
              value={editModalText}
              onChangeText={setEditModalText}
              placeholderTextColor={DesignTokens.colors.text.tertiary}
              style={{
                backgroundColor: DesignTokens.colors.background.primary,
                color: DesignTokens.colors.text.primary,
                borderRadius: 12,
                padding: 14,
                fontSize: 16,
                minHeight: 60,
                textAlignVertical: 'top',
                textAlign: 'right',
                borderWidth: 1,
                borderColor: DesignTokens.colors.border?.main || 'rgba(255,255,255,0.12)',
              }}
              multiline
              autoFocus
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-start', marginTop: 16, gap: 12 }}>
              <TouchableOpacity
                onPress={handleEditConfirm}
                style={{
                  backgroundColor: DesignTokens.colors.primary.main,
                  borderRadius: 12,
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>שמור</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                style={{
                  backgroundColor: (DesignTokens.colors.background as any).surface || 'rgba(255,255,255,0.1)',
                  borderRadius: 12,
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  borderWidth: 1,
                  borderColor: DesignTokens.colors.border?.primary || 'rgba(255,255,255,0.12)',
                }}
              >
                <Text style={{
                  color: DesignTokens.colors.text.secondary,
                  fontWeight: '600',
                  fontSize: 15,
                }}>
                  ביטול
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ChatScreenShell>
  );
}

// ============================================
// Bouncing Dot Component for Typing Indicator
// ============================================

const FadingDot = React.memo(({ delay, dotStyle }: { delay: number; dotStyle: ViewStyle }) => {
  const fadeAnim = useRef(new RNAnimated.Value(0.2)).current;

  useEffect(() => {
    const animation = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        RNAnimated.timing(fadeAnim, {
          toValue: 0.2,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    // Start with a delay
    const timeout = setTimeout(() => {
      animation.start();
    }, delay);

    return () => {
      clearTimeout(timeout);
      animation.stop();
    };
  }, [delay]);

  return (
    <RNAnimated.View
      style={[
        dotStyle,
        { opacity: fadeAnim }
      ]}
    />
  );
});

// ============================================
// Styles - Exact Design from Reference
// ============================================

const HP = 20;

const createChatGroupStyles = (tokens: any) => StyleSheet.create({
  /* ── Header — UICard glass כמו כרטיסיות בפרטי קבוצה ── */
  headerGlassOuter: {
    marginHorizontal: 10,
    borderRadius: 34,
  },
  headerBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    /** מנע כפל RTL מול forceRTL — כפתורים ותמונה בסדר צפוי */
    direction: 'ltr',
    paddingHorizontal: 12,
    paddingTop: 9,
    paddingBottom: 9,
    minHeight: 58,
  },
  backButton: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  headerBackIconFlip: {
    transform: [{ scaleX: -1 }],
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 8,
    minWidth: 0,
    direction: 'ltr',
  },
  avatarContainer: {
    position: 'relative',
  },
  headerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  headerAvatarPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: tokens.colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: tokens.colors.success.main,
    borderWidth: 2,
    borderColor: tokens.colors.background.primary,
  },
  headerTextWrap: {
    flex: 1,
    minWidth: 0,
    alignItems: 'stretch',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.text.primary,
    letterSpacing: -0.2,
    textAlign: 'right',
    width: '100%',
  },
  headerSubtitle: {
    fontSize: 12,
    color: tokens.colors.text.tertiary,
    marginTop: 1,
    textAlign: 'right',
    width: '100%',
  },
  searchButton: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  /* ── Connection banner ── */
  connectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239,68,68,0.85)',
    paddingVertical: 6,
    marginHorizontal: HP,
    marginVertical: 4,
    borderRadius: 10,
  },
  connectionBannerText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },

  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  /** עמודת flex עם minHeight:0 — בלי זה FlatList לעיתים לא מגלגל ו-scrollToBottom לא משפיע */
  messagesAreaFlex: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  flatListTransparent: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  messagesList: {
    paddingHorizontal: 10,
    paddingVertical: 0,
  },

  /* ── Date divider ── */
  dateDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    paddingHorizontal: 8,
  },
  dateDividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  dateDividerBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 14,
    marginHorizontal: 10,
  },
  dateDividerText: {
    fontSize: 12,
    fontWeight: '500',
    color: tokens.colors.text.secondary,
    textAlign: 'center',
  },

  /* ── Empty state ── */
  emptyList: { flex: 1 },
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

  /* ── Typing indicator ── */
  typingIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingVertical: 6,
    gap: 8,
  },
  typingAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  typingAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: tokens.colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typingBubble: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderBottomRightRadius: 6,
  },
  typingDots: {
    flexDirection: 'row',
    gap: 4,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: tokens.colors.text.tertiary,
  },

  /* ── Input area ── */
  inputArea: {
    paddingHorizontal: 10,
    paddingTop: 4,
    paddingBottom: 6,
    backgroundColor: 'transparent',
    borderTopWidth: 0,
  },

  /* ── Scroll to bottom ── */
  scrollToBottomButton: {
    position: 'absolute',
    right: 10,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,200,5,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: tokens.colors.primary.main,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 1000,
  },
  scrollBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: tokens.colors.danger.main,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  scrollBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },

  /* ── Loading ── */
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
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

  /* ── Announcement only ── */
  announcementOnlyView: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  announcementOnlyText: {
    fontSize: 14,
    color: tokens.colors.text.tertiary,
    textAlign: 'center',
  },
});
