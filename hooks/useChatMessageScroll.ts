import { useCallback, useRef } from 'react';
import { InteractionManager } from 'react-native';
import { HapticFeedback } from '../utils/hapticFeedback';
import { logger } from '../utils/logger';
import type { ChatMessage } from '../types/chat.types';
import { scrollChatListToBottom, type ChatListRef } from '../utils/chatListScrollToBottom';

const DEFAULT_ITEM_HEIGHT = 96;
const MAX_SCROLL_RETRIES = 12;

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

  const scrollToIndexNow = useCallback(
    (index: number, animated: boolean): boolean => {
      const list = listRef.current;
      if (!list || index < 0) return false;

      const viewPosition = scrollViewPositionRef.current;
      try {
        list.scrollToIndex({ index, animated, viewPosition });
        return true;
      } catch {
        list.scrollToOffset({ offset: estimateOffsetForIndex(index), animated });
        return false;
      }
    },
    [estimateOffsetForIndex, listRef]
  );

  const attemptScroll = useCallback(
    (messageId: string, animated = true) => {
      if (!isMountedRef.current) return;

      const index = findMessageIndex(messageId);
      if (index === -1) {
        if (scrollRetryRef.current < MAX_SCROLL_RETRIES) {
          scrollRetryRef.current += 1;
          setTimeout(() => attemptScroll(messageId, animated), 80 + scrollRetryRef.current * 60);
        } else {
          pendingScrollIdRef.current = null;
          logger.warn('useChatMessageScroll', `Message ${messageId} not found after retries`);
        }
        return;
      }

      const ok = scrollToIndexNow(index, animated);
      if (ok) {
        pendingScrollIdRef.current = null;
        scrollRetryRef.current = 0;
        if (scrollHighlightRef.current) {
          flashHighlight(messageId);
        }
        return;
      }

      if (scrollRetryRef.current < MAX_SCROLL_RETRIES) {
        scrollRetryRef.current += 1;
        setTimeout(() => attemptScroll(messageId, animated), 120 + scrollRetryRef.current * 80);
      } else {
        pendingScrollIdRef.current = null;
        if (scrollHighlightRef.current) {
          flashHighlight(messageId);
        }
      }
    },
    [findMessageIndex, flashHighlight, isMountedRef, scrollToIndexNow]
  );

  const handleScrollToIndexFailed = useCallback(
    (info: { index: number; averageItemLength: number }) => {
      const list = listRef.current;
      if (!list) return;

      averageItemHeightRef.current = Math.round(info.averageItemLength) || DEFAULT_ITEM_HEIGHT;
      list.scrollToOffset({
        offset: estimateOffsetForIndex(info.index),
        animated: false,
      });

      const pendingId = pendingScrollIdRef.current;
      if (pendingId) {
        setTimeout(() => attemptScroll(pendingId, true), 120);
      }
    },
    [attemptScroll, estimateOffsetForIndex, listRef]
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

      InteractionManager.runAfterInteractions(() => {
        requestAnimationFrame(() => attemptScroll(messageId, animated));
      });
    },
    [attemptScroll]
  );

  /** גלילה להודעה (למשל last-read בפתיחת צ'אט עם unread) */
  const scrollToMessageInView = useCallback(
    (
      messageId: string,
      options?: { viewPosition?: number; animated?: boolean; highlight?: boolean },
    ) => {
      if (!messageId || !isMountedRef.current) return;
      programmaticScrollRef.current = true;
      queueScrollToMessage(messageId, options?.animated ?? false, {
        viewPosition: options?.viewPosition ?? 0.5,
        highlight: options?.highlight ?? false,
      });
      requestAnimationFrame(() => {
        programmaticScrollRef.current = false;
      });
    },
    [programmaticScrollRef, queueScrollToMessage, isMountedRef],
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

      let index = findMessageIndex(messageId);

      if (index === -1) {
        const result = await loadMessagesAround(messageId);
        if (!result.success || !isMountedRef.current) return;

        index = await waitForMessageInList(messageId);
        if (index === -1 || !isMountedRef.current) return;
      }

      queueScrollToMessage(messageId, true);
    },
    [findMessageIndex, isMountedRef, loadMessagesAround, queueScrollToMessage, waitForMessageInList]
  );

  const scrollToBottom = useCallback(
    (animated = true) => {
      const list = listRef.current;
      const count = messagesRef.current.length;
      if (!list || count === 0) return;

      programmaticScrollRef.current = true;

      const fromDist = distFromBottomRef.current;
      logger.info(
        'useChatMessageScroll',
        `scrollToBottom animated=${animated} count=${count} dist=${fromDist.toFixed(0)}`,
      );

      InteractionManager.runAfterInteractions(() => {
        const maxHint = maxScrollOffsetRef?.current;
        scrollChatListToBottom(
          { listRef, contentHeightRef, layoutHeightRef },
          count,
          animated,
          maxHint,
        );
        requestAnimationFrame(() => {
          scrollChatListToBottom(
            { listRef, contentHeightRef, layoutHeightRef },
            count,
            false,
            maxHint,
          );
          distFromBottomRef.current = 0;
          programmaticScrollRef.current = false;
          logger.info(
            'useChatMessageScroll',
            `scrollToBottom done dist=${distFromBottomRef.current.toFixed(0)} nearBottom=true`,
          );
        });
      });
    },
    [
      contentHeightRef,
      distFromBottomRef,
      isMountedRef,
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
