import type { RefObject, MutableRefObject } from 'react';
import type { FlatList } from 'react-native';
import type { ChatMessage } from '../types/chat.types';
import { logger } from './logger';

export type ChatListRef = FlatList<ChatMessage>;

export type ScrollRefs = {
  listRef: RefObject<ChatListRef | null>;
  contentHeightRef: MutableRefObject<number>;
  layoutHeightRef: MutableRefObject<number>;
  /** ב-inverted: מרחק מתחתית = contentOffset.y (0 = בתחתית) */
  getDistFromBottom?: () => number;
};

export type ScrollToBottomRetryOptions = {
  maxAttempts?: number;
  onDone?: (result: { maxOffset: number; reachedBottom: boolean }) => void;
};

const BOTTOM_REACHED_PX = 80;

/**
 * inverted FlatList (RN 0.81): קריאה בודדת ל-scrollToOffset(0) לעיתים נבלעת.
 * שילוב offset + index + scrollResponder כופה נחיתה על ההודעה החדשה ביותר.
 */
export function forceInvertedListToBottom(list: ChatListRef, animated: boolean): void {
  // סדר: index קודם, offset אחרון — offset:0 הוא האמת ב-inverted (index עלול להיות מחוץ למדידה)
  try {
    list.scrollToIndex({ index: 0, animated, viewPosition: 0 });
  } catch {
    /* noop */
  }

  try {
    list.scrollToOffset({ offset: 0, animated });
  } catch {
    /* noop */
  }

  try {
    const responder = (
      list as unknown as {
        getScrollResponder?: () => { scrollTo?: (p: { y: number; animated: boolean }) => void } | null;
      }
    ).getScrollResponder?.();
    responder?.scrollTo?.({ y: 0, animated });
  } catch {
    /* noop */
  }

  requestAnimationFrame(() => {
    try {
      list.scrollToOffset({ offset: 0, animated: false });
    } catch {
      /* noop */
    }
  });
}

function isNearBottom(refs: ScrollRefs): boolean {
  const dist = refs.getDistFromBottom?.();
  if (dist != null && Number.isFinite(dist)) {
    return dist <= BOTTOM_REACHED_PX;
  }
  // בלי מד-מרחק — לא מניחים הצלחה (מונע early-exit אחרי איפוס אופטימיסטי של dist)
  return false;
}

/**
 * FlatList inverted: data[0]=הודעה חדשה, offset 0 = תחתית המסך.
 *
 * חשוב: אל תאפסו distFromBottomRef לפני הקריאה — ה-retry בודק מרחק אמיתי מ-onScroll.
 */
export function scrollChatListToBottom(
  refs: ScrollRefs,
  messageCount: number,
  animated: boolean,
  _maxOffsetHint?: number,
  retryOptions?: ScrollToBottomRetryOptions,
): number {
  const list = refs.listRef.current;
  if (!list || messageCount <= 0) {
    retryOptions?.onDone?.({
      maxOffset: Math.max(0, refs.contentHeightRef.current - refs.layoutHeightRef.current),
      reachedBottom: false,
    });
    return 0;
  }

  if (!retryOptions) {
    forceInvertedListToBottom(list, animated);
    requestAnimationFrame(() => {
      const again = refs.listRef.current;
      if (again) forceInvertedListToBottom(again, false);
    });
    return 0;
  }

  const maxAttempts = retryOptions.maxAttempts ?? 16;
  let attempts = 0;
  let finished = false;

  const finish = (reachedBottom: boolean) => {
    if (finished) return;
    finished = true;
    const maxOffset = Math.max(
      0,
      refs.contentHeightRef.current - refs.layoutHeightRef.current,
    );
    logger.debug(
      'chatListScrollToBottom',
      `done attempts=${attempts} reached=${reachedBottom} dist=${refs.getDistFromBottom?.()?.toFixed(0) ?? '?'}`,
    );
    retryOptions.onDone?.({ maxOffset, reachedBottom });
  };

  const tick = () => {
    if (finished) return;
    const currentList = refs.listRef.current;
    if (!currentList) {
      finish(false);
      return;
    }

    attempts += 1;
    forceInvertedListToBottom(currentList, animated && attempts === 1);

    // ממתינים שני פריימים + tick קצר כדי ש-onScroll יעדכן dist אמיתי
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (finished) return;
        if (isNearBottom(refs)) {
          finish(true);
          return;
        }
        if (attempts >= maxAttempts) {
          // ניסיון אחרון קשיח — ואז מניחים שהפקודה הוחלה גם אם onScroll לא נורה
          const last = refs.listRef.current;
          if (last) forceInvertedListToBottom(last, false);
          logger.debug(
            'chatListScrollToBottom',
            `retry exhausted attempts=${attempts} dist=${refs.getDistFromBottom?.()?.toFixed(0) ?? '?'}`,
          );
          finish(isNearBottom(refs) || true);
          return;
        }
        setTimeout(tick, 32 + attempts * 24);
      });
    });
  };

  tick();
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
