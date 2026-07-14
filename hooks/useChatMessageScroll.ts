import { useCallback, useRef } from 'react';
import { logger } from '../utils/logger';
import { HapticFeedback } from '../utils/hapticFeedback';
import type { ChatMessage } from '../types/chat.types';
import {
  forceInvertedListToBottom,
  type ChatListRef,
} from '../utils/chatListScrollToBottom';

const DEFAULT_ITEM_HEIGHT = 96;
const MAX_FIND_RETRIES = 20;
const JUMP_CORRECTIONS = 10;

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

/**
 * FlatList inverted: index 0 = הודעה חדשה.
 * קפיצה להודעה = רק scrollToOffset עם אומדן גובה (scrollToIndex על inverted ב-RN 0.81 לא אמין).
 */
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

  const estimateOffsetForIndex = useCallback(
    (index: number) => {
      const msgs = messagesRef.current;
      let offset = 0;
      for (let i = 0; i < index; i++) {
        const id = msgs[i]?.id;
        offset += id
          ? itemHeightsRef.current.get(id) ?? averageItemHeightRef.current
          : averageItemHeightRef.current;
      }
      return Math.max(0, offset);
    },
    [messagesRef]
  );

  const targetOffsetForIndex = useCallback(
    (index: number, viewPosition: number) => {
      const raw = estimateOffsetForIndex(index);
      const id = messagesRef.current[index]?.id;
      const itemH = id
        ? itemHeightsRef.current.get(id) ?? averageItemHeightRef.current
        : averageItemHeightRef.current;
      const layoutH = layoutHeightRef.current;
      if (layoutH <= 0) return raw;
      // ממקם את הפריט ב-viewPosition היחסי ב-viewport (אותה מערכת צירים כמו scrollToOffset)
      return Math.max(0, raw - layoutH * viewPosition + itemH * viewPosition);
    },
    [estimateOffsetForIndex, layoutHeightRef, messagesRef]
  );

  const scrollToOffsetNow = useCallback(
    (offset: number, animated: boolean, label: string) => {
      const list = listRef.current;
      if (!list) return;
      const before = distFromBottomRef.current;
      logger.debug(
        'useChatMessageScroll',
        `SCROLL_CMD ${label} offset=${offset.toFixed(0)} animated=${animated} distBefore=${before.toFixed(0)}`,
      );
      try {
        list.scrollToOffset({ offset, animated });
      } catch (e) {
        logger.debug('useChatMessageScroll', `SCROLL_CMD threw: ${String(e)}`);
      }
      requestAnimationFrame(() => {
        const after = distFromBottomRef.current;
        logger.debug(
          'useChatMessageScroll',
          `SCROLL_RESULT ${label} distAfter=${after.toFixed(0)}`,
        );
      });
    },
    [distFromBottomRef, listRef]
  );

  const attemptScroll = useCallback(
    (messageId: string, animated = true) => {
      if (!isMountedRef.current) return;
      if (pendingScrollIdRef.current !== messageId) return;

      const index = findMessageIndex(messageId);
      if (index === -1) {
        if (scrollRetryRef.current < MAX_FIND_RETRIES) {
          scrollRetryRef.current += 1;
          setTimeout(() => attemptScroll(messageId, animated), 60 + scrollRetryRef.current * 40);
        } else {
          pendingScrollIdRef.current = null;
          logger.warn('useChatMessageScroll', `Message ${messageId} not found after retries`);
        }
        return;
      }

      const viewPosition = scrollViewPositionRef.current;
      const offset = targetOffsetForIndex(index, viewPosition);

      logger.debug(
        'useChatMessageScroll',
        `REPLY_JUMP index=${index} id=${messageId} offset=${offset.toFixed(0)} try=${scrollRetryRef.current}`,
      );

      scrollToOffsetNow(offset, animated && scrollRetryRef.current === 0, `jump[${index}]`);

      if (scrollHighlightRef.current && highlightAppliedForRef.current !== messageId) {
        highlightAppliedForRef.current = messageId;
        flashHighlight(messageId);
      }

      scrollRetryRef.current += 1;
      if (scrollRetryRef.current < JUMP_CORRECTIONS) {
        setTimeout(() => attemptScroll(messageId, false), 60 + scrollRetryRef.current * 35);
        return;
      }

      pendingScrollIdRef.current = null;
      scrollRetryRef.current = 0;
      logger.debug('useChatMessageScroll', `REPLY_JUMP done id=${messageId} index=${index}`);
    },
    [
      findMessageIndex,
      flashHighlight,
      isMountedRef,
      scrollToOffsetNow,
      targetOffsetForIndex,
    ]
  );

  const handleScrollToIndexFailed = useCallback(
    (info: { index: number; averageItemLength: number }) => {
      averageItemHeightRef.current = Math.round(info.averageItemLength) || DEFAULT_ITEM_HEIGHT;
      const offset = Math.max(0, info.index * averageItemHeightRef.current);
      logger.debug(
        'useChatMessageScroll',
        `onScrollToIndexFailed index=${info.index} → offset=${offset}`,
      );
      scrollToOffsetNow(offset, false, 'indexFailed');
      const pendingId = pendingScrollIdRef.current;
      if (pendingId) {
        setTimeout(() => attemptScroll(pendingId, false), 80);
      }
    },
    [attemptScroll, scrollToOffsetNow]
  );

  const queueScrollToMessage = useCallback(
    (
      messageId: string,
      animated = true,
      options?: { viewPosition?: number; highlight?: boolean },
    ) => {
      scrollViewPositionRef.current = options?.viewPosition ?? 0.45;
      scrollHighlightRef.current = options?.highlight ?? true;
      pendingScrollIdRef.current = messageId;
      scrollRetryRef.current = 0;
      if (highlightAppliedForRef.current !== messageId) {
        highlightAppliedForRef.current = null;
      }
      programmaticScrollRef.current = true;

      logger.debug('useChatMessageScroll', `queueScrollToMessage id=${messageId}`);

      // מיידי + תיקונים — בלי InteractionManager (נתקע אחרי gesture)
      requestAnimationFrame(() => attemptScroll(messageId, animated));
      setTimeout(() => {
        if (pendingScrollIdRef.current === messageId) attemptScroll(messageId, false);
      }, 100);
      setTimeout(() => {
        if (pendingScrollIdRef.current === messageId) attemptScroll(messageId, false);
      }, 280);
      setTimeout(() => {
        programmaticScrollRef.current = false;
      }, 1400);
    },
    [attemptScroll, programmaticScrollRef]
  );

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
    [queueScrollToMessage, isMountedRef]
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
      logger.info('useChatMessageScroll', `REPLY_PRESS id=${messageId}`);

      flashHighlight(messageId);
      highlightAppliedForRef.current = messageId;

      let index = findMessageIndex(messageId);
      logger.debug(
        'useChatMessageScroll',
        `REPLY_PRESS indexInList=${index} total=${messagesRef.current.length}`,
      );

      if (index === -1) {
        const result = await loadMessagesAround(messageId);
        if (!result.success || !isMountedRef.current) {
          logger.warn('useChatMessageScroll', `REPLY_PRESS loadAround failed id=${messageId}`);
          return;
        }
        index = await waitForMessageInList(messageId);
        if (index === -1 || !isMountedRef.current) {
          logger.warn('useChatMessageScroll', `REPLY_PRESS still missing after load id=${messageId}`);
          return;
        }
      }

      queueScrollToMessage(messageId, true, { highlight: true, viewPosition: 0.35 });
    },
    [
      findMessageIndex,
      flashHighlight,
      isMountedRef,
      loadMessagesAround,
      messagesRef,
      queueScrollToMessage,
      waitForMessageInList,
    ]
  );

  const scrollToBottom = useCallback(
    (animated = true) => {
      const list = listRef.current;
      if (!list || messagesRef.current.length === 0) return;
      programmaticScrollRef.current = true;
      const before = distFromBottomRef.current;
      logger.debug('useChatMessageScroll', `scrollToBottom distBefore=${before.toFixed(0)}`);
      forceInvertedListToBottom(list, animated);
      const settleMs = animated ? 380 : 50;
      setTimeout(() => {
        const current = listRef.current ?? list;
        // fallback קשיח רק אם האנימציה לא הגיעה לתחתית
        if (distFromBottomRef.current > 80) {
          forceInvertedListToBottom(current, false);
        }
      }, settleMs);
      setTimeout(() => {
        if (distFromBottomRef.current > 80) {
          forceInvertedListToBottom(listRef.current ?? list, false);
        }
        programmaticScrollRef.current = false;
      }, animated ? 480 : 220);
    },
    [distFromBottomRef, listRef, messagesRef, programmaticScrollRef]
  );

  const handleContentSizeChange = useCallback(() => {
    const pendingId = pendingScrollIdRef.current;
    if (pendingId) attemptScroll(pendingId, false);
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
      const length =
        itemHeightsRef.current.get(messagesRef.current[index]?.id ?? '') ??
        averageItemHeightRef.current;
      return { length, offset: estimateOffsetForIndex(index), index };
    },
    [estimateOffsetForIndex, messagesRef]
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
