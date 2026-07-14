// ============================================
// Chat Group Screen - Modern Design (from reference)
// ============================================

import { legacyAlert } from '../../utils/appDialog';
import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { View, FlatList, Text, StyleSheet, type ViewStyle, type DimensionValue, TouchableOpacity, ActivityIndicator, Image, Modal, TextInput, Animated as RNAnimated, Easing, Platform, LayoutChangeEvent, InteractionManager } from 'react-native';
import { chatComposerSafeBottomInset, chatComposerKeyboardTranslate, CHAT_COMPOSER_KEYBOARD_GAP } from '../../components/chat/chatInputLayout';
import { ChatComposerDock } from '../../components/chat/ChatComposerDock';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChatKeyboardInsets } from '../../hooks/useChatKeyboardInsets';
import Reanimated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useGenericKeyboardHandler } from 'react-native-keyboard-controller';

import { ChatScreenShell } from '../../components/chat/ChatScreenShell';
import UICard from '../../components/ui/UICard';
import { MAIN_SCREEN_HEADER_HP } from '../../components/ui/MainDrawerScreenHeader';
import { useDesignTokens } from '../../components/ui/DesignTokens';

import { useChat, useChatActions } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useLockParentDrawerWhileFocused } from '../../hooks/useLockParentDrawerWhileFocused';
import ChatInput from '../../components/chat/ChatInput';

import ReactionPicker from '../../components/chat/ReactionPicker';
import ReactionDetailsModal from '../../components/chat/ReactionDetailsModal';
import ForwardMessageModal from '../../components/chat/ForwardMessageModal';
import ChatListRow from '../../components/chat/ChatListRow';
import LongPressOverlay from '../../components/chat/LongPressOverlay';
import ChatSearchBottomSheet from '../../components/chat/ChatSearchBottomSheet';
import PinnedMessagesHeader from '../../components/chat/PinnedMessagesHeader';
import SeenBySheet from '../../components/chat/SeenBySheet';
import { pinChatMessage } from '../../services/chat/chatPinnedService';
import { MessageSnapshot } from '../../types/MessageSnapshot';
import { ChatMessage as ChatMessageType, ChatMessageType as MessageType } from '../../types/chat.types';
import { Ionicons } from '@expo/vector-icons';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { he } from 'date-fns/locale';
import { logger } from '../../utils/logger';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { useChatMessageScroll } from '../../hooks/useChatMessageScroll';
import {
  scrollChatListToBottom,
} from '../../utils/chatListScrollToBottom';

// ── Skeleton bubble — shown while messages are loading ──────────────────────
const SkeletonBubble = React.memo(({ isMe, width, delay }: { isMe: boolean; width: DimensionValue; delay: number }) => {
  const opacity = useRef(new RNAnimated.Value(0.35)).current;
  useEffect(() => {
    const anim = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(opacity, { toValue: 0.7, duration: 700, useNativeDriver: true }),
        RNAnimated.timing(opacity, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ])
    );
    const t = setTimeout(() => anim.start(), delay);
    return () => { clearTimeout(t); anim.stop(); };
  }, []);
  return (
    <View style={{ flexDirection: 'row', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: 6 }}>
      {!isMe && <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', marginRight: 6, alignSelf: 'flex-end' }} />}
      <RNAnimated.View style={{
        width, height: 36, borderRadius: 14, opacity,
        backgroundColor: isMe ? 'rgba(19,77,55,0.5)' : 'rgba(36,38,37,0.5)',
      }} />
    </View>
  );
});

