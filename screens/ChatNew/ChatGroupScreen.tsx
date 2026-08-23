// ============================================
// Chat Group Screen - Modern Design (from reference)
// ============================================

import { legacyAlert } from '../../utils/appDialog';
import React, { useMemo, useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { View, FlatList, Text, StyleSheet, type ViewStyle, type DimensionValue, TouchableOpacity, Pressable, ActivityIndicator, Image, Modal, TextInput, Animated as RNAnimated, Easing, Platform, LayoutChangeEvent, InteractionManager } from 'react-native';
import { SHEET_CLOSE_MS } from '../../components/ui/BottomSheet';
import { chatComposerSafeBottomInset, chatComposerKeyboardTranslate, CHAT_COMPOSER_KEYBOARD_GAP, CHAT_KEYBOARD_LTR_STYLE } from '../../components/chat/chatInputLayout';
import { ChatComposerDock, ChatKeyboardFollow } from '../../components/chat/ChatComposerDock';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChatKeyboardInsets } from '../../hooks/useChatKeyboardInsets';
import Reanimated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useGenericKeyboardHandler } from 'react-native-keyboard-controller';

import { BlurView } from 'expo-blur';
import { chatPalette } from '../../components/chat/chatDesignTokens';
import { ChatScreenShell } from '../../components/chat/ChatScreenShell';
import UICard from '../../components/ui/UICard';
import { MAIN_SCREEN_HEADER_HP } from '../../components/ui/MainDrawerScreenHeader';
import { useDesignTokens } from '../../components/ui/DesignTokens';

import { useChat, useChatActions } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { queryClient } from '../../lib/queryClient';
import { appQueryKeys } from '../../lib/appQueryKeys';
import { readGroupMessagesCache } from '../../lib/chatMessageCache';
import { CommonActions, useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useLockParentDrawerWhileFocused } from '../../hooks/useLockParentDrawerWhileFocused';
import ChatInput from '../../components/chat/ChatInput';

