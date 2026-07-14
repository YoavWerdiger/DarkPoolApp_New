import { useCallback, useRef } from 'react';
import { InteractionManager } from 'react-native';
import { HapticFeedback } from '../utils/hapticFeedback';
import { logger } from '../utils/logger';
import type { ChatMessage } from '../types/chat.types';
import {
  forceInvertedListToBottom,
  scrollChatListToBottom,
  type ChatListRef,
} from '../utils/chatListScrollToBottom';

const DEFAULT_ITEM_HEIGHT = 96;
const MAX_SCROLL_RETRIES = 16;
/** כמה ניסיונות תיקון גם אחרי שנראה שהפקודה "הצליחה" (inverted + virtualization) */
const POST_SUCCESS_CORRECTIONS = 4;

type LoadAroundFn = (messageId: string) => Promise<{ success: boolean; error?: string }>;

interface UseChatMessageScrollOptions {
  listRef: React.RefObject<ChatListRef | null>;
  messagesRef: React.MutableRefObject<ChatMessage[]>;
  contentHeightRef: React.MutableRefObject<number>;
  layoutHeightRef: React.MutableRefObject<number>;
  distFromBottomRef: React.MutableRefObject<number>;
  programmaticScrollRef: React.MutableRefObject<boolean>;
  isMountedRef: React.MutableRefObject<boolean>;
  loadMessagesAround: LoadAroundFn;
  onHighlight: (messageId: string | null) => void;
  maxScrollOffsetRef?: React.MutableRefObject<number>;
}

