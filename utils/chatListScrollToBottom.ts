import type { RefObject, MutableRefObject } from 'react';
import type { FlatList } from 'react-native';
import type { ChatMessage } from '../types/chat.types';
import { logger } from './logger';

export type ChatListRef = FlatList<ChatMessage>;

export type ScrollRefs = {
  listRef: RefObject<ChatListRef | null>;
  contentHeightRef: MutableRefObject<number>;
  layoutHeightRef: MutableRefObject<number>;
  getDistFromBottom?: () => number;
  getScrollEpoch?: () => number;
};

export type ScrollToBottomRetryOptions = {
  maxAttempts?: number;
  startDist?: number;
  onDone?: (result: { maxOffset: number; reachedBottom: boolean }) => void;
};

const BOTTOM_REACHED_PX = 80;

/**
 * הפקודה האמינה היחידה ל-inverted FlatList (data[0]=חדש):
 * scrollToOffset({ offset: 0 }). בלי scrollToIndex / native scrollTo / offset:1 —
 * שילובים האלה נלחמים זה בזה ב-RN 0.81 ונבלעים.
 */
export function forceInvertedListToBottom(list: ChatListRef, animated: boolean): void {
  try {
    list.scrollToOffset({ offset: 0, animated });
  } catch (e) {
    logger.debug('chatListScrollToBottom', `SCROLL_CMD scrollToOffset(0) threw: ${String(e)}`);
  }
}

/**
 * גלילה לתחתית עם ניסיונות מרווחים — רק scrollToOffset(0).
 * מדווח SCROLL_RESULT עם לפני/אחרי.
 */
export function scrollChatListToBottom(
  refs: ScrollRefs,
  messageCount: number,
  animated: boolean,
  _maxOffsetHint?: number,
  retryOptions?: ScrollToBottomRetryOptions,
): number {
  const list = refs.listRef.current;
  const startDist = retryOptions?.startDist ?? refs.getDistFromBottom?.() ?? -1;

  if (!list || messageCount <= 0) {
    logger.debug(
      'chatListScrollToBottom',
      `SCROLL_RESULT abort hasList=${!!list} count=${messageCount}`,
    );
    retryOptions?.onDone?.({
      maxOffset: Math.max(0, refs.contentHeightRef.current - refs.layoutHeightRef.current),
      reachedBottom: false,
    });
    return 0;
  }

  logger.debug(
    'chatListScrollToBottom',
    `SCROLL_CMD start distBefore=${Number(startDist).toFixed(0)} animated=${animated} count=${messageCount}`,
  );

  forceInvertedListToBottom(list, animated);

  if (!retryOptions) {
    requestAnimationFrame(() => {
      refs.listRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
    setTimeout(() => {
      refs.listRef.current?.scrollToOffset({ offset: 0, animated: false });
    }, 80);
    setTimeout(() => {
      refs.listRef.current?.scrollToOffset({ offset: 0, animated: false });
    }, 220);
    return 0;
  }

  const maxAttempts = retryOptions.maxAttempts ?? 10;
  let attempts = 0;
  let finished = false;

  const finish = (reachedBottom: boolean) => {
    if (finished) return;
    finished = true;
    const distAfter = refs.getDistFromBottom?.() ?? -1;
    const maxOffset = Math.max(
      0,
      refs.contentHeightRef.current - refs.layoutHeightRef.current,
    );
    logger.debug(
      'chatListScrollToBottom',
      `SCROLL_RESULT distBefore=${Number(startDist).toFixed(0)} distAfter=${Number(distAfter).toFixed(0)} reached=${reachedBottom} attempts=${attempts}`,
    );
    retryOptions.onDone?.({ maxOffset, reachedBottom });
  };

  const tick = () => {
    if (finished) return;
    const current = refs.listRef.current;
    if (!current) {
      finish(false);
      return;
    }

    attempts += 1;
    // ניסיונות חוזרים תמיד בלי אנימציה — אמין יותר
    forceInvertedListToBottom(current, attempts === 1 ? animated : false);

    const dist = refs.getDistFromBottom?.() ?? Number.POSITIVE_INFINITY;
    if (dist <= BOTTOM_REACHED_PX) {
      // נותנים פריים ל-onScroll להתייצב ואז מסיימים
      requestAnimationFrame(() => finish(true));
      return;
    }

    if (attempts >= maxAttempts) {
      // ניסיון אחרון ואז מדווחים לפי dist בפועל (בלי לשקר)
      forceInvertedListToBottom(current, false);
      setTimeout(() => {
        const finalDist = refs.getDistFromBottom?.() ?? Number.POSITIVE_INFINITY;
        finish(finalDist <= BOTTOM_REACHED_PX);
      }, 50);
      return;
    }

    setTimeout(tick, 40 + attempts * 30);
  };

  // מתחילים אחרי פריים — הרשימה מספיקה לספוג את הלחיצה
  requestAnimationFrame(() => {
    setTimeout(tick, 16);
  });

  return 0;
}

export function scrollChatListToBottomAfterInteractions(
  refs: ScrollRefs,
  messageCount: number,
  animated: boolean,
  maxOffsetHint?: number,
): void {
  scrollChatListToBottom(refs, messageCount, animated, maxOffsetHint);
}