import ReactionPicker from '../../components/chat/ReactionPicker';
import ReactionDetailsModal from '../../components/chat/ReactionDetailsModal';
import ForwardMessageModal from '../../components/chat/ForwardMessageModal';
import ChatListRow from '../../components/chat/ChatListRow';
import LongPressOverlay from '../../components/chat/LongPressOverlay';
import ChatSearchBottomSheet from '../../components/chat/ChatSearchBottomSheet';
import SeenBySheet from '../../components/chat/SeenBySheet';
import { MessageSnapshot } from '../../types/MessageSnapshot';
import { ChatMessage as ChatMessageType, ChatMessageType as MessageType } from '../../types/chat.types';
import { Ionicons } from '@expo/vector-icons';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { he } from 'date-fns/locale';
import { logger } from '../../utils/logger';
import { isAnnouncementGroup as checkIsAnnouncementGroup } from '../../utils/isAnnouncementGroup';
import { canSendInAdminOnlyChat } from '../../utils/canSendInAdminOnlyChat';
import { useIsAdmin } from '../../hooks/useIsAdmin';
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
  const { isAdmin: isAppAdmin } = useIsAdmin();
  const insets = useSafeAreaInsets();
  const [composerHeight, setComposerHeight] = useState(72);
  // דחיית רינדור רשימה כבדה רק בנתיב קר (אין cache).
  // Warm/WhatsApp: הודעות מה-cache מרונדרות מיד — בלי InteractionManager, בלי opacity:0.
  //
  // Expected TTI (cache hit):
  //   navigate → first RN frame paints messages from queryClient (opacity 1) → done
  //   scroll-to-unread / network delta run AFTER first paint
  // Cold (no cache): brief skeleton OK until disk/network seed.
  const [messagesListReady, setMessagesListReady] = useState(false);
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
  /** רק כשהגלילה בפועל למפריד קרתה — מבחין בין החלטה סופית לגלילה זמנית ל-bottom */
  const unreadDividerScrollDoneForGroupRef = useRef<string | null>(null);
  /** טיימרים של refinement פאסים + reveal מאוחר — מתנקים כשמחליפים קבוצה. */
  const unreadRefineTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
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

  const { selectGroup, refreshCurrentGroupDetails, confirmChatReadAtBottom, leaveChatScreen } = useChatActions();

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

  /**
   * זריעה סינכרונית מ-queryClient לפני ש-selectGroup מעדכן state.
   * בלי זה: frame ראשון עם groupId חדש רואה messages של הקבוצה הקודמת / ריק
   * → skeleton + opacity:0 (רגרסיית iOS אחרי שערי reveal).
   */
  const cachedSeedMessages = useMemo(() => {
    if (!groupId) return [] as ChatMessageType[];
    return readGroupMessagesCache(groupId);
    // נקרא מחדש כש-context messages משתנים (אחרי merge רשת/realtime)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- groupId + messages length/id tip
  }, [groupId, messages.length, messages[0]?.id, messages[messages.length - 1]?.id]);

  const contextMessagesForGroup = useMemo(() => {
    if (!messages.length) return null;
    if (currentGroup?.id === groupId) return messages;
    if (messages.some((m) => m.group_id === groupId)) return messages;
    return null;
  }, [messages, currentGroup?.id, groupId]);

  /** יש data מקומי לקבוצה הזו — כניסה בסגנון WhatsApp בלי סקלטון.
   * לא תלוי ב-isLoadingMessages: רענון רשת ברקע לא צריך להסתיר הודעות cache. */
  const displayMessages = contextMessagesForGroup ?? cachedSeedMessages;
  const hasLocalMessagesForGroup = displayMessages.length > 0;

  /** כותרת מיידית מ־cache הרשימה גם לפני ש־selectGroup מעדכן currentGroup */
  const shellGroup = useMemo(() => {
    if (currentGroup?.id === groupId) return currentGroup;
    if (!user?.id) return currentGroup;
    const cachedGroups = queryClient.getQueryData<{ id: string }[]>(
      appQueryKeys.chatGroups(user.id),
    );
    const hit = cachedGroups?.find((g) => g.id === groupId);
    return (hit as typeof currentGroup) ?? currentGroup;
  }, [currentGroup, groupId, user?.id]);

  const initialUnreadInfoRef = useRef(initialUnreadInfo);
  /** Snapshot so divider can fade after initialUnreadInfo is cleared */
  const unreadDividerSnapshotRef = useRef<{
    count: number;
    lastReadMessageId: string;
  } | null>(null);
  const [unreadDividerPhase, setUnreadDividerPhase] = useState<
    'hidden' | 'visible' | 'fading'
  >('hidden');
  const unreadDividerPhaseRef = useRef(unreadDividerPhase);
  unreadDividerPhaseRef.current = unreadDividerPhase;
  const unreadDividerDismissedRef = useRef(false);

  // בדיקה אם זו קבוצת הכרזות (id מדויק / שם מדויק — לא includes)
  const isAnnouncementGroup = useMemo(
    () => checkIsAnnouncementGroup(shellGroup?.name, shellGroup?.id),
    [shellGroup?.name, shellGroup?.id],
  );

  /** הכרזות: מנהל קבוצה או מנהל אפליקציה (subscription_role) יכולים לכתוב */
  const canSendInAnnouncements = useMemo(() => {
    if (!isAnnouncementGroup) return true;
    const myRole =
      currentGroup?.my_role ?? (shellGroup as { my_role?: string } | null)?.my_role;
    return canSendInAdminOnlyChat({
      isGroupAdmin: !!currentGroup?.is_admin,
      isAppAdmin,
      myRole,
    });
  }, [
    isAnnouncementGroup,
    currentGroup?.is_admin,
    currentGroup?.my_role,
    shellGroup,
    isAppAdmin,
  ]);

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
  // displayMessages מוגדר למעלה (context || cache seed)

  /**
   * FlatList initialNumToRender: warm path = viewport קטן בלבד (טיפ),
   * כדי ש-first paint לא ירנדר 40–60 בועות כבדות מאחורי opacity:0.
   * גלילה למפריד unread אחרי paint — מותר שיטען עוד תאים.
   */
  const initialListRender = useMemo(() => {
    if (hasLocalMessagesForGroup) {
      return Platform.OS === 'android' ? 14 : 16;
    }
    const unread = initialUnreadInfo?.count ?? 0;
    const cap = Platform.OS === 'android' ? 28 : 36;
    return Math.max(12, Math.min(cap, unread > 0 ? Math.min(unread + 6, cap) : 16));
  }, [hasLocalMessagesForGroup, initialUnreadInfo?.count]);

  const listWindowSize = Platform.OS === 'android' ? 9 : 15;
  const listMaxBatch = Platform.OS === 'android' ? 6 : 10;
  /** refinement בלבד אחרי paint — לא חוסם חשיפה */
  const unreadRevealDelayMs = 0;

  /**
   * אנימציית כניסה רק להודעות חדשות באמת:
   * - baseline נזרע פעם אחת עם כל ההודעות שכבר קיימות בטעינה הראשונה (לא מונפשות).
   * - כל id שכבר הונפש נשמר, כדי שמחזור (recycle) של FlatList לא ינפיש שוב.
   */
  const animatedMsgIdsRef = useRef<Set<string>>(new Set());
  const animBaselineSeededRef = useRef(false);

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
      // אל תסמן initialScrollDone בגלל offset≈0 בזמן פתיחה עם unread —
      // ב-Android FlatList inverted יורה onScroll לתחתית לפני שהגלילה למפריד רצה,
      // ואז applyInitialOpenScroll היה מדלג (already-done) והמפריד/badge נשברו.
      const pendingUnreadOpen =
        !!initialUnreadInfoRef.current?.count &&
        !!initialUnreadInfoRef.current?.lastReadMessageId &&
        unreadDividerScrollDoneForGroupRef.current !== groupId;
      if (!initialScrollDoneRef.current && !pendingUnreadOpen) {
        initialScrollDoneRef.current = true;
      }
      if (pendingScrollAfterSendRef.current) {
        pendingScrollAfterSendRef.current = false;
      }
      // Confirm-read רק אחרי שהמשתמש באמת בתחתית (לא בזמן מיקום מפריד / גלילה פרוגרמטית)
      const canConfirmRead =
        !pendingUnreadOpen &&
        initialScrollDoneRef.current &&
        Date.now() >= blockUnreadAutoScrollUntilRef.current;
      if (
        canConfirmRead &&
        initialUnreadInfoRef.current?.count &&
        !readConfirmTimerRef.current
      ) {
        readConfirmTimerRef.current = setTimeout(() => {
          readConfirmTimerRef.current = null;
          if (isAtBottomRef.current) {
            void confirmReadRef.current();
          }
        }, Platform.OS === 'android' ? 350 : 700);
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
      if (readConfirmTimerRef.current) {
        clearTimeout(readConfirmTimerRef.current);
        readConfirmTimerRef.current = null;
      }
    }

    return { distFromBottom, atBottom, offsetY };
  }, [groupId]);

  const syncScrollFab = useCallback((event?: {
    nativeEvent?: {
      contentOffset?: { y?: number };
      contentSize?: { height?: number };
      layoutMeasurement?: { height?: number };
    };
  }) => {
    const { distFromBottom, atBottom, offsetY } = applyScrollMetrics(event);
    const shouldShow = distFromBottom > SCROLL_SHOW_FAB_PX;

    // Hot path — avoid console spam on Android (scroll fires ~60fps)
    const now = Date.now();
    if (now < verboseScrollLogUntilRef.current && now - lastScrollLogRef.current > 1200) {
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
    }
  }, [applyScrollMetrics]);

  const handleScroll = useCallback((event: any) => {
    const metrics = applyScrollMetrics(event);

    const shouldShow = metrics.distFromBottom > SCROLL_SHOW_FAB_PX;
    const now = Date.now();
    if (now < verboseScrollLogUntilRef.current && now - lastScrollLogRef.current > 1200) {
      lastScrollLogRef.current = now;
      logger.debug(
        'ChatGroupScreen',
        `onScroll offsetY=${metrics.offsetY.toFixed(0)} distBottom=${metrics.distFromBottom.toFixed(0)} atBottom=${metrics.atBottom}`,
      );
    }

    if (Date.now() < ignoreFabUntilRef.current) return;

    if (shouldShow !== showScrollBtnRef.current) {
      showScrollBtnRef.current = shouldShow;
      setShowScrollToBottomButton(shouldShow);
    }
  }, [applyScrollMetrics]);

  const handleScrollEnd = useCallback((event: any) => {
    syncScrollFab(event);
  }, [syncScrollFab]);

  // FlatList flip: offset 0 = הודעות חדשות
  const prevMessagesLengthRef = useRef(0);

  const [replyTo, setReplyTo] = useState<{
    id: string;
    senderName: string;
    content: string;
    messageType?: string;
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
    logger.debug(
      'ChatGroupScreen',
      `initialUnreadInfo received groupId=${groupId} value=${
        initialUnreadInfo
          ? `{count=${initialUnreadInfo.count}, lastReadId=${initialUnreadInfo.lastReadMessageId ?? 'null'}}`
          : 'null'
      } msgs=${displayMessages.length} listReady=${messagesListReady}`,
    );
  }, [initialUnreadInfo, groupId, displayMessages.length, messagesListReady]);

  // Keep divider mounted through fade-out when read is confirmed (no abrupt pop).
  useEffect(() => {
    if (
      initialUnreadInfo &&
      initialUnreadInfo.count > 0 &&
      initialUnreadInfo.lastReadMessageId
    ) {
      const next = {
        count: initialUnreadInfo.count,
        lastReadMessageId: initialUnreadInfo.lastReadMessageId,
      };
      const prev = unreadDividerSnapshotRef.current;
      if (prev?.lastReadMessageId !== next.lastReadMessageId) {
        unreadDividerDismissedRef.current = false;
      }
      unreadDividerSnapshotRef.current = next;
      if (!unreadDividerDismissedRef.current) {
        setUnreadDividerPhase('visible');
      }
      return;
    }
    if (unreadDividerPhaseRef.current === 'visible' && unreadDividerSnapshotRef.current) {
      setUnreadDividerPhase('fading');
    }
  }, [initialUnreadInfo]);

  const handleUnreadDividerDismissed = useCallback(() => {
    unreadDividerDismissedRef.current = true;
    unreadDividerSnapshotRef.current = null;
    setUnreadDividerPhase('hidden');
  }, []);

  const confirmReadRef = useRef(confirmChatReadAtBottom);
  confirmReadRef.current = confirmChatReadAtBottom;
  const leaveChatScreenRef = useRef(leaveChatScreen);
  leaveChatScreenRef.current = leaveChatScreen;
  const [longPressMessage, setLongPressMessage] = useState<MessageSnapshot | null>(null);
  const [searchVisible, setSearchVisible] = useState(false);
  const [seenByMessage, setSeenByMessage] = useState<ChatMessageType | null>(null);

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
          if (reachedBottom || distFromBottomRef.current <= SCROLL_AT_BOTTOM_PX) {
            hideScrollFab();
          }
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
  }, [displayMessages.length, hideScrollFab, listScrollRefs]);

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

  // Android בלבד: מעקב Reanimated של הרשימה אחרי המקלדת (אותו translate כמו הקומפוזר).
  // iOS משתמש ב-KeyboardStickyView (ChatKeyboardFollow) — לא ב-handler הזה.
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
  // iOS: הרשימה נדחפת ע"י KeyboardStickyView (ChatKeyboardFollow) — לא Reanimated.
  // Android: אותו translate ידני כמו הקומפוזר + ADJUST_NOTHING.

  /** תמיד גולל לתחתית כששולחים — גם אחרי פתיחה עם unread (לא בתחתית) */
  const scrollToBottomOnSend = useCallback(() => {
    pendingScrollAfterSendRef.current = true;
    pinScrollToBottomRef.current = true;
    userScrolledUpRef.current = false;
    isAtBottomRef.current = true;
    ignoreFabUntilRef.current = Date.now() + 1200;
    // לא hideScrollFab כאן — setState לפני scroll מבטל jump ב-inverted
    applyScrollToBottom(false);
  }, [applyScrollToBottom]);

  /**
   * פתיחת צ'אט (WhatsApp-style):
   * – יש unread + last_read → גלילה להודעה הראשונה שלא נקראה כך שהמפריד קרוב לראש המסך
   * – אחרת → תחתית (הודעות אחרונות)
   *
   * הערה על ה-viewPosition:
   * ה-FlatList הפוך. הפורמולה המקומית ב-`targetOffsetForIndex` מחשבת offset עם
   * viewPosition בסמנטיקה של רשימה רגילה (0=top, 1=bottom), אבל ה-scaleY(-1)
   * של ה-inverted ScrollView הופך את הכיוון בפועל, ולכן במסך:
   *   vp=0.0 → פריט קרוב לתחתית המסך
   *   vp=0.5 → מרכז
   *   vp=1.0 → פריט קרוב לראש המסך
   * לכן כדי למקם מפריד ~10% מלמעלה בתוך רשימה הפוכה, משתמשים ב-vp≈0.88.
   */
  const applyInitialOpenScroll = useCallback(async () => {
    const unreadCount = initialUnreadInfo?.count ?? 0;
    const lastReadId = initialUnreadInfo?.lastReadMessageId ?? null;
    const dividerIdx =
      lastReadId != null
        ? displayMessages.findIndex((m) => m.id === lastReadId)
        : -1;

    logger.debug(
      'ChatGroupScreen',
      `applyInitialOpenScroll:enter groupId=${groupId} unread=${unreadCount} lastReadId=${lastReadId ?? 'null'} ` +
        `msgs=${displayMessages.length} listReady=${messagesListReady} layoutReady=${listLayoutReadyRef.current} ` +
        `initialDone=${initialScrollDoneRef.current} inFlight=${initialScrollInFlightRef.current} ` +
        `pinBottom=${pinScrollToBottomRef.current} ` +
        `autoApplied=${unreadAutoScrollAppliedForGroupRef.current === groupId ? 'yes' : 'no'} ` +
        `dividerDone=${unreadDividerScrollDoneForGroupRef.current === groupId ? 'yes' : 'no'} ` +
        `lastReadIdxInList=${dividerIdx}`,
    );

    if (!groupId) {
      logger.debug('ChatGroupScreen', 'applyInitialOpenScroll:skip route=no-groupId');
      return;
    }
    if (initialScrollDoneRef.current) {
      logger.debug('ChatGroupScreen', 'applyInitialOpenScroll:skip route=already-done');
      return;
    }
    if (initialScrollInFlightRef.current) {
      logger.debug('ChatGroupScreen', 'applyInitialOpenScroll:skip route=in-flight');
      return;
    }
    if (!listLayoutReadyRef.current) {
      logger.debug('ChatGroupScreen', 'applyInitialOpenScroll:skip route=layout-not-ready');
      return;
    }
    if (displayMessages.length === 0) {
      logger.debug('ChatGroupScreen', 'applyInitialOpenScroll:skip route=empty-messages');
      return;
    }
    if (scrollToMessageId) {
      logger.debug('ChatGroupScreen', 'applyInitialOpenScroll:skip route=jump-to-message');
      return;
    }
    if (Date.now() < blockUnreadAutoScrollUntilRef.current) {
      logger.debug('ChatGroupScreen', 'applyInitialOpenScroll:skip route=blocked-window');
      return;
    }
    // חשוב: לא לבלוק כאן אם עוד לא ביצענו בפועל את הגלילה למפריד — כדי
    // לאפשר לגלילה למפריד לרוץ גם אם initialUnreadInfo הגיע אחרי paint ראשון.
    if (
      unreadAutoScrollAppliedForGroupRef.current === groupId &&
      unreadDividerScrollDoneForGroupRef.current === groupId
    ) {
      logger.debug('ChatGroupScreen', 'applyInitialOpenScroll:skip route=divider-already-applied');
      return;
    }

    if (unreadCount > 0 && lastReadId) {
      initialScrollInFlightRef.current = true;
      let lastReadIndex = dividerIdx;

      if (lastReadIndex === -1 && !loadingLastReadForInitialRef.current) {
        loadingLastReadForInitialRef.current = true;
        logger.debug(
          'ChatGroupScreen',
          `applyInitialOpenScroll:load-around lastReadId=${lastReadId}`,
        );
        const result = await loadMessagesAround(lastReadId);
        loadingLastReadForInitialRef.current = false;
        initialScrollInFlightRef.current = false;
        if (!result.success) {
          unreadAutoScrollAppliedForGroupRef.current = groupId;
          unreadDividerScrollDoneForGroupRef.current = groupId;
          applyScrollToBottom(false);
          logger.debug(
            'ChatGroupScreen',
            'applyInitialOpenScroll:route=bottom (last read not found)',
          );
        } else {
          logger.debug(
            'ChatGroupScreen',
            'applyInitialOpenScroll:load-around ok, waiting for re-trigger',
          );
        }
        return;
      }

      if (lastReadIndex === -1) {
        initialScrollInFlightRef.current = false;
        logger.debug(
          'ChatGroupScreen',
          'applyInitialOpenScroll:skip route=last-read-missing-loading',
        );
        return;
      }

      // אם החלון הראשוני קטן מה-unread — עדיין מגללים למפריד (lastRead קיים).
      // המתנה להשלמת כל ה-unread חסמה iOS מאחורי opacity:0 (רגרסיה).
      if (lastReadIndex < unreadCount) {
        logger.debug(
          'ChatGroupScreen',
          `applyInitialOpenScroll:partial-unread loaded=${lastReadIndex} required=${unreadCount} msgs=${displayMessages.length} — scrolling anyway`,
        );
      }

      // first unread is newer than lastRead → one index closer to bottom (0)
      const firstUnreadIndex = lastReadIndex > 0 ? lastReadIndex - 1 : lastReadIndex;
      const targetId =
        displayMessages[firstUnreadIndex]?.id ?? lastReadId;

      // חשוב: לבטל retries של scrollChatListToBottom שרצים במקביל.
      // pinScrollToBottomRef עלול להיות true אם המסלול הזמני "pending" נכנס לפני
      // ש-initialUnreadInfo הגיע — מנקים כדי שהגלילה למפריד לא תוחזר לתחתית.
      unreadAutoScrollAppliedForGroupRef.current = groupId;
      unreadDividerScrollDoneForGroupRef.current = groupId;
      pinScrollToBottomRef.current = false;
      pendingScrollAfterSendRef.current = false;
      programmaticScrollRef.current = true;
      ignoreFabUntilRef.current = Date.now() + 800;

      // מפריד "הודעות חדשות" ~10% מראש ה-viewport (סגנון WhatsApp).
      // ראה הערה בראש הפונקציה: ברשימה הפוכה vp≈0.88 = ~12% מלמעלה.
      const DIVIDER_VIEW_POSITION = 0.88;
      scrollToMessageInView(targetId, {
        viewPosition: DIVIDER_VIEW_POSITION,
        animated: false,
        highlight: false,
      });

      // ריפיין אחרי שגובה שורות נמדדו (retry עם offset מדויק יותר).
      requestAnimationFrame(() => {
        queueScrollToMessage(targetId, false, {
          viewPosition: DIVIDER_VIEW_POSITION,
          highlight: false,
        });
      });
      const refineTimer1 = setTimeout(() => {
        queueScrollToMessage(targetId, false, {
          viewPosition: DIVIDER_VIEW_POSITION,
          highlight: false,
        });
      }, Platform.OS === 'android' ? 80 : 120);
      // ב-Android פחות refinement passes — כל אחד חוסם את ה-JS thread
      if (Platform.OS !== 'android') {
        const refineTimer2 = setTimeout(() => {
          queueScrollToMessage(targetId, false, {
            viewPosition: DIVIDER_VIEW_POSITION,
            highlight: false,
          });
        }, 260);
        unreadRefineTimersRef.current.push(refineTimer2);
      }
      unreadRefineTimersRef.current.push(refineTimer1);

      initialScrollDoneRef.current = true;
      userScrolledUpRef.current = true;
      isAtBottomRef.current = false;
      initialScrollInFlightRef.current = false;

      showScrollBtnRef.current = true;
      setShowScrollToBottomButton(true);
      logger.debug(
        'ChatGroupScreen',
        `initial scroll to unread divider index=${firstUnreadIndex} unread=${unreadCount} targetId=${targetId} vp=${DIVIDER_VIEW_POSITION} loadedMsgs=${displayMessages.length}`,
      );
      // חשיפה כבר קרתה ב-cache hit; כאן רק safety אם נתיב קר חיכה למפריד
      if (!messagesRevealedRef.current) {
        if (unreadRevealDelayMs <= 0) {
          requestRevealMessages();
        } else {
          const revealTimer = setTimeout(() => {
            requestRevealMessages();
          }, unreadRevealDelayMs);
          unreadRefineTimersRef.current.push(revealTimer);
        }
      }
      return;
    }

    // null = unread עדיין לא ידוע (אין cache קבוצות). רשימה הפוכה כבר ב-offset=0.
    // לא מפעילים scrollChatListToBottom עם retries שיילחמו כש-unreadEffect
    // יגלול למפריד. מסמנים autoApplied כדי לא להיתקע בלולאת onContentSizeChange,
    // בלי dividerDone — כך unreadEffect יכול עדיין להפעיל גלילה למפריד.
    if (initialUnreadInfo == null) {
      pinScrollToBottomRef.current = true;
      isAtBottomRef.current = true;
      userScrolledUpRef.current = false;
      unreadAutoScrollAppliedForGroupRef.current = groupId;
      requestRevealMessagesRef.current();
      logger.debug(
        'ChatGroupScreen',
        'applyInitialOpenScroll:route=bottom-lite (unread info pending)',
      );
      return;
    }

    // count=0 (או בלי lastRead) — סיום מפורש לתחתית (לא lite תקוע).
    unreadAutoScrollAppliedForGroupRef.current = groupId;
    unreadDividerScrollDoneForGroupRef.current = groupId;
    applyScrollToBottom(false, true);
    logger.debug(
      'ChatGroupScreen',
      `initial scroll to bottom unread=${unreadCount} lastReadId=${lastReadId ?? 'null'}`,
    );
  }, [
    groupId,
    displayMessages,
    initialUnreadInfo,
    messagesListReady,
    scrollToMessageId,
    loadMessagesAround,
    applyScrollToBottom,
    scrollToMessageInView,
    queueScrollToMessage,
    requestRevealMessages,
    unreadRevealDelayMs,
  ]);

  const applyInitialOpenScrollRef = useRef(applyInitialOpenScroll);
  applyInitialOpenScrollRef.current = applyInitialOpenScroll;

  /**
   * Race guard: initialUnreadInfo יכול להגיע אחרי שה-FlatList כבר עשה paint
   * ראשון וגלילה זמנית לתחתית. במקרה כזה אנו מנקים את הדגל שגורם ל-early-return
   * ב-applyInitialOpenScroll ומריצים אותו שוב, כך שהמסך יזוז למפריד "הודעות
   * שלא נקראו" ברגע שהמידע זמין (בלי לחטוף גלילה של המשתמש).
   */
  useEffect(() => {
    const unreadCount = initialUnreadInfo?.count ?? 0;
    const lastReadId = initialUnreadInfo?.lastReadMessageId ?? null;
    const conds = {
      groupId,
      unreadCount,
      lastReadId,
      messagesListReady,
      msgs: displayMessages.length,
      layoutReady: listLayoutReadyRef.current,
      userScrolledUp: userScrolledUpRef.current,
      dividerDone: unreadDividerScrollDoneForGroupRef.current === groupId,
      autoApplied: unreadAutoScrollAppliedForGroupRef.current === groupId,
      pinBottom: pinScrollToBottomRef.current,
      initialDone: initialScrollDoneRef.current,
    };

    if (!groupId) {
      logger.debug('ChatGroupScreen', 'unreadEffect:skip no-groupId', conds);
      return;
    }
    if (unreadCount <= 0 || !lastReadId) {
      // אחרי bottom-lite (pending→count=0): לסיים גלילה לתחתית במקום להישאר תקועים.
      if (
        initialUnreadInfo != null &&
        unreadCount <= 0 &&
        messagesListReady &&
        displayMessages.length > 0 &&
        listLayoutReadyRef.current &&
        unreadDividerScrollDoneForGroupRef.current !== groupId &&
        !initialScrollDoneRef.current
      ) {
        logger.debug('ChatGroupScreen', 'unreadEffect:finish-bottom count=0', conds);
        unreadAutoScrollAppliedForGroupRef.current = null;
        initialScrollInFlightRef.current = false;
        void applyInitialOpenScrollRef.current();
        return;
      }
      logger.debug('ChatGroupScreen', 'unreadEffect:skip no-unread-info', conds);
      return;
    }
    if (!messagesListReady) {
      logger.debug('ChatGroupScreen', 'unreadEffect:skip messages-not-ready', conds);
      return;
    }
    if (displayMessages.length === 0) {
      logger.debug('ChatGroupScreen', 'unreadEffect:skip empty-messages', conds);
      return;
    }
    if (unreadDividerScrollDoneForGroupRef.current === groupId) {
      logger.debug('ChatGroupScreen', 'unreadEffect:skip divider-already-done', conds);
      return;
    }
    if (userScrolledUpRef.current) {
      logger.debug('ChatGroupScreen', 'unreadEffect:skip user-scrolled', conds);
      return;
    }
    if (!listLayoutReadyRef.current) {
      logger.debug('ChatGroupScreen', 'unreadEffect:skip layout-not-ready', conds);
      return;
    }

    // חשוב לפני קריאה חוזרת: לנקות pin/scroll שאולי הוגדרו במסלול "pending"
    // כדי שהגלילה למפריד לא תיחסם/תוחזר מיד לתחתית.
    pinScrollToBottomRef.current = false;
    pendingScrollAfterSendRef.current = false;
    unreadAutoScrollAppliedForGroupRef.current = null;
    initialScrollDoneRef.current = false;
    initialScrollInFlightRef.current = false;

    logger.debug(
      'ChatGroupScreen',
      `unreadEffect:re-trigger applyInitialOpenScroll unread=${unreadCount} lastReadId=${lastReadId}`,
    );
    void applyInitialOpenScrollRef.current();
  }, [
    groupId,
    initialUnreadInfo?.count,
    initialUnreadInfo?.lastReadMessageId,
    messagesListReady,
    displayMessages.length,
  ]);

  const scrollToBottom = useCallback((animated: boolean = true) => {
    const count = displayMessages.length;
    const list = listRef.current;
    const distBefore = distFromBottomRef.current;

    logger.info(
      'ChatGroupScreen',
      `FAB_PRESS distBefore=${distBefore.toFixed(0)} count=${count} hasList=${!!list} animated=${animated}`,
    );

    if (count === 0 || !list) return;

    // pin מיידי רק בלי אנימציה — contentSize pin עם animated:false קוטע גלילה חלקה
    pinScrollToBottomRef.current = !animated;
    programmaticScrollRef.current = true;
    userScrolledUpRef.current = false;
    pendingScrollAfterSendRef.current = false;
    // חוסם עדכון FAB בזמן הגלילה — בלי setState לפני scroll (re-render מבטל jump ב-inverted)
    // animated: חלון ארוך יותר (גלילה מבוקרת עד ~900ms + watch + fallback)
    ignoreFabUntilRef.current = Date.now() + (animated ? 2800 : 1500);
    blockUnreadAutoScrollUntilRef.current = Date.now() + 5000;

    scrollChatListToBottom(listScrollRefs, count, animated, undefined, {
      maxAttempts: animated ? 8 : 18,
      startDist: distBefore,
      onDone: ({ reachedBottom }) => {
        const distAfter = distFromBottomRef.current;
        logger.info(
          'ChatGroupScreen',
          `SCROLL_RESULT done reached=${reachedBottom} distBefore=${distBefore.toFixed(0)} distAfter=${distAfter.toFixed(0)}`,
        );
        pinScrollToBottomRef.current = true;
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
    }, animated ? 3200 : 4000);
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

  // זריעת baseline של אנימציית הכניסה: כל ההודעות שקיימות בעת חשיפת הרשימה
  // מסומנות כ"נראו כבר" ולכן לא מונפשות — רק הודעות שיגיעו אח"כ ינפישו.
  if (!animBaselineSeededRef.current && messagesListReady) {
    for (const m of displayMessages) animatedMsgIdsRef.current.add(m.id);
    animBaselineSeededRef.current = true;
  }

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
      if (unreadRefineTimersRef.current.length > 0) {
        unreadRefineTimersRef.current.forEach((t) => clearTimeout(t));
        unreadRefineTimersRef.current = [];
      }
    };
  }, []);

  // זריעת cache לפני paint — כמו WhatsApp: A→back→A בלי סקלטון
  // חשוב: deps רק groupId — selectGroup יציב מ-useChatActions, אבל לא לשים אותו
  // ב-deps כדי למנוע selectGroup:fetch בלולאה אם הזהות משתנה.
  useLayoutEffect(() => {
    if (!groupId) return;

    const isNewGroup = prevGroupIdRef.current !== groupId;
    prevGroupIdRef.current = groupId;

    // Instant paint: seed opacity BEFORE selectGroup state lands.
    // Cache hit TTI = this layout pass (1 frame). Unread scroll deferred.
    const warmHit = readGroupMessagesCache(groupId).length > 0;
    if (isNewGroup) {
      if (warmHit) {
        messagesRevealedRef.current = true;
        setMessagesRevealed(true);
        setMessagesListReady(true);
        listOpacity.setValue(1);
      } else {
        messagesRevealedRef.current = false;
        setMessagesRevealed(false);
        setMessagesListReady(false);
        listOpacity.setValue(0);
      }
    }

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
    unreadDividerScrollDoneForGroupRef.current = null;
    animBaselineSeededRef.current = false;
    animatedMsgIdsRef.current.clear();
    // ניקוי טיימרים של refinement/reveal מהקבוצה הקודמת
    if (unreadRefineTimersRef.current.length > 0) {
      unreadRefineTimersRef.current.forEach((t) => clearTimeout(t));
      unreadRefineTimersRef.current = [];
    }
    initialScrollInFlightRef.current = false;
    loadingLastReadForInitialRef.current = false;
    pendingScrollAfterSendRef.current = false;
    pinScrollToBottomRef.current = false;
    unreadDividerSnapshotRef.current = null;
    unreadDividerDismissedRef.current = false;
    setUnreadDividerPhase('hidden');

    const t = setTimeout(() => {
      endReachedReadyRef.current = true;
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectGroup יציב; thrash guard ב-ChatContext
  }, [groupId, listOpacity]);

  // Cache hit (כולל unread) → opacity 1 מיד. גלילה למפריד אחרי first paint.
  // Cold בלבד: skeleton + InteractionManager קצר.
  useLayoutEffect(() => {
    if (hasLocalMessagesForGroup) {
      setMessagesListReady(true);
      if (!messagesRevealedRef.current) {
        messagesRevealedRef.current = true;
        setMessagesRevealed(true);
        listOpacity.setValue(1);
      } else {
        listOpacity.setValue(1);
      }
      return;
    }

    // כבר נחשף לקבוצה הזו בלי הודעות? לא להחזיר skeleton בטעות באמצע שליחה
    if (messagesRevealedRef.current && currentGroup?.id === groupId) {
      return;
    }

    setMessagesListReady(false);
    setMessagesRevealed(false);
    messagesRevealedRef.current = false;
    listOpacity.setValue(0);
    const handle = InteractionManager.runAfterInteractions(() => {
      setMessagesListReady(true);
    });
    const fallback = setTimeout(() => setMessagesListReady(true), 48);
    return () => {
      handle.cancel();
      clearTimeout(fallback);
    };
  }, [
    groupId,
    listOpacity,
    hasLocalMessagesForGroup,
    currentGroup?.id,
  ]);

  // חשיפת רשימה בנתיב קר כשיש הודעות / ריק מאושר.
  // Warm path כבר נחשף ב-layout — כאן רק fallback.
  useEffect(() => {
    if (messagesRevealedRef.current) return;
    if (!messagesListReady) return;
    if (displayMessages.length === 0) {
      if (!isLoadingMessages && currentGroup?.id === groupId) revealMessages();
      return;
    }
    if (currentGroup?.id !== groupId && !hasLocalMessagesForGroup) return;

    // Unread: לא חוסמים חשיפה — גלילה למפריד רצה ברקע אחרי paint
    const t = requestAnimationFrame(() => requestRevealMessages());
    return () => cancelAnimationFrame(t);
  }, [
    messagesListReady,
    displayMessages.length,
    isLoadingMessages,
    currentGroup?.id,
    groupId,
    hasLocalMessagesForGroup,
    revealMessages,
    requestRevealMessages,
  ]);

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
      // Cleared after load — removed/left → reset to list (no nested chat screens)
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'ChatGroupsList' }],
        })
      );
    }
  }, [currentGroup, isLoadingMessages, groupId, navigation]);

  // רענון הודעות רק כשחוזרים למסך (לא בהתמקדות הראשונה).
  // ביציאה מהצ'אט — מסמנים כנקרא (badge ברשימה + last_read), גם אם המשתמש
  // היה על מפריד ה-unread ולא הגיע לתחתית (WhatsApp-like clear-on-leave).
  const isFirstFocusRef = useRef(true);
  useEffect(() => {
    isFirstFocusRef.current = true;
  }, [groupId]);
  useFocusEffect(
    useCallback(() => {
      if (!groupId || !user) return;
      const focusedGroupId = groupId;
      if (isFirstFocusRef.current) {
        isFirstFocusRef.current = false;
        // useLayoutEffect כבר קרא ל-selectGroup בכניסה הראשונה
      } else if (messagesRef.current.length > 0) {
        void refreshCurrentGroupDetails();
      } else {
        void selectGroup(groupId);
      }
      return () => {
        // חשוב: groupId מה-closure — לא currentGroupId (שכבר יכול להיות קבוצה אחרת)
        void confirmReadRef.current(focusedGroupId);
        // מפסיק chat_active_viewers — אחרת השרת מדלג על unread אחרי חזרה לרשימה
        leaveChatScreenRef.current(focusedGroupId);
      };
      // selectGroup/refresh יציבים מ-useChatActions — לא להכניס ל-deps
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupId, user?.id]),
  );

  useEffect(() => {
    if (!scrollToMessageId) return;
    const timer = setTimeout(() => handleJumpToMessage(scrollToMessageId), 400);
    return () => clearTimeout(timer);
  }, [scrollToMessageId, handleJumpToMessage, groupId]);

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

    // displayMessages (messagesRef) — לא context `messages` בלבד:
    // בכניסה חמה הרשימה מגיעה מ-cache לפני ש-selectGroup ממלא את ה-context;
    // חיפוש ב-messages בלבד מחזיר undefined והריאקציה נבלעת בשקט.
    const message =
      messagesRef.current.find((m) => m.id === currentMessageId) ||
      messages.find((m) => m.id === currentMessageId);
    if (!message) return;

    // מחכים לסגירת Modal השיט לפני פתיחת ReactionPicker — אחרת שני שיטים נלחמים.
    const actionDelayMs =
      action === 'openReactionPicker' ? SHEET_CLOSE_MS + 80 : 300;

    setTimeout(() => {
      switch (action) {
        case 'react':
          if (payload?.emoji) {
            handleReactionPress(message, payload.emoji);
          }
          break;
        case 'openReactionPicker':
          handleOpenReactionPicker(message);
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
        case 'info':
          handleMessageInfo(message);
          break;
        case 'retry':
          void retrySendMessage(message.id);
          break;
      }
    }, actionDelayMs);
  };

  const handleOpenReactionPicker = (message: ChatMessageType) => {
    // "+" → שיט אימוג'ים (חיפוש + קטגוריות) כמו וואטסאפ — לא מקלדת מערכת.
    setSelectedMessageForReaction(message);
    setReactionPickerVisible(true);
  };

  const handleReactionSelected = async (emoji: string) => {
    const target = selectedMessageForReaction;
    if (!target) return;
    setSelectedMessageForReaction(null);
    setReactionPickerVisible(false);
    await handleReactionPress(target, emoji);
  };

  const handleReply = useCallback((message: ChatMessageType) => {
    setReplyTo({
      id: message.id,
      senderName: message.sender?.display_name || 'משתמש',
      content: message.content || '',
      messageType: message.message_type,
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
    const headerGroup = currentGroup?.id === groupId ? currentGroup : shellGroup;
    if (!headerGroup) return null;

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

    const typingNames = typingUsers.map(
      (t) => t.user?.display_name || (t as any).userName || 'מישהו',
    );
    const typingLabel =
      typingNames.length === 0
        ? null
        : typingNames.length === 1
        ? `${typingNames[0]} מקליד...`
        : typingNames.length === 2
        ? `${typingNames[0]} ו${typingNames[1]} מקלידים...`
        : `${typingNames[0]} ועוד ${typingNames.length - 1} מקלידים...`;

    const center = (
      <TouchableOpacity style={styles.headerContent} onPress={handleGroupInfoPress} activeOpacity={0.7}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {headerGroup.name}
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
    if (unreadDividerPhase === 'hidden') return false;
    const info = unreadDividerSnapshotRef.current;
    if (!info || info.count <= 0 || !info.lastReadMessageId) return false;
    const lastReadIdx = messagesRef.current.findIndex(
      (m) => m.id === info.lastReadMessageId,
    );
    if (lastReadIdx <= 0) return false;
    const firstUnreadIdx = lastReadIdx - 1;
    return index === firstUnreadIdx && messagesRef.current[firstUnreadIdx]?.id === messageId;
  }, [unreadDividerPhase]);

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
      // מרווח גדול בגבול מול older — מוחל כ-marginTop בתוך ChatMessage (inverted)
      const isAfterSenderChange =
        !!olderMessage && olderMessage.sender_id !== item.sender_id;
      const showDivider = shouldShowDateDivider(item, olderMessage);
      const dividerInfo = unreadDividerSnapshotRef.current;

      // מנפישים רק את ההודעה החדשה ביותר (index 0) אם לא נראתה עדיין —
      // לא היסטוריה בטעינה ולא פריטים שממוחזרים בגלילה.
      let animateEntrance = false;
      if (animBaselineSeededRef.current && index === 0 && !animatedMsgIdsRef.current.has(item.id)) {
        animateEntrance = true;
      }
      if (index === 0) animatedMsgIdsRef.current.add(item.id);

      return (
        <ChatListRow
            message={item}
            animateEntrance={animateEntrance}
            isMe={isMe}
            showAvatar={showAvatar}
            showSenderName={showSenderName}
          isAfterSenderChange={isAfterSenderChange}
          showDateDivider={showDivider}
          dateDividerLabel={showDivider ? formatDateDivider(new Date(item.created_at)) : ''}
          showUnreadDivider={shouldShowUnreadDivider(item.id, index)}
          unreadCount={dividerInfo?.count || 0}
          unreadDividerDismissing={unreadDividerPhase === 'fading'}
          onUnreadDividerDismissed={handleUnreadDividerDismissed}
          isHighlighted={item.id === highlightedMessageId}
          boldText={isAnnouncementGroup}
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
      unreadDividerPhase,
      isAnnouncementGroup,
      handleMessageLongPress,
      handleReply,
      handleReactionPress,
      handleReactionDetailsPress,
      handleJumpToMessage,
      handleUnreadDividerDismissed,
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
  // Warm cache: אין skeleton. רק cold path (אין הודעות מקומיות) מציג placeholder.
  const awaitingLocalThread =
    !hasLocalMessagesForGroup &&
    (displayMessages.length === 0 ||
      (currentGroup != null && currentGroup.id !== groupId && !cachedSeedMessages.length));
  const isEmptyConfirmed =
    messagesListReady &&
    messagesRevealed &&
    !isLoadingMessages &&
    !awaitingLocalThread &&
    displayMessages.length === 0;
  const showMessagesSkeleton = !messagesRevealed && !isEmptyConfirmed && !hasLocalMessagesForGroup;
  const showMessagesPlaceholder = showMessagesSkeleton || isEmptyConfirmed;
  const renderMessagesPlaceholder = () => {
    if (isEmptyConfirmed) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color={DesignTokens.colors.text.tertiary} />
          <Text style={styles.emptyText}>אין הודעות עדיין</Text>
          <Text style={styles.emptySubtext}>תתחיל שיחה!</Text>
        </View>
      );
    }
    if (showMessagesSkeleton) {
      return (
        <View style={styles.messagesSkeleton}>
          {[
            { isMe: false, w: '60%' }, { isMe: true, w: '45%' },
            { isMe: false, w: '75%' }, { isMe: false, w: '50%' },
            { isMe: true, w: '55%' }, { isMe: true, w: '35%' },
            { isMe: false, w: '65%' }, { isMe: false, w: '40%' },
            { isMe: true, w: '70%' }, { isMe: false, w: '55%' },
            { isMe: false, w: '45%' }, { isMe: true, w: '60%' },
            { isMe: false, w: '70%' }, { isMe: true, w: '40%' },
            { isMe: false, w: '50%' }, { isMe: true, w: '65%' },
          ].map((s, i) => (
            <SkeletonBubble key={i} isMe={s.isMe} width={s.w as any} delay={i * 60} />
          ))}
        </View>
      );
    }
    return null;
  };

  // Up to 3 concurrent typers with their avatars (each cleared independently by
  // ChatContext's per-user staleness logic). Memoised so the bubble only
  // re-renders when the set of typers actually changes.
  const typingTypers = useMemo(() => {
    return typingUsers.slice(0, 3).map((tu) => {
      let avatar: string | null = null;
      if ((tu.user as any)?.profile_picture) {
        avatar = (tu.user as any).profile_picture;
      } else if (currentGroup?.members) {
        const member = currentGroup.members.find((m) => m.user_id === tu.user_id);
        avatar = member?.user?.profile_picture || null;
      }
      return { id: tu.user_id, avatar };
    });
  }, [typingUsers, currentGroup]);

  if (!groupId) return null;

  if (!shellGroup) {
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
      <TypingIndicatorBubble
        visible={typingUsers.length > 0}
        typers={typingTypers}
        styles={styles}
        iconColor={DesignTokens.colors.text.secondary}
      />
      {isAnnouncementGroup && !canSendInAnnouncements ? (
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

      {/* Offline banner hidden globally per product decision */}

      <View style={styles.messagesSection}>
        <View style={styles.messagesAreaFlex}>
          <RNAnimated.View style={[styles.flatListTransparent, { opacity: listOpacity }]}>
          <ChatKeyboardFollow bottomInset={composerPaddingBottom} style={styles.flatListTransparent}>
          <Reanimated.View
            style={[
              styles.flatListTransparent,
              CHAT_KEYBOARD_LTR_STYLE,
              Platform.OS === 'android' ? listFollowStyle : null,
            ]}
          >
          <FlatList
            ref={listRef}
            data={messagesListReady || hasLocalMessagesForGroup ? displayMessages : []}
          inverted
          // NativeWind 4.1.x שבר scrollTo* ב-RN 0.81; cssInterop=false = FlatList מקורי
          {...({ cssInterop: false } as object)}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          extraData={flatListExtraData}
          ListFooterComponent={renderFooter}
            scrollEnabled
            bounces
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={initialListRender}
            maxToRenderPerBatch={listMaxBatch}
          windowSize={listWindowSize}
          updateCellsBatchingPeriod={Platform.OS === 'android' ? 50 : 30}
            // inverted + clipping עלול לחתוך תאים; iOS נהנה מ-false יציב יותר עם window קטן
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
          </ChatKeyboardFollow>
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

      {/* FAB מעל הקומפוזר — אותו UICard glass/light כמו ChatInput + clip עיגול */}
      {showScrollToBottomButton && !keyboardShown && (
        <View
          pointerEvents="box-none"
          style={[
            styles.scrollFabAbsolute,
            { bottom: Math.max(composerHeight + 8, 80) },
          ]}
        >
          <View style={styles.scrollFabClip}>
            <UICard
              variant="glass"
              glassIntensity="light"
              padding="none"
              onPress={() => scrollToBottom(true)}
              accessibilityLabel="גלול להודעות האחרונות"
              style={styles.scrollFabCircle}
              contentContainerStyle={styles.scrollFabInner}
            >
              <Ionicons
                name="chevron-down"
                size={16}
                color={DesignTokens.colors.text.primary}
              />
            </UICard>
          </View>
          {(initialUnreadInfo?.count ?? 0) > 0 && (
            <View style={styles.scrollBadge} pointerEvents="none">
              <Text style={styles.scrollBadgeText}>
                {initialUnreadInfo!.count > 99 ? '99+' : initialUnreadInfo!.count}
              </Text>
            </View>
          )}
        </View>
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
// Typing Indicator Bubble — smooth enter/exit (fade + slight scale/slide).
// Stays mounted through the exit animation, then unmounts. The bouncing dots
// (FadingDot) are intentionally left untouched.
// ============================================

const TypingIndicatorBubble = React.memo(({
  visible,
  typers,
  styles,
  iconColor,
}: {
  visible: boolean;
  typers: { id: string; avatar: string | null }[];
  styles: any;
  iconColor: string;
}) => {
  const anim = useRef(new RNAnimated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  // Freeze the last known typers so avatars don't disappear/flip mid-exit.
  const lastTypersRef = useRef(typers);
  if (visible && typers.length > 0) lastTypersRef.current = typers;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      RNAnimated.timing(anim, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      RNAnimated.timing(anim, {
        toValue: 0,
        duration: 240,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, anim]);

  if (!mounted) return null;

  const shownTypers = lastTypersRef.current;
  const multiple = shownTypers.length > 1;

  return (
    <RNAnimated.View
      style={[
        styles.typingIndicatorContainer,
        {
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
          ],
        },
      ]}
    >
      <View style={styles.typingAvatarStack}>
        {shownTypers.map((t, idx) => {
          const ring = multiple ? styles.typingAvatarRing : null;
          const overlap = idx > 0 ? styles.typingAvatarStacked : null;
          return t.avatar ? (
            <Image
              key={t.id}
              source={{ uri: t.avatar }}
              style={[styles.typingAvatar, ring, overlap]}
              resizeMode="cover"
            />
          ) : (
            <View key={t.id} style={[styles.typingAvatarPlaceholder, ring, overlap]}>
              <Ionicons name="person" size={13} color={iconColor} />
            </View>
          );
        })}
      </View>
      <BlurView
        intensity={Platform.OS === 'ios' ? 50 : 25}
        tint="dark"
        style={styles.typingBubble}
      >
        <View style={[StyleSheet.absoluteFill, styles.typingBubbleOverlay]} />
        <View style={styles.typingDots}>
          <FadingDot delay={0} dotStyle={styles.typingDot} />
          <FadingDot delay={200} dotStyle={styles.typingDot} />
          <FadingDot delay={400} dotStyle={styles.typingDot} />
        </View>
      </BlurView>
    </RNAnimated.View>
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

  /* ── Typing indicator (mid size between original and shrunk) ── */
  typingIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingTop: 5,
    // Lift the bubble clearly higher, away from the composer.
    marginBottom: 17,
    gap: 7,
  },
  typingAvatarStack: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  typingAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  typingAvatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: tokens.colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Overlap subsequent avatars when several people type at once.
  typingAvatarStacked: {
    marginStart: -12,
  },
  // Ring around stacked avatars so overlapping ones stay visually separated.
  typingAvatarRing: {
    borderWidth: 1.75,
    borderColor: tokens.colors.background.primary,
  },
  // Glass bubble (same recipe as ReactionBar / chat glass cards): BlurView +
  // translucent overlay + hairline border. Shape matches an incoming
  // ("theirBubble") bubble: notch at the bottom-leading corner.
  typingBubble: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    minHeight: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    borderBottomLeftRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: chatPalette.glassBorderStrong,
    overflow: 'hidden',
  },
  typingBubbleOverlay: {
    backgroundColor: chatPalette.glass,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    borderBottomLeftRadius: 2,
  },
  typingDots: {
    flexDirection: 'row',
    gap: 3.5,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
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
  messagesSkeleton: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
    justifyContent: 'flex-end',
  },
  scrollFabAbsolute: {
    position: 'absolute',
    right: 12,
    zIndex: 9999,
    elevation: 30,
    width: 32,
    height: 32,
  },
  // Clip קשיח כמו DayNavBlurButton — BlurView נשאר עיגול מלא.
  scrollFabClip: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    flexShrink: 0,
  },
  // UICard glass/light — אותו מתכון כמו ChatInput / כפתורי הכותרת.
  scrollFabCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
  },
  scrollFabInner: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: tokens.colors.primary.main,
    borderWidth: 1.5,
    borderColor: tokens.colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    zIndex: 2,
    elevation: 4,
  },
  scrollBadgeText: {
    color: tokens.colors.text.inverse,
    fontSize: 9,
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
