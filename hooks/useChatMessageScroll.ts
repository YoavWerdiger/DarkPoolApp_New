import { useCallback, useRef } from 'react';
import { InteractionManager, type FlatList } from 'react-native';
import { HapticFeedback } from '../utils/hapticFeedback';
import { logger } from '../utils/logger';
import type { ChatMessage } from '../types/chat.types';

const DEFAULT_ITEM_HEIGHT = 96;
const MAX_SCROLL_RETRIES = 12;

type LoadAroundFn = (messageId: string) => Promise<{ success: boolean; error?: string }>;

interface UseChatMessageScrollOptions {
  listRef: React.RefObject<FlatList<ChatMessage> | null>;
  messagesRef: React.MutableRefObject<ChatMessage[]>;
  distFromBottomRef: React.MutableRefObject<number>;
  programmaticScrollRef: React.MutableRefObject<boolean>;
  isMountedRef: React.MutableRefObject<boolean>;
  loadMessagesAround: LoadAroundFn;
  onHighlight: (messageId: string | null) => void;
}

/** FlatList inverted: offsetY≈0 = תחתית (הודעות חדשות), scrollToOffset(0) */
export function useChatMessageScroll({
  listRef,
  messagesRef,
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

      try {
        list.scrollToIndex({ index, animated, viewPosition: 0.5 });
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
        flashHighlight(messageId);
        return;
      }

      if (scrollRetryRef.current < MAX_SCROLL_RETRIES) {
        scrollRetryRef.current += 1;
        setTimeout(() => attemptScroll(messageId, animated), 120 + scrollRetryRef.current * 80);
      } else {
        pendingScrollIdRef.current = null;
        flashHighlight(messageId);
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
    (messageId: string, animated = true) => {
      pendingScrollIdRef.current = messageId;
      scrollRetryRef.current = 0;

      InteractionManager.runAfterInteractions(() => {
        requestAnimationFrame(() => attemptScroll(messageId, animated));
      });
    },
    [attemptScroll]
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

      const go = (useAnimation: boolean) => {
        const current = listRef.current;
        if (!current) return;
        // inverted + data[0]=newest → index 0 / offset 0 = תחתית ויזואלית
        try {
          current.scrollToIndex({ index: 0, animated: useAnimation, viewPosition: 0 });
        } catch {
          current.scrollToOffset({ offset: 0, animated: useAnimation });
        }
      };

      InteractionManager.runAfterInteractions(() => {
        go(animated);
        requestAnimationFrame(() => {
          go(false);
          distFromBottomRef.current = 0;
          logger.info(
            'useChatMessageScroll',
            `scrollToBottom done dist=${distFromBottomRef.current.toFixed(0)} nearBottom=true`,
          );
        });
      });
    },
    [distFromBottomRef, isMountedRef, listRef, messagesRef, programmaticScrollRef]
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

  return {
    handleJumpToMessage,
    handleScrollToIndexFailed,
    handleContentSizeChange,
    onMessageCellLayout,
    scrollToBottom,
  };
}
