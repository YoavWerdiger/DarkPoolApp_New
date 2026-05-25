import { useCallback, useRef } from 'react';
import { FlatList, InteractionManager } from 'react-native';
import { HapticFeedback } from '../utils/hapticFeedback';
import { logger } from '../utils/logger';
import type { ChatMessage } from '../types/chat.types';

const DEFAULT_ITEM_HEIGHT = 96;
const MAX_SCROLL_RETRIES = 12;

type LoadAroundFn = (messageId: string) => Promise<{ success: boolean; error?: string }>;

interface UseChatMessageScrollOptions {
  flatListRef: React.RefObject<FlatList<any> | null>;
  messagesRef: React.MutableRefObject<ChatMessage[]>;
  isMountedRef: React.MutableRefObject<boolean>;
  loadMessagesAround: LoadAroundFn;
  onHighlight: (messageId: string | null) => void;
}

export function useChatMessageScroll({
  flatListRef,
  messagesRef,
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

  const estimateOffsetForIndex = useCallback(
    (index: number) => {
      const msgs = messagesRef.current;
      let offset = 0;
      for (let i = 0; i < index; i++) {
        const id = msgs[i]?.id;
        offset += id ? itemHeightsRef.current.get(id) ?? averageItemHeightRef.current : averageItemHeightRef.current;
      }
      return Math.max(0, offset);
    },
    [messagesRef]
  );

  const scrollToIndexNow = useCallback(
    (index: number, animated: boolean): boolean => {
      const list = flatListRef.current;
      if (!list || index < 0) return false;

      try {
        list.scrollToIndex({
          index,
          animated,
          viewPosition: 0.5,
        });
        return true;
      } catch {
        const offset = estimateOffsetForIndex(index);
        list.scrollToOffset({ offset, animated: false });
        return false;
      }
    },
    [estimateOffsetForIndex, flatListRef]
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

  const handleScrollToIndexFailed = useCallback(
    (info: { index: number; averageItemLength: number; highestMeasuredFrameIndex: number }) => {
      if (!isMountedRef.current) return;

      const avg = info.averageItemLength || averageItemHeightRef.current || DEFAULT_ITEM_HEIGHT;
      averageItemHeightRef.current = avg;

      const list = flatListRef.current;
      if (!list) return;

      logger.debug(
        'useChatMessageScroll',
        `scrollToIndexFailed index=${info.index} avg=${avg.toFixed(0)} measured=${info.highestMeasuredFrameIndex}`
      );

      const pendingId = pendingScrollIdRef.current;
      const targetIndex = pendingId != null ? findMessageIndex(pendingId) : info.index;
      const safeIndex = targetIndex >= 0 ? targetIndex : info.index;
      const offset = estimateOffsetForIndex(safeIndex);

      list.scrollToOffset({ offset: Math.max(0, offset - avg * 0.5), animated: false });

      setTimeout(() => {
        if (!isMountedRef.current || !flatListRef.current) return;
        try {
          flatListRef.current.scrollToIndex({
            index: safeIndex,
            animated: true,
            viewPosition: 0.5,
          });
          if (pendingId) {
            pendingScrollIdRef.current = null;
            flashHighlight(pendingId);
          }
        } catch {
          if (pendingId) attemptScroll(pendingId, true);
        }
      }, 100);
    },
    [attemptScroll, estimateOffsetForIndex, findMessageIndex, flashHighlight, flatListRef, isMountedRef]
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
  };
}
