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
  /** מונה שגדל בכל onScroll — מאמת שמד-המרחק התעדכן באמת */
  getScrollEpoch?: () => number;
};

export type ScrollToBottomRetryOptions = {
  maxAttempts?: number;
  /** מרחק לפני תחילת הגלילה — אם גדול, מחייב תזוזה/onScroll לפני הצלחה */
  startDist?: number;
  onDone?: (result: { maxOffset: number; reachedBottom: boolean }) => void;
};

const BOTTOM_REACHED_PX = 80;

type NativeScrollable = {
  scrollTo?: (p: { x?: number; y: number; animated: boolean }) => void;
};

function getNativeScrollable(list: ChatListRef): NativeScrollable | null {
  const anyList = list as unknown as {
    getNativeScrollRef?: () => NativeScrollable | null;
    getScrollResponder?: () => NativeScrollable | null;
  };
  return anyList.getNativeScrollRef?.() ?? anyList.getScrollResponder?.() ?? null;
}

/**
 * inverted FlatList (RN 0.81): קריאה בודדת ל-scrollToOffset(0) לעיתים נבלעת.
 *
 * אסטרטגיה (בלי scrollToIndex — הוא נלחם ב-offset על inverted):
 * 1) jiggle ל-offset 1 כדי לכפות תזוזה ב-native
 * 2) scrollToOffset(0) + native scrollTo({ y: 0 })
 * 3) חיזוק בפריים הבא
 */
export function forceInvertedListToBottom(list: ChatListRef, animated: boolean): void {
  const native = getNativeScrollable(list);

  const goZero = (anim: boolean) => {
    try {
      list.scrollToOffset({ offset: 0, animated: anim });
    } catch {
      /* noop */
    }
    try {
      native?.scrollTo?.({ y: 0, animated: anim });
    } catch {
      /* noop */
    }
  };

  try {
    list.scrollToOffset({ offset: 1, animated: false });
  } catch {
    /* noop */
  }

  goZero(animated);

  requestAnimationFrame(() => {
    goZero(false);
  });
}

function isNearBottom(refs: ScrollRefs): boolean {
  const dist = refs.getDistFromBottom?.();
  if (dist != null && Number.isFinite(dist)) {
    return dist <= BOTTOM_REACHED_PX;
  }
  return false;
}

/**
 * FlatList inverted: data[0]=הודעה חדשה, offset 0 = תחתית המסך.
 *
 * חשוב:
 * - אל תאפסו distFromBottomRef / אל תעשו setState לפני הקריאה
 * - אם startDist כבר ~0 (פתיחת מסך) — מותר succeeded בלי onScroll
 * - אם startDist גדול (FAB) — חובה epoch חדש / ירידה ב-dist
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

  if (!retryOptions) {
    forceInvertedListToBottom(list, animated);
    requestAnimationFrame(() => {
      const again = refs.listRef.current;
      if (again) forceInvertedListToBottom(again, false);
    });
    setTimeout(() => {
      const again = refs.listRef.current;
      if (again) forceInvertedListToBottom(again, false);
    }, 80);
    return 0;
  }

  const maxAttempts = retryOptions.maxAttempts ?? 16;
  const startEpoch = refs.getScrollEpoch?.() ?? 0;
  const needProofOfMovement = startDist > BOTTOM_REACHED_PX;
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
      `SCROLL_RESULT distBefore=${Number(startDist).toFixed(0)} distAfter=${Number(distAfter).toFixed(0)} reached=${reachedBottom} attempts=${attempts} epochΔ=${(refs.getScrollEpoch?.() ?? 0) - startEpoch}`,
    );
    retryOptions.onDone?.({ maxOffset, reachedBottom });
  };

  const canDeclareSuccess = (): boolean => {
    if (!isNearBottom(refs)) return false;
    if (!needProofOfMovement) return true;
    const epoch = refs.getScrollEpoch?.() ?? 0;
    const dist = refs.getDistFromBottom?.() ?? startDist;
    return epoch > startEpoch || dist < startDist - 40;
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

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (finished) return;
        if (canDeclareSuccess()) {
          finish(true);
          return;
        }
        if (attempts >= maxAttempts) {
          const last = refs.listRef.current;
          if (last) forceInvertedListToBottom(last, false);
          setTimeout(() => {
            finish(canDeclareSuccess());
          }, 50);
          return;
        }
        setTimeout(tick, 32 + attempts * 24);
      });
    });
  };

  // פריים אחד — לא מתחרים עם gesture של הלחיצה
  requestAnimationFrame(() => {
    tick();
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