/** FlatList inverted: index 0 = הודעה חדשה, scrollToOffset(0) = תחתית */
export function useChatMessageScroll({
  listRef,
  messagesRef,
  contentHeightRef,
  layoutHeightRef,
  distFromBottomRef,
  programmaticScrollRef,
  isMountedRef,
  loadMessagesAround,
  onHighlight,
  maxScrollOffsetRef,
}: UseChatMessageScrollOptions) {
  const pendingScrollIdRef = useRef<string | null>(null);
  const scrollRetryRef = useRef(0);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const averageItemHeightRef = useRef(DEFAULT_ITEM_HEIGHT);
  const itemHeightsRef = useRef<Map<string, number>>(new Map());
  const scrollViewPositionRef = useRef(0.5);
  const scrollHighlightRef = useRef(true);
  const highlightAppliedForRef = useRef<string | null>(null);

  const clearHighlightTimer = useCallback(() => {
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }
  }, []);

  const flashHighlight = useCallback(
    (messageId: string) => {
      onHighlight(messageId);
      clearHighlightTimer();
      highlightTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) onHighlight(null);
        highlightAppliedForRef.current = null;
      }, 2200);
    },
    [clearHighlightTimer, isMountedRef, onHighlight]
  );

  const findMessageIndex = useCallback(
    (messageId: string) => messagesRef.current.findIndex((m) => m.id === messageId),
    [messagesRef]
  );

  const estimateOffsetForIndex = useCallback((index: number) => {
    const msgs = messagesRef.current;
    let offset = 0;
    for (let i = 0; i < index; i++) {
      const id = msgs[i]?.id;
      offset += id ? itemHeightsRef.current.get(id) ?? averageItemHeightRef.current : averageItemHeightRef.current;
    }
    return Math.max(0, offset);
  }, [messagesRef]);

  const itemLengthAt = useCallback(
    (index: number) => {
      const id = messagesRef.current[index]?.id;
      return id
        ? itemHeightsRef.current.get(id) ?? averageItemHeightRef.current
        : averageItemHeightRef.current;
    },
    [messagesRef],
  );

  /** offset שמביא את הפריט ל-viewPosition היחסי ב-viewport */
  const targetOffsetForIndex = useCallback(
    (index: number, viewPosition: number) => {
      const raw = estimateOffsetForIndex(index);
      const itemH = itemLengthAt(index);
      const layoutH = layoutHeightRef.current;
      if (layoutH <= 0) return raw;
      return Math.max(0, raw - layoutH * viewPosition + itemH * viewPosition);
    },
    [estimateOffsetForIndex, itemLengthAt, layoutHeightRef],
  );

  /**
   * גלילה אמינה לפריט ב-inverted FlatList:
   * scrollToIndex לבד לעיתים "מצליח" בלי לזוז — לכן offset מחושב אחרון (מנצח).
   */
  const scrollToIndexNow = useCallback(
    (index: number, animated: boolean): void => {
      const list = listRef.current;
      if (!list || index < 0) return;

      const viewPosition = scrollViewPositionRef.current;
      const offset = targetOffsetForIndex(index, viewPosition);

      try {
        list.scrollToIndex({ index, animated, viewPosition });
      } catch {
        /* noop — ממשיכים ל-offset */
      }

      try {
        list.scrollToOffset({ offset, animated });
      } catch {
        /* noop */
      }

      try {
        const responder = (
          list as unknown as {
            getScrollResponder?: () => { scrollTo?: (p: { y: number; animated: boolean }) => void } | null;
          }
        ).getScrollResponder?.();
        responder?.scrollTo?.({ y: offset, animated });
      } catch {
        /* noop */
      }

      // קריאה חוזרת לאנימציה — RN 0.81 inverted לעיתים בולע את הראשונה
      if (!animated) {
        requestAnimationFrame(() => {
          try {
            listRef.current?.scrollToOffset({ offset, animated: false });
          } catch {
            /* noop */
          }
        });
      }
    },
    [listRef, targetOffsetForIndex]
  );

  const attemptScroll = useCallback(
    (messageId: string, animated = true) => {
      if (!isMountedRef.current) return;
      if (pendingScrollIdRef.current !== messageId) return;

      const index = findMessageIndex(messageId);
      if (index === -1) {
        if (scrollRetryRef.current < MAX_SCROLL_RETRIES) {
          scrollRetryRef.current += 1;
          setTimeout(() => attemptScroll(messageId, animated), 80 + scrollRetryRef.current * 40);
        } else {
          pendingScrollIdRef.current = null;
          logger.warn('useChatMessageScroll', `Message ${messageId} not found after retries`);
        }
        return;
      }

      scrollToIndexNow(index, animated && scrollRetryRef.current === 0);

      if (scrollHighlightRef.current && highlightAppliedForRef.current !== messageId) {
        highlightAppliedForRef.current = messageId;
        flashHighlight(messageId);
      }

      scrollRetryRef.current += 1;

      // ממשיכים לתקן כמה פעמים — scrollToIndex "מצליח" גם כשהפריט מחוץ לחלון
      if (scrollRetryRef.current < POST_SUCCESS_CORRECTIONS) {
        setTimeout(() => attemptScroll(messageId, false), 60 + scrollRetryRef.current * 50);
        return;
      }

      pendingScrollIdRef.current = null;
      scrollRetryRef.current = 0;
      logger.debug('useChatMessageScroll', `jump done id=${messageId} index=${index}`);
    },
    [findMessageIndex, flashHighlight, isMountedRef, scrollToIndexNow]
  );

  const handleScrollToIndexFailed = useCallback(
    (info: { index: number; averageItemLength: number }) => {
      const list = listRef.current;
      if (!list) return;

      averageItemHeightRef.current = Math.round(info.averageItemLength) || DEFAULT_ITEM_HEIGHT;
      const offset = targetOffsetForIndex(info.index, scrollViewPositionRef.current);
      try {
        list.scrollToOffset({ offset, animated: false });
      } catch {
        /* noop */
      }

      const pendingId = pendingScrollIdRef.current;
      if (pendingId) {
        setTimeout(() => attemptScroll(pendingId, true), 80);
      }
    },
    [attemptScroll, listRef, targetOffsetForIndex]
  );

  const queueScrollToMessage = useCallback(
    (
      messageId: string,
      animated = true,
      options?: { viewPosition?: number; highlight?: boolean },
    ) => {
      scrollViewPositionRef.current = options?.viewPosition ?? 0.5;
      scrollHighlightRef.current = options?.highlight ?? true;
      pendingScrollIdRef.current = messageId;
      scrollRetryRef.current = 0;
      // לא מאפסים highlight קיים לאותה הודעה (jump כבר עשה flash מיידי)
      if (highlightAppliedForRef.current !== messageId) {
        highlightAppliedForRef.current = null;
      }
      programmaticScrollRef.current = true;

      // מיידי — לא מחכים ל-InteractionManager (עלול להיתקע אחרי gesture)
      requestAnimationFrame(() => attemptScroll(messageId, animated));
      InteractionManager.runAfterInteractions(() => {
        if (pendingScrollIdRef.current === messageId) {
          attemptScroll(messageId, false);
        }
      });
      setTimeout(() => {
        programmaticScrollRef.current = false;
      }, 900);
    },
    [attemptScroll, programmaticScrollRef]
  );

  /** גלילה להודעה (למשל last-read בפתיחת צ'אט עם unread) */
  const scrollToMessageInView = useCallback(
    (
      messageId: string,
      options?: { viewPosition?: number; animated?: boolean; highlight?: boolean },
    ) => {
      if (!messageId || !isMountedRef.current) return;
      queueScrollToMessage(messageId, options?.animated ?? false, {
        viewPosition: options?.viewPosition ?? 0.5,
        highlight: options?.highlight ?? false,
      });
    },
    [queueScrollToMessage, isMountedRef],
  );

  const waitForMessageInList = useCallback(
    async (messageId: string, maxMs = 2500): Promise<number> => {
      const started = Date.now();
      while (Date.now() - started < maxMs) {
        const index = findMessageIndex(messageId);
        if (index !== -1) return index;
        await new Promise((r) => setTimeout(r, 50));
      }
      return -1;
    },
    [findMessageIndex]
  );

  const handleJumpToMessage = useCallback(
    async (messageId: string) => {
      if (!messageId || !isMountedRef.current) return;

      void HapticFeedback.selection();

      // הדגשה מיידית — גם אם הגלילה תתעכב; הגלילה תמשיך ברקע
      flashHighlight(messageId);
      highlightAppliedForRef.current = messageId;

      let index = findMessageIndex(messageId);

      if (index === -1) {
        const result = await loadMessagesAround(messageId);
        if (!result.success || !isMountedRef.current) return;

        index = await waitForMessageInList(messageId);
        if (index === -1 || !isMountedRef.current) return;
      }

      queueScrollToMessage(messageId, true, { highlight: true });
    },
    [
      findMessageIndex,
      flashHighlight,
      isMountedRef,
      loadMessagesAround,
      queueScrollToMessage,
      waitForMessageInList,
    ]
  );

  const scrollToBottom = useCallback(
    (animated = true) => {
      const list = listRef.current;
      const count = messagesRef.current.length;
      if (!list || count === 0) return;

      programmaticScrollRef.current = true;

      const fromDist = distFromBottomRef.current;
      logger.debug(
        'useChatMessageScroll',
        `scrollToBottom animated=${animated} count=${count} dist=${fromDist.toFixed(0)}`,
      );

      forceInvertedListToBottom(list, animated);

      InteractionManager.runAfterInteractions(() => {
        const maxHint = maxScrollOffsetRef?.current;
        scrollChatListToBottom(
          {
            listRef,
            contentHeightRef,
            layoutHeightRef,
            getDistFromBottom: () => distFromBottomRef.current,
          },
          count,
          animated,
          maxHint,
          {
            maxAttempts: 12,
            onDone: () => {
              distFromBottomRef.current = 0;
              programmaticScrollRef.current = false;
            },
          },
        );
      });
    },
    [
      contentHeightRef,
      distFromBottomRef,
      layoutHeightRef,
      listRef,
      maxScrollOffsetRef,
      messagesRef,
      programmaticScrollRef,
    ]
  );

  const handleContentSizeChange = useCallback(() => {
    const pendingId = pendingScrollIdRef.current;
    if (pendingId) {
      attemptScroll(pendingId, true);
    }
  }, [attemptScroll]);

  const onMessageCellLayout = useCallback((messageId: string, height: number) => {
    if (height <= 0) return;
    itemHeightsRef.current.set(messageId, height);

    const heights = Array.from(itemHeightsRef.current.values());
    if (heights.length > 0) {
      averageItemHeightRef.current = Math.round(
        heights.reduce((a, b) => a + b, 0) / heights.length
      );
    }
  }, []);

  const getItemLayout = useCallback(
    (_data: ArrayLike<ChatMessage> | null | undefined, index: number) => {
      const msgs = messagesRef.current;
      let offset = 0;
      for (let i = 0; i < index; i++) {
        const id = msgs[i]?.id;
        offset += id
          ? itemHeightsRef.current.get(id) ?? averageItemHeightRef.current
          : averageItemHeightRef.current;
      }
      const id = msgs[index]?.id;
      const length = id
        ? itemHeightsRef.current.get(id) ?? averageItemHeightRef.current
        : averageItemHeightRef.current;
      return { length, offset, index };
    },
    [messagesRef],
  );

  return {
    handleJumpToMessage,
    handleScrollToIndexFailed,
    handleContentSizeChange,
    onMessageCellLayout,
    getItemLayout,
    scrollToBottom,
    scrollToMessageInView,
    queueScrollToMessage,
  };
}