export default function ChatGroupScreen() {
  const DesignTokens = useDesignTokens();
  const styles = useMemo(() => createChatGroupStyles(DesignTokens), [DesignTokens]);
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [composerHeight, setComposerHeight] = useState(72);
  // דחיית רינדור רשימת ההודעות הכבדה עד אחרי אנימציית הניווט (כמו WhatsApp):
  // המסך (כותרת+קומפוזר+סקלטון) נכנס מיד וחלק, וההודעות מרונדרות רגע אחרי.
  const [messagesListReady, setMessagesListReady] = useState(false);
  // הרשימה מרונדרת שקופה (opacity:0) מעל הסקלטון, ונחשפת רק אחרי שהיא כבר
  // ממוקמת בתחתית — כך אין "קפיצת התמקמות" גלויה בכניסה (ההתמקמות קורית מאחורי הסקלטון).
  const [messagesRevealed, setMessagesRevealed] = useState(false);
  const messagesRevealedRef = useRef(false);
  const listOpacity = useRef(new RNAnimated.Value(0)).current;
  const onComposerLayout = useCallback((event: LayoutChangeEvent) => {
    const h = event.nativeEvent.layout.height;
    if (h > 0 && Math.abs(h - composerHeight) > 2) {
      setComposerHeight(h);
    }
  }, [composerHeight]);
  useLockParentDrawerWhileFocused();

  const listRef = useRef<FlatList<ChatMessageType>>(null);
  const listLayoutReadyRef = useRef(false);
  const verboseScrollLogUntilRef = useRef(0);
  const loadMoreLockRef = useRef(false);
  const scrollYRef = useRef(0);
  const distFromBottomRef = useRef(0);
  const scrollEpochRef = useRef(0);
  const maxScrollOffsetRef = useRef(0);
  const layoutHeightRef = useRef(0);
  const contentHeightRef = useRef(0);
  const endReachedReadyRef = useRef(false);
  const userScrolledUpRef = useRef(false);
  const endReachedMomentumRef = useRef(true);
  const programmaticScrollRef = useRef(false);
  const ignoreFabUntilRef = useRef(0);
  /** חוסם גלילה אוטומטית ל-lastRead אחרי FAB / גלילה ידנית לתחתית */
  const blockUnreadAutoScrollUntilRef = useRef(0);
  const unreadAutoScrollAppliedForGroupRef = useRef<string | null>(null);
  const initialScrollInFlightRef = useRef(false);
  const loadingLastReadForInitialRef = useRef(false);
  /** גלילה לתחתית אחרי שליחה — גם כשאורך הרשימה לא משתנה (עדכון אופטימיסטי) */
  const pendingScrollAfterSendRef = useRef(false);
  /** נשאר true אחרי גלילה לתחתית — מחזיק offset=0 גם כשגודל התוכן משתנה */
  const pinScrollToBottomRef = useRef(false);
  const pinScrollClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentSizePinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readConfirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoScrollRafRef = useRef<number | null>(null);

  const { groupId = '', scrollToMessageId } = (route.params || {}) as { groupId: string; scrollToMessageId?: string };

  const { selectGroup, refreshCurrentGroupDetails, confirmChatReadAtBottom } = useChatActions();

  const {
    currentGroup,
    messages,
    typingUsers,
    isLoadingMessages,
    realtimeConnectionState,
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
    retrySendMessage,
  } = useChat();

  const initialUnreadInfoRef = useRef(initialUnreadInfo);

  // בדיקה אם זו קבוצת הכרזות
  const isAnnouncementGroup = useMemo(() => {
    if (!currentGroup?.name) return false;
    const lowerName = currentGroup.name.toLowerCase();
    return lowerName.includes('הכרזות') || lowerName.includes('announcement');
  }, [currentGroup?.name]);

  // Context + FlatList inverted: messages[0]=חדש בתחתית המסך
  const hasInitiallyRenderedRef = useRef(false);
  const initialScrollDoneRef = useRef(false);
  const prevGroupIdRef = useRef<string | null>(null);
  const isAtBottomRef = useRef(true);
  const isSendingRef = useRef(false);
  const lastScrollLogRef = useRef(0);
  const showScrollBtnRef = useRef(false);

  /** FlatList inverted: offsetY=0 ≈ תחתית (הודעות חדשות), distFromBottom = offsetY */
  const SCROLL_AT_BOTTOM_PX = 80;
  const SCROLL_SHOW_FAB_PX = 120;
  /** קרוב לראש הרשימה הוויזואלי (הודעות ישנות) לפני loadMore */
  const LOAD_MORE_TOP_OFFSET_PX = 180;

  /** כמו ב-Context: [0]=חדש; inverted מציג ישן למעלה, חדש למטה */
  const displayMessages = messages;

  const listScrollRefs = useMemo(
    () => ({
      listRef,
      contentHeightRef,
      layoutHeightRef,
      getDistFromBottom: () => distFromBottomRef.current,
      getScrollEpoch: () => scrollEpochRef.current,
    }),
    [],
  );

  const canLoadOlderMessages = useCallback(() => {
    if (
      !endReachedReadyRef.current ||
      programmaticScrollRef.current ||
      pinScrollToBottomRef.current ||
      loadMoreLockRef.current
    ) {
      return false;
    }
    if (!initialScrollDoneRef.current) return false;
    if (!userScrolledUpRef.current) return false;
    const max = maxScrollOffsetRef.current;
    if (max <= 0) return false;
    return scrollYRef.current >= max - LOAD_MORE_TOP_OFFSET_PX;
  }, []);

  const handleLoadMore = useCallback(() => {
    if (!canLoadOlderMessages()) return;
    loadMoreLockRef.current = true;
    const wasPinnedBottom = pinScrollToBottomRef.current;
    logger.info('ChatGroupScreen', `loadMoreMessages triggered dist=${distFromBottomRef.current.toFixed(0)}`);
    void loadMoreMessages().finally(() => {
      setTimeout(() => {
        loadMoreLockRef.current = false;
        if (wasPinnedBottom || isAtBottomRef.current) {
          applyScrollToBottomRef.current?.(false);
        }
      }, 600);
    });
  }, [loadMoreMessages, canLoadOlderMessages]);

  const applyScrollMetrics = useCallback((event?: {
    nativeEvent?: {
      contentOffset?: { y?: number };
      contentSize?: { height?: number };
      layoutMeasurement?: { height?: number };
    };
  }) => {
    const native = event?.nativeEvent;
    const rawOffsetY = native?.contentOffset?.y ?? scrollYRef.current;
    const contentH = native?.contentSize?.height ?? contentHeightRef.current;
    const layoutH = native?.layoutMeasurement?.height ?? layoutHeightRef.current;
    if (layoutH > 0) layoutHeightRef.current = layoutH;
    if (contentH > 0) contentHeightRef.current = contentH;

    const maxOffset = Math.max(0, contentH - layoutH);
    maxScrollOffsetRef.current = maxOffset;
    const offsetY = Math.max(0, Math.min(rawOffsetY, maxOffset));
    scrollYRef.current = offsetY;
    const distFromBottom = offsetY;
    distFromBottomRef.current = distFromBottom;
    scrollEpochRef.current += 1;

    const atBottom = distFromBottom <= SCROLL_AT_BOTTOM_PX;
    isAtBottomRef.current = atBottom;
    if (atBottom) {
      programmaticScrollRef.current = false;
      userScrolledUpRef.current = false;
      hasInitiallyRenderedRef.current = true;
      if (!initialScrollDoneRef.current) {
        initialScrollDoneRef.current = true;
      }
      if (pendingScrollAfterSendRef.current) {
        pendingScrollAfterSendRef.current = false;
      }
      if (initialUnreadInfoRef.current?.count && !readConfirmTimerRef.current) {
        readConfirmTimerRef.current = setTimeout(() => {
          readConfirmTimerRef.current = null;
          if (isAtBottomRef.current) {
            void confirmReadRef.current();
          }
        }, 700);
      }
    } else if (
      initialScrollDoneRef.current &&
      distFromBottom > SCROLL_SHOW_FAB_PX + 60
    ) {
      // רק אחרי גלילה ראשונה לתחתית — מונע loadMore/FAB שגוי בפתיחה (offsetY=0)
      userScrolledUpRef.current = true;
      if (!programmaticScrollRef.current) {
        pinScrollToBottomRef.current = false;
      }
    }

    return { distFromBottom, atBottom, offsetY };
  }, []);

  const syncScrollFab = useCallback((event?: {
    nativeEvent?: {
      contentOffset?: { y?: number };
      contentSize?: { height?: number };
      layoutMeasurement?: { height?: number };
    };
  }) => {
    const { distFromBottom, atBottom, offsetY } = applyScrollMetrics(event);
    const shouldShow = distFromBottom > SCROLL_SHOW_FAB_PX;

    const now = Date.now();
    if (now - lastScrollLogRef.current > 800) {
      lastScrollLogRef.current = now;
      logger.debug(
        'ChatGroupScreen',
        `onScroll offsetY=${offsetY.toFixed(0)} distBottom=${distFromBottom.toFixed(0)} atBottom=${atBottom}`,
      );
    }

    // רק FAB — לא לחסום עדכון metrics (distFromBottomRef)
    if (Date.now() < ignoreFabUntilRef.current) return;

    if (shouldShow !== showScrollBtnRef.current) {
      showScrollBtnRef.current = shouldShow;
      setShowScrollToBottomButton(shouldShow);
      logger.info(
        'ChatGroupScreen',
        `scrollFab ${shouldShow ? 'show' : 'hide'} dist=${distFromBottom.toFixed(0)}`,
      );
    }
  }, [applyScrollMetrics]);

  const handleScroll = useCallback((event: any) => {
    const metrics = applyScrollMetrics(event);

    const shouldShow = metrics.distFromBottom > SCROLL_SHOW_FAB_PX;
    const now = Date.now();
    const forceLog = now < verboseScrollLogUntilRef.current;
    if (forceLog || now - lastScrollLogRef.current > 800) {
      lastScrollLogRef.current = now;
      const logFn = forceLog ? logger.info.bind(logger) : logger.debug.bind(logger);
      logFn(
        'ChatGroupScreen',
        `onScroll offsetY=${metrics.offsetY.toFixed(0)} distBottom=${metrics.distFromBottom.toFixed(0)} atBottom=${metrics.atBottom}`,
      );
    }

    if (Date.now() < ignoreFabUntilRef.current) return;

    if (shouldShow !== showScrollBtnRef.current) {
      showScrollBtnRef.current = shouldShow;
      setShowScrollToBottomButton(shouldShow);
      logger.info(
        'ChatGroupScreen',
        `scrollFab ${shouldShow ? 'show' : 'hide'} dist=${metrics.distFromBottom.toFixed(0)}`,
      );
    }
  }, [applyScrollMetrics, listScrollRefs]);

  const handleScrollEnd = useCallback((event: any) => {
    syncScrollFab(event);
  }, [syncScrollFab]);

  // FlatList flip: offset 0 = הודעות חדשות
  const prevMessagesLengthRef = useRef(0);

  const [replyTo, setReplyTo] = useState<{
    id: string;
    senderName: string;
    content: string;
  } | undefined>();

  const [reactionPickerVisible, setReactionPickerVisible] = useState(false);
  const [selectedMessageForReaction, setSelectedMessageForReaction] = useState<ChatMessageType | null>(null);
  const [reactionDetailsModalVisible, setReactionDetailsModalVisible] = useState(false);
  const [selectedMessageForDetails, setSelectedMessageForDetails] = useState<ChatMessageType | null>(null);
  const [forwardModalVisible, setForwardModalVisible] = useState(false);
  const [selectedMessageForForward, setSelectedMessageForForward] = useState<ChatMessageType | null>(null);
  const [showScrollToBottomButton, setShowScrollToBottomButton] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  // Stable extraData object — only changes when visible UX state changes
  const flatListExtraData = useMemo(
    () => ({
    h: highlightedMessageId,
      u: initialUnreadInfo?.count ?? 0,
      ur: initialUnreadInfo?.lastReadMessageId ?? '',
    }),
    [highlightedMessageId, initialUnreadInfo?.count, initialUnreadInfo?.lastReadMessageId],
  );

  useEffect(() => {
    initialUnreadInfoRef.current = initialUnreadInfo;
  }, [initialUnreadInfo]);

  const confirmReadRef = useRef(confirmChatReadAtBottom);
  confirmReadRef.current = confirmChatReadAtBottom;
  const [longPressMessage, setLongPressMessage] = useState<MessageSnapshot | null>(null);
  const [searchVisible, setSearchVisible] = useState(false);
  const [seenByMessage, setSeenByMessage] = useState<ChatMessageType | null>(null);
  const [pinnedRefreshKey, setPinnedRefreshKey] = useState(0);

  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const messagesRef = useRef(messages);

  const {
    handleJumpToMessage,
    handleScrollToIndexFailed,
    handleContentSizeChange,
    onMessageCellLayout,
    scrollToMessageInView,
    queueScrollToMessage,
  } = useChatMessageScroll({
    listRef,
    messagesRef,
    contentHeightRef,
    layoutHeightRef,
    distFromBottomRef,
    programmaticScrollRef,
    isMountedRef,
    loadMessagesAround,
    onHighlight: setHighlightedMessageId,
    maxScrollOffsetRef,
  });

  const handleScrollToIndexFailedWithPin = useCallback(
    (info: { index: number; averageItemLength: number }) => {
      handleScrollToIndexFailed(info);
      const count = displayMessages.length;
      if (
        count > 0 &&
        (pinScrollToBottomRef.current || pendingScrollAfterSendRef.current) &&
        info.index <= 1 &&
        listRef.current
      ) {
        listRef.current.scrollToOffset({ offset: 0, animated: false });
      }
    },
    [displayMessages.length, handleScrollToIndexFailed],
  );

  const hideScrollFab = useCallback(() => {
    if (!showScrollBtnRef.current) return;
    showScrollBtnRef.current = false;
    setShowScrollToBottomButton(false);
  }, []);

  /** חושף את רשימת ההודעות (fade-in) — אחרי שהיא כבר ממוקמת. אידמפוטנטי. */
  const revealMessages = useCallback(() => {
    if (messagesRevealedRef.current) return;
    messagesRevealedRef.current = true;
    setMessagesRevealed(true);
    RNAnimated.timing(listOpacity, {
      toValue: 1,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [listOpacity]);

  /** חשיפה בפריים הבא-אחרי-הבא — מבטיח שה-scrollToOffset(0) כבר הוחל לפני שמראים */
  const requestRevealMessages = useCallback(() => {
    if (messagesRevealedRef.current) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => revealMessages());
    });
  }, [revealMessages]);

  const requestRevealMessagesRef = useRef(requestRevealMessages);
  requestRevealMessagesRef.current = requestRevealMessages;

  /** גלילה לתחתית — עם ניסיונות חוזרים עד שגובה התוכן מוכן */
  const applyScrollToBottom = useCallback((animated: boolean, markInitialDone = false) => {
    if (displayMessages.length === 0) return;

    pinScrollToBottomRef.current = true;
    programmaticScrollRef.current = true;
    userScrolledUpRef.current = false;
    const startDist = distFromBottomRef.current;
    scrollChatListToBottom(
      listScrollRefs,
      displayMessages.length,
      animated,
      maxScrollOffsetRef.current,
      {
        maxAttempts: 12,
        startDist,
        onDone: ({ maxOffset, reachedBottom }) => {
          if (maxOffset > 0) {
            maxScrollOffsetRef.current = maxOffset;
          }
          if (markInitialDone && reachedBottom) {
            initialScrollDoneRef.current = true;
          }
          // הרשימה כבר נחתה בתחתית — אפשר לחשוף אותה בלי קפיצה גלויה
          requestRevealMessagesRef.current();
        },
      },
    );

    if (pinScrollClearTimerRef.current) {
      clearTimeout(pinScrollClearTimerRef.current);
    }
    pinScrollClearTimerRef.current = setTimeout(() => {
      pinScrollToBottomRef.current = false;
      programmaticScrollRef.current = false;
      pinScrollClearTimerRef.current = null;
    }, 4500);
  }, [displayMessages.length, listScrollRefs]);

  const applyScrollToBottomRef = useRef(applyScrollToBottom);
  applyScrollToBottomRef.current = applyScrollToBottom;

  const onKeyboardShow = useCallback(() => {
    if (isAtBottomRef.current || pinScrollToBottomRef.current) {
      requestAnimationFrame(() => applyScrollToBottomRef.current?.(false));
    }
  }, []);
  const { keyboardShown } = useChatKeyboardInsets(onKeyboardShow);
  const composerPaddingBottom = useMemo(
    () => chatComposerSafeBottomInset(insets.bottom),
    [insets.bottom],
  );

  // מעקב רציף של הרשימה אחרי המקלדת ב-UI thread: אותו translate בדיוק כמו הקומפוזר
  // (chatComposerKeyboardTranslate עם אותו inset/gap), כך שתחתית הרשימה ההפוכה נשארת
  // צמודה לראש הקומפוזר בפתיחה ובסגירה — בלי ה-lag של אינסט מבוסס-state.
  // handler נפרד (keyboard-controller תומך בכמה) — לא נוגע בקומפוזר ולא ב-resize mode.
  const composerInsetSV = useSharedValue(composerPaddingBottom);
  useEffect(() => {
    composerInsetSV.value = composerPaddingBottom;
  }, [composerPaddingBottom, composerInsetSV]);

  const listFollowY = useSharedValue(0);
  useGenericKeyboardHandler(
    {
      onMove: (event) => {
        'worklet';
        listFollowY.value = chatComposerKeyboardTranslate(
          event.height,
          composerInsetSV.value,
          CHAT_COMPOSER_KEYBOARD_GAP,
        );
      },
      onEnd: (event) => {
        'worklet';
        listFollowY.value = chatComposerKeyboardTranslate(
          event.height,
          composerInsetSV.value,
          CHAT_COMPOSER_KEYBOARD_GAP,
        );
      },
    },
    [],
  );
  const listFollowStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      transform: [{ translateY: listFollowY.value }],
    };
  });

  /** תמיד גולל לתחתית כששולחים — גם אחרי פתיחה עם unread (לא בתחתית) */
  const scrollToBottomOnSend = useCallback(() => {
    pendingScrollAfterSendRef.current = true;
    pinScrollToBottomRef.current = true;
    userScrolledUpRef.current = false;
    isAtBottomRef.current = true;
    hideScrollFab();
    applyScrollToBottom(false);
  }, [applyScrollToBottom, hideScrollFab]);

  /**
   * פתיחת צ'אט (WhatsApp-style):
   * – יש unread + last_read → גלילה להודעה האחרונה שנקראה במרכז + מפריד
   * – אחרת → תחתית (הודעות אחרונות)
   */
  const applyInitialOpenScroll = useCallback(async () => {
    if (
      !groupId ||
      initialScrollDoneRef.current ||
      initialScrollInFlightRef.current ||
      !listLayoutReadyRef.current ||
      displayMessages.length === 0 ||
      scrollToMessageId
    ) {
      return;
    }
    if (Date.now() < blockUnreadAutoScrollUntilRef.current) return;
    if (unreadAutoScrollAppliedForGroupRef.current === groupId) return;

    const unreadCount = initialUnreadInfo?.count ?? 0;
    const lastReadId = initialUnreadInfo?.lastReadMessageId;

    if (unreadCount > 0 && lastReadId) {
      initialScrollInFlightRef.current = true;
      let index = displayMessages.findIndex((m) => m.id === lastReadId);

      if (index === -1 && !loadingLastReadForInitialRef.current) {
        loadingLastReadForInitialRef.current = true;
        const result = await loadMessagesAround(lastReadId);
        loadingLastReadForInitialRef.current = false;
        initialScrollInFlightRef.current = false;
        if (!result.success) {
          unreadAutoScrollAppliedForGroupRef.current = groupId;
          applyScrollToBottom(false);
          logger.debug('ChatGroupScreen', 'initial scroll to bottom (last read not found)');
        }
        return;
      }

      if (index === -1) {
        initialScrollInFlightRef.current = false;
        return;
      }

      unreadAutoScrollAppliedForGroupRef.current = groupId;
      pinScrollToBottomRef.current = false;
      programmaticScrollRef.current = true;
      ignoreFabUntilRef.current = Date.now() + 800;

      scrollToMessageInView(lastReadId, {
        viewPosition: 0.5,
        animated: false,
        highlight: false,
      });

      requestAnimationFrame(() => {
        queueScrollToMessage(lastReadId, false, {
          viewPosition: 0.5,
          highlight: false,
        });
      });

      initialScrollDoneRef.current = true;
      userScrolledUpRef.current = true;
      isAtBottomRef.current = false;
      initialScrollInFlightRef.current = false;

      showScrollBtnRef.current = true;
      setShowScrollToBottomButton(true);
      logger.debug(
        'ChatGroupScreen',
        `initial scroll to last read index=${index} unread=${unreadCount}`,
      );
      requestRevealMessages();
      return;
    }

    unreadAutoScrollAppliedForGroupRef.current = groupId;
    applyScrollToBottom(false, true);
    logger.debug('ChatGroupScreen', 'initial scroll to bottom');
  }, [
    groupId,
    displayMessages,
    initialUnreadInfo,
    scrollToMessageId,
    loadMessagesAround,
    applyScrollToBottom,
    scrollToMessageInView,
    queueScrollToMessage,
    requestRevealMessages,
  ]);

  const applyInitialOpenScrollRef = useRef(applyInitialOpenScroll);
  applyInitialOpenScrollRef.current = applyInitialOpenScroll;

  const scrollToBottom = useCallback((animated: boolean = true) => {
    const count = displayMessages.length;
    const list = listRef.current;
    const distBefore = distFromBottomRef.current;

    // לוג קשיח לדיבאג אצל המשתמש (dev console)
    console.log('[FAB_PRESS]', { distBefore, count, hasList: !!list, animated });
    logger.info(
      'ChatGroupScreen',
      `FAB_PRESS distBefore=${distBefore.toFixed(0)} count=${count} hasList=${!!list}`,
    );

    if (count === 0 || !list) return;

    pinScrollToBottomRef.current = true;
    programmaticScrollRef.current = true;
    userScrolledUpRef.current = false;
    pendingScrollAfterSendRef.current = false;
    ignoreFabUntilRef.current = Date.now() + 600;
    blockUnreadAutoScrollUntilRef.current = Date.now() + 5000;

    hideScrollFab();

    // ישיר ופשוט — בלי lock / epoch מורכב
    console.log('[SCROLL_CMD]', 'scrollToOffset(0)', { distBefore });
    try {
      list.scrollToOffset({ offset: 0, animated });
    } catch (e) {
      console.log('[SCROLL_CMD] threw', e);
    }

    const bump = (label: string) => {
      const l = listRef.current;
      if (!l) return;
      try {
        l.scrollToOffset({ offset: 0, animated: false });
      } catch {
        /* noop */
      }
      console.log('[SCROLL_RESULT]', label, {
        dist: distFromBottomRef.current,
        offsetY: scrollYRef.current,
      });
    };

    requestAnimationFrame(() => bump('raf'));
    setTimeout(() => bump('t50'), 50);
    setTimeout(() => bump('t150'), 150);
    setTimeout(() => bump('t350'), 350);

    scrollChatListToBottom(listScrollRefs, count, animated, undefined, {
      maxAttempts: 12,
      startDist: distBefore,
      onDone: ({ reachedBottom }) => {
        const distAfter = distFromBottomRef.current;
        console.log('[SCROLL_RESULT] done', { reachedBottom, distBefore, distAfter });
        logger.info(
          'ChatGroupScreen',
          `SCROLL_RESULT done reached=${reachedBottom} distBefore=${distBefore.toFixed(0)} distAfter=${distAfter.toFixed(0)}`,
        );
        if (reachedBottom || distAfter <= SCROLL_AT_BOTTOM_PX) {
          scrollYRef.current = 0;
          distFromBottomRef.current = 0;
          isAtBottomRef.current = true;
          hideScrollFab();
          void confirmChatReadAtBottom();
        } else {
          showScrollBtnRef.current = true;
          setShowScrollToBottomButton(true);
        }
      },
    });

    if (pinScrollClearTimerRef.current) {
      clearTimeout(pinScrollClearTimerRef.current);
    }
    pinScrollClearTimerRef.current = setTimeout(() => {
      pinScrollToBottomRef.current = false;
      programmaticScrollRef.current = false;
      pinScrollClearTimerRef.current = null;
    }, 4000);
  }, [confirmChatReadAtBottom, displayMessages.length, hideScrollFab, listScrollRefs]);

  useEffect(() => {
    const newLength = messages.length;
    const prevLength = prevMessagesLengthRef.current;
    prevMessagesLengthRef.current = newLength;

    const sending = isSendingRef.current || pendingScrollAfterSendRef.current;
    if (newLength > 0 && !initialScrollDoneRef.current && !sending) {
      return;
    }

    const isNewMessage = newLength > prevLength && newLength - prevLength <= 3;
    const shouldScroll = sending || isAtBottomRef.current;

    if (shouldScroll && (isNewMessage || sending)) {
      if (autoScrollRafRef.current != null) {
        cancelAnimationFrame(autoScrollRafRef.current);
      }
      autoScrollRafRef.current = requestAnimationFrame(() => {
        autoScrollRafRef.current = null;
        applyScrollToBottom(false);
      });
    }
  }, [messages.length, messages[0]?.id, applyScrollToBottom]);

  // סנכרון בזמן render (לא ב-useEffect) — renderItem קורא ל-neighbors לפני ה-effect
  messagesRef.current = displayMessages;

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
      if (pinScrollClearTimerRef.current) {
        clearTimeout(pinScrollClearTimerRef.current);
        pinScrollClearTimerRef.current = null;
      }
      if (contentSizePinTimerRef.current) {
        clearTimeout(contentSizePinTimerRef.current);
        contentSizePinTimerRef.current = null;
      }
      if (readConfirmTimerRef.current) {
        clearTimeout(readConfirmTimerRef.current);
        readConfirmTimerRef.current = null;
      }
      if (autoScrollRafRef.current != null) {
        cancelAnimationFrame(autoScrollRafRef.current);
        autoScrollRafRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!groupId) return;

    const isNewGroup = prevGroupIdRef.current !== groupId;
    prevGroupIdRef.current = groupId;

    void selectGroup(groupId);

    if (!isNewGroup) return;

      hasInitiallyRenderedRef.current = false;
    initialScrollDoneRef.current = false;
    endReachedReadyRef.current = false;
    userScrolledUpRef.current = false;
    endReachedMomentumRef.current = true;
    programmaticScrollRef.current = false;
      prevMessagesLengthRef.current = 0;
    scrollYRef.current = 0;
    distFromBottomRef.current = 0;
    maxScrollOffsetRef.current = 0;
    layoutHeightRef.current = 0;
    contentHeightRef.current = 0;
    showScrollBtnRef.current = false;
    setShowScrollToBottomButton(false);
    blockUnreadAutoScrollUntilRef.current = 0;
    unreadAutoScrollAppliedForGroupRef.current = null;
    initialScrollInFlightRef.current = false;
    loadingLastReadForInitialRef.current = false;
    pendingScrollAfterSendRef.current = false;
    pinScrollToBottomRef.current = false;

    const t = setTimeout(() => {
      endReachedReadyRef.current = true;
    }, 800);
    return () => clearTimeout(t);
  }, [groupId, selectGroup]);

  // דחיית רינדור ההודעות עד שאנימציית הניווט מסתיימת — מונע jank בכניסה.
  useEffect(() => {
    setMessagesListReady(false);
    setMessagesRevealed(false);
    messagesRevealedRef.current = false;
    listOpacity.setValue(0);
    const handle = InteractionManager.runAfterInteractions(() => {
      setMessagesListReady(true);
    });
    // fallback — מבטיח שההודעות יופיעו גם אם ה-interactions מתעכבים (לא נתקע על סקלטון)
    const fallback = setTimeout(() => setMessagesListReady(true), 400);
    return () => {
      handle.cancel();
      clearTimeout(fallback);
    };
  }, [groupId, listOpacity]);

  // גיבוי לחשיפת הרשימה — אם ה-callback של הגלילה לא נורה (רשימה ריקה / נתיב pin).
  // מונע מצב של "סקלטון תקוע" כשהרשימה כבר ממוקמת אך לא נחשפה.
  useEffect(() => {
    if (!messagesListReady || messagesRevealedRef.current) return;
    if (displayMessages.length === 0) {
      if (!isLoadingMessages) revealMessages();
      return;
    }
    const t = setTimeout(() => revealMessages(), 500);
    return () => clearTimeout(t);
  }, [messagesListReady, displayMessages.length, isLoadingMessages, revealMessages]);

  // Auto-navigate to groups list when removed from group by an admin.
  // ChatContext clears currentGroup when membership DELETE event fires.
  // חשוב: מנווטים חזרה רק אם הקבוצה *נטענה בעבר* ואז נוקתה — אחרת ב-mount הראשון
  // (לפני ש-selectGroup האסינכרוני מספיק לעדכן) currentGroup=null וזה היה בועט החוצה
  // את הכניסה הראשונה (הבאג של "צריך ללחוץ פעמיים").
  const everHadGroupRef = useRef(false);
  useEffect(() => {
    if (currentGroup) {
      everHadGroupRef.current = true;
    }
  }, [currentGroup]);
  useEffect(() => {
    everHadGroupRef.current = false;
  }, [groupId]);
  useEffect(() => {
    if (!groupId) return;
    if (everHadGroupRef.current && currentGroup === null && !isLoadingMessages) {
      // Group was cleared after being loaded — we were removed → go back to groups list
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
      if (messagesRef.current.length > 0) {
        void refreshCurrentGroupDetails();
      } else {
        void selectGroup(groupId);
      }
    }, [groupId, user, selectGroup, refreshCurrentGroupDetails]),
  );

  useEffect(() => {
    if (scrollToMessageId && messages.length > 0) {
      const timer = setTimeout(() => handleJumpToMessage(scrollToMessageId), 400);
      return () => clearTimeout(timer);
    }
  }, [scrollToMessageId, handleJumpToMessage]);

  // ============================================
  // Handlers
  // ============================================

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
    scrollToBottomOnSend();

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
      scrollToBottomOnSend();
    } catch (e) {
      logger.error('ChatGroupScreen', 'Send message error', e);
    } finally {
      setTimeout(() => { isSendingRef.current = false; }, 500);
    }
  }, [groupId, replyTo?.id, sendMessage, scrollToBottomOnSend]);

  const handleTyping = useCallback((isTyping: boolean) => {
    if (groupId) {
      setTyping(groupId, isTyping);
    }
  }, [groupId, setTyping]);

  const handleMessageLongPress = useCallback((message: ChatMessageType) => {
    void HapticFeedback.medium();
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
        case 'info':
          handleMessageInfo(message);
          break;
        case 'retry':
          void retrySendMessage(message.id);
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
      const { success, error } = await pinChatMessage(groupId, message.id, user.id);
      if (!success) {
        legacyAlert('שגיאה', error || 'לא ניתן להצמיד את ההודעה');
      } else {
        void HapticFeedback.impactLight();
        setPinnedRefreshKey((k) => k + 1);
      }
    } catch {
      legacyAlert('שגיאה', 'שגיאה בהצמדת ההודעה');
    }
  };

  const handleMessageInfo = useCallback((message: ChatMessageType) => {
    if (message.id.startsWith('temp-')) return;
    setSeenByMessage(message);
  }, []);

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

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
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

    const headerSideButton = (opts: {
      icon: keyof typeof Ionicons.glyphMap;
      label: string;
      onPress: () => void;
      flip?: boolean;
    }) => (
      <UICard
        variant="glass"
        glassIntensity="light"
        padding="none"
        onPress={opts.onPress}
        accessibilityLabel={opts.label}
        style={styles.headerSideGlass}
        contentContainerStyle={styles.headerSideGlassInner}
      >
        <View style={opts.flip ? styles.headerBackIconFlip : undefined}>
          <Ionicons name={opts.icon} size={20} color={DesignTokens.colors.text.primary} />
        </View>
      </UICard>
    );

    const typingLabel =
      typingUsers.length > 0
        ? `${typingUsers[0]?.user?.display_name || 'מישהו'} מקליד...`
        : null;

    const center = (
      <TouchableOpacity style={styles.headerContent} onPress={handleGroupInfoPress} activeOpacity={0.7}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {currentGroup.name}
          </Text>
          {typingLabel ? (
          <Text style={styles.headerSubtitle} numberOfLines={1}>
              {typingLabel}
          </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );

    return (
      <View style={styles.headerOuterRow}>
        <View style={styles.headerSideMarginStart}>
          {headerSideButton({
            icon: 'chevron-back',
            label: 'חזרה',
            onPress: handleBack,
            flip: true,
          })}
        </View>
      <UICard
        variant="glass"
        glassIntensity="light"
        padding="none"
        style={styles.headerGlassOuter}
          contentContainerStyle={[
            styles.headerBarInner,
            typingLabel ? styles.headerBarInnerTyping : null,
          ]}
      >
        {center}
      </UICard>
        <View style={styles.headerSideMarginEnd}>
          {headerSideButton({
            icon: 'search',
            label: 'חיפוש בהודעות',
            onPress: () => setSearchVisible(true),
          })}
        </View>
      </View>
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

  const shouldShowUnreadDivider = useCallback((messageId: string, index: number): boolean => {
    if (!initialUnreadInfo || initialUnreadInfo.count === 0) return false;
    if (!initialUnreadInfo.lastReadMessageId) return false;
    const lastReadIdx = messagesRef.current.findIndex(
      (m) => m.id === initialUnreadInfo.lastReadMessageId,
    );
    if (lastReadIdx <= 0) return false;
    const firstUnreadIdx = lastReadIdx - 1;
    return index === firstUnreadIdx && messagesRef.current[firstUnreadIdx]?.id === messageId;
  }, [initialUnreadInfo]);

  const renderMessage = useCallback(
    ({ item, index }: { item: ChatMessageType; index: number }) => {
      const isMe = item.sender_id === user?.id;
      // inverted: [0]=חדש למטה, [index+1]=ישן יותר (מעל), [index-1]=חדש יותר (מתחת)
      const list = messagesRef.current;
      const olderMessage = index < list.length - 1 ? list[index + 1] : null;
      const newerMessage = index > 0 ? list[index - 1] : null;
      // שם בראשונה כרונולוגית בקבוצה — אין older עם אותו sender_id
      const showSenderName =
        !isMe && (!olderMessage || olderMessage.sender_id !== item.sender_id);
      // אווטאר באחרונה בקבוצה (לפני newer אחר / סוף הרצף)
      const showAvatar =
        !isMe && (!newerMessage || newerMessage.sender_id !== item.sender_id);
      // מרווח גדול בגבול מול older (transform של inverted לא משפיע על layout בין תאים)
      const isAfterSenderChange =
        !!olderMessage && olderMessage.sender_id !== item.sender_id;
      const showDivider = shouldShowDateDivider(item, olderMessage);

      return (
        <ChatListRow
            message={item}
            isMe={isMe}
            showAvatar={showAvatar}
            showSenderName={showSenderName}
          isAfterSenderChange={isAfterSenderChange}
          showDateDivider={showDivider}
          dateDividerLabel={showDivider ? formatDateDivider(new Date(item.created_at)) : ''}
          showUnreadDivider={shouldShowUnreadDivider(item.id, index)}
          unreadCount={initialUnreadInfo?.count || 0}
          isHighlighted={item.id === highlightedMessageId}
          onLayout={(h) => onMessageCellLayout(item.id, h)}
            onLongPress={() => handleMessageLongPress(item)}
            onReply={() => handleReply(item)}
            onReactionPress={(emoji) => handleReactionPress(item, emoji)}
            onReactionDetailsPress={() => handleReactionDetailsPress(item)}
            onJumpToMessage={handleJumpToMessage}
          onRetry={
            item.send_error
              ? () => {
                  void HapticFeedback.impactLight();
                  void retrySendMessage(item.id);
                }
              : undefined
          }
          onStatusPress={
            isMe && !item.id.startsWith('temp-')
              ? () => handleMessageInfo(item)
              : undefined
          }
          onUnreadDividerPress={() => scrollToBottom(false)}
        />
      );
    },
    [
      user?.id,
      highlightedMessageId,
      initialUnreadInfo?.count,
      handleMessageLongPress,
      handleReply,
      handleReactionPress,
      handleReactionDetailsPress,
      handleJumpToMessage,
      shouldShowDateDivider,
      shouldShowUnreadDivider,
      formatDateDivider,
      retrySendMessage,
      handleMessageInfo,
      onMessageCellLayout,
      scrollToBottom,
    ],
  );

  const renderFooter = () => {
    // ב-inverted, Footer משנה את offset — רק בטעינה ראשונה (לא loadMore)
    if (isLoadingMessages && messages.length === 0) {
      return (
        <View style={styles.loadingFooter}>
          <ActivityIndicator color={DesignTokens.colors.primary.main} />
        </View>
      );
    }
    return null;
  };

  // Placeholder מרונדר כ-overlay מעל הרשימה (לא בתוך ה-FlatList ההפוך),
  // כדי שלא יושפע מטרנספורם ה-inverted (שהפך אותו אופקית).
  // הסקלטון נשאר עד שהרשימה נחשפת (messagesRevealed) — לא ברגע שהיא נטענת —
  // כך ההתמקמות לתחתית קורית מאחורי הסקלטון ולא כקפיצה גלויה.
  const isEmptyConfirmed = messagesListReady && !isLoadingMessages && displayMessages.length === 0;
  const showMessagesPlaceholder = !messagesRevealed || isEmptyConfirmed;
  const showMessagesSkeleton = !isEmptyConfirmed;
  const renderMessagesPlaceholder = () => {
    if (showMessagesSkeleton) {
      return (
        <View style={{ paddingHorizontal: 12, paddingTop: 8 }}>
          {[
            { isMe: false, w: '60%' }, { isMe: true, w: '45%' },
            { isMe: false, w: '75%' }, { isMe: false, w: '50%' },
            { isMe: true, w: '55%' }, { isMe: true, w: '35%' },
            { isMe: false, w: '65%' }, { isMe: false, w: '40%' },
          ].map((s, i) => (
            <SkeletonBubble key={i} isMe={s.isMe} width={s.w as any} delay={i * 60} />
          ))}
        </View>
      );
    }

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
        <View style={{ flex: 1, paddingHorizontal: 12, paddingTop: 16 }}>
          {[
            { isMe: false, w: '55%' }, { isMe: true, w: '40%' },
            { isMe: false, w: '70%' }, { isMe: true, w: '50%' },
            { isMe: false, w: '60%' }, { isMe: true, w: '45%' },
          ].map((s, i) => (
            <SkeletonBubble key={i} isMe={s.isMe} width={s.w as any} delay={i * 80} />
          ))}
        </View>
      </ChatScreenShell>
    );
  }

  const chatComposer = (
    <View
      style={[
        styles.inputArea,
        { paddingBottom: composerPaddingBottom },
      ]}
      onLayout={onComposerLayout}
    >
      {typingUsers.length > 0 && renderTypingIndicator()}
      {isAnnouncementGroup && !currentGroup?.is_admin ? (
        <View style={styles.announcementOnlyView}>
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
        />
      )}
    </View>
  );

  const chatMainColumn = (
    <View style={{ flex: 1, position: 'relative' }}>
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

      <PinnedMessagesHeader
        groupId={groupId}
        refreshKey={pinnedRefreshKey}
        onMessagePress={(messageId) => {
          if (messageId === 'refresh_pinned') {
            setPinnedRefreshKey((k) => k + 1);
            return;
          }
          handleJumpToMessage(messageId);
        }}
      />

      <View style={styles.messagesSection}>
        <View style={styles.messagesAreaFlex}>
          <RNAnimated.View style={[styles.flatListTransparent, { opacity: listOpacity }]}>
          <Reanimated.View style={[styles.flatListTransparent, listFollowStyle]}>
          <FlatList
            ref={listRef}
            data={messagesListReady ? displayMessages : []}
          inverted
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          extraData={flatListExtraData}
          ListFooterComponent={renderFooter}
            scrollEnabled
            bounces
            keyboardDismissMode="none"
          keyboardShouldPersistTaps="handled"
          initialNumToRender={10}
            maxToRenderPerBatch={8}
          windowSize={21}
          updateCellsBatchingPeriod={50}
            removeClippedSubviews={false}
            onEndReached={() => {
              if (canLoadOlderMessages()) {
                handleLoadMore();
              }
            }}
            onEndReachedThreshold={0.25}
            onMomentumScrollBegin={() => {
              endReachedMomentumRef.current = false;
            }}
            onMomentumScrollEnd={(e) => {
              endReachedMomentumRef.current = true;
              handleScrollEnd(e);
              if (canLoadOlderMessages()) {
                handleLoadMore();
              }
            }}
          contentContainerStyle={[
              displayMessages.length === 0 ? styles.emptyList : styles.messagesList,
            // המעקב אחרי המקלדת נעשה ע"י translateY רציף על הרשימה עצמה (listFollowStyle),
            // ולכן כאן נשאר רק הריווח הבסיסי הקבוע.
            {
              paddingTop: 12,
              paddingBottom: 12,
            },
          ]}
          showsVerticalScrollIndicator
          nestedScrollEnabled={Platform.OS === 'android'}
          style={styles.flatListTransparent}
          scrollEventThrottle={16}
          onScroll={handleScroll}
            onScrollEndDrag={handleScrollEnd}
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height;
              if (h > 0) {
                layoutHeightRef.current = h;
                const wasReady = listLayoutReadyRef.current;
                listLayoutReadyRef.current = true;
                if (!wasReady && displayMessages.length > 0) {
                  if (pinScrollToBottomRef.current) {
                    scrollChatListToBottom(
                      listScrollRefs,
                      displayMessages.length,
                      false,
                      maxScrollOffsetRef.current,
                    );
                    requestRevealMessagesRef.current();
                  } else if (!initialScrollDoneRef.current) {
                    void applyInitialOpenScrollRef.current();
                  }
                }
              }
            }}
            onContentSizeChange={(_w, contentH) => {
              handleContentSizeChange();
              if (contentH > 0) contentHeightRef.current = contentH;
              if (contentH > 0 && layoutHeightRef.current > 0) {
                maxScrollOffsetRef.current = Math.max(0, contentH - layoutHeightRef.current);
              }
              if (!listLayoutReadyRef.current) return;

              const schedulePinScroll = () => {
                if (contentSizePinTimerRef.current) {
                  clearTimeout(contentSizePinTimerRef.current);
                }
                contentSizePinTimerRef.current = setTimeout(() => {
                  contentSizePinTimerRef.current = null;
                  if (
                    (pinScrollToBottomRef.current || pendingScrollAfterSendRef.current) &&
                    displayMessages.length > 0
                  ) {
                    scrollChatListToBottom(listScrollRefs, displayMessages.length, false);
                  }
                }, 64);
              };

              if (pinScrollToBottomRef.current || pendingScrollAfterSendRef.current) {
                schedulePinScroll();
                return;
              }
              if (
                !initialScrollDoneRef.current &&
                displayMessages.length > 0 &&
                !userScrolledUpRef.current &&
                unreadAutoScrollAppliedForGroupRef.current !== groupId
              ) {
                void applyInitialOpenScrollRef.current();
              }
            }}
            onScrollToIndexFailed={handleScrollToIndexFailedWithPin}
          />
          </Reanimated.View>
          </RNAnimated.View>
          {showMessagesPlaceholder && (
            <View style={styles.messagesPlaceholderOverlay} pointerEvents="none">
              {renderMessagesPlaceholder()}
            </View>
          )}
        </View>
      </View>

      <ChatComposerDock bottomInset={composerPaddingBottom}>
        {chatComposer}
      </ChatComposerDock>

      {/* FAB מעל הקומפוזר ב-z-order — לא בתוך messagesArea (שעלול להיחתם/להיחסם) */}
      {showScrollToBottomButton && !keyboardShown && (
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => {
            console.log('[FAB_PRESS] TouchableOpacity');
            logger.info('ChatGroupScreen', 'FAB_PRESS TouchableOpacity');
            void HapticFeedback.impactLight();
            scrollToBottom(true);
          }}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          accessibilityRole="button"
          accessibilityLabel="גלול להודעות האחרונות"
          style={[
            styles.scrollFabAbsolute,
            { bottom: Math.max(composerHeight + 8, 80) },
          ]}
        >
          <View style={styles.scrollFabCircle}>
            <Ionicons
              name="chevron-down"
              size={20}
              color={DesignTokens.colors.text.primary}
            />
          </View>
          {(initialUnreadInfo?.count ?? 0) > 0 && (
            <View style={styles.scrollBadge} pointerEvents="none">
              <Text style={styles.scrollBadgeText}>
                {initialUnreadInfo!.count > 99 ? '99+' : initialUnreadInfo!.count}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      )}

    </View>
  );

  return (
    <ChatScreenShell>
      <View style={styles.screenRoot}>{chatMainColumn}</View>

      {/* Modals — מחוץ לעמודת המקלדת */}
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

      <SeenBySheet
        visible={!!seenByMessage}
        onClose={() => setSeenByMessage(null)}
        messageId={seenByMessage?.id || ''}
        messageTimestamp={seenByMessage?.created_at || ''}
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
/** גובה אחיד לכפתורי צד ולכרטיס שם הקבוצה */
const CHAT_GROUP_HEADER_HEIGHT = 44;

const createChatGroupStyles = (tokens: any) => StyleSheet.create({
  /* ── Header — כרטיסי זכוכית אחידים (כפתורים + קבוצה) ── */
  headerOuterRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  headerSideMarginStart: {
    marginRight: MAIN_SCREEN_HEADER_HP,
  },
  headerSideMarginEnd: {
    marginLeft: MAIN_SCREEN_HEADER_HP,
  },
  headerGlassOuter: {
    flex: 1,
    minWidth: 0,
    borderRadius: 28,
  },
  headerSideGlass: {
    width: CHAT_GROUP_HEADER_HEIGHT,
    height: CHAT_GROUP_HEADER_HEIGHT,
    borderRadius: CHAT_GROUP_HEADER_HEIGHT / 2,
    flexShrink: 0,
  },
  headerSideGlassInner: {
    width: CHAT_GROUP_HEADER_HEIGHT,
    height: CHAT_GROUP_HEADER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBackIconFlip: {
    transform: [{ scaleX: -1 }],
  },
  headerBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    direction: 'ltr',
    paddingHorizontal: 12,
    minHeight: CHAT_GROUP_HEADER_HEIGHT,
    height: CHAT_GROUP_HEADER_HEIGHT,
  },
  headerBarInnerTyping: {
    height: undefined,
    paddingVertical: 6,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  headerTextWrap: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.text.primary,
    letterSpacing: -0.2,
    textAlign: 'center',
    width: '100%',
    lineHeight: 20,
  },
  headerSubtitle: {
    fontSize: 11,
    color: tokens.colors.text.tertiary,
    marginTop: 0,
    textAlign: 'center',
    width: '100%',
    lineHeight: 14,
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
  screenRoot: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  messagesKeyboardAvoid: {
    flex: 1,
    minHeight: 0,
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  messagesSection: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  /** minHeight:0 — בלי זה FlatList לא מגלגל בתוך עמודת flex */
  messagesAreaFlex: {
    flex: 1,
    minHeight: 0,
    // הרשימה זזה ב-translateY עם המקלדת; clip מונע דליפה מעל ה-PinnedHeader.
    overflow: 'hidden',
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
    paddingBottom: 0,
    backgroundColor: 'transparent',
    borderTopWidth: 0,
  },

  /* ── Scroll to bottom FAB ── */
  messagesPlaceholderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    paddingBottom: 12,
  },
  scrollFabAbsolute: {
    position: 'absolute',
    left: 14,
    zIndex: 9999,
    elevation: 30,
  },
  scrollFabCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(28, 32, 28, 0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: tokens.colors.primary.main,
    borderWidth: 2,
    borderColor: tokens.colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    zIndex: 1,
  },
  scrollBadgeText: {
    color: tokens.colors.text.inverse,
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
