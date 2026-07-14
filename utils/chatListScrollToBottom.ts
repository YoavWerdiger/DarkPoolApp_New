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
  scrollToOffset?: (p: { offset: number; animated: boolean }) => void;
};

function getNativeScrollable(list: ChatListRef): NativeScrollable | null {
  const anyList = list as unknown as {
    getNativeScrollRef?: () => NativeScrollable | null;
    getScrollResponder?: () => NativeScrollable | null;
    getScrollableNode?: () => unknown;
  };
  return anyList.getNativeScrollRef?.() ?? anyList.getScrollResponder?.() ?? null;
}

/**
 * inverted FlatList (RN 0.81): קריאה בודדת ל-scrollToOffset(0) לעיתים נבלעת.
 * כופים נחיתה דרך כמה פרימיטיבים של scroll.
 */
export function forceInvertedListToBottom(list: ChatListRef, animated: boolean): void {
  const native = getNativeScrollable(list);

  // טריק: אם כבר "ב-0" אבל ויזואלית לא — זז מעט ואז חוזר ל-0 כדי לכפות אירוע גלילה
  try {
    list.scrollToOffset({ offset: 1, animated: false });
  } catch {
    /* noop */
  }

  try {
    list.scrollToOffset({ offset: 0, animated });
  } catch {
    /* noop */
  }

  try {
    native?.scrollTo?.({ y: 0, animated });
  } catch {
    /* noop */
  }

  try {
    list.scrollToIndex({ index: 0, animated: false, viewPosition: 0 });
  } catch {
    /* noop */
  }

  requestAnimationFrame(() => {
    try {
      list.scrollToOffset({ offset: 0, animated: false });
      native?.scrollTo?.({ y: 0, animated: false });
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
  return false;
}

/**
 * FlatList inverted: data[0]=הודעה חדשה, offset 0 = תחתית המסך.
 *
 * חשוב:
 * - אל תאפסו distFromBottomRef לפני הקריאה
 * - אם startDist כבר ~0 (פתיחת מסך) — מותר succeeded בלי onScroll
 * - אם startDist גדול (FAB) — חובה epoch חדש / ירידה ב-dist; בלי זה זה false-positive
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
  const startDist = retryOptions.startDist ?? refs.getDistFromBottom?.() ?? 0;
  const startEpoch = refs.getScrollEpoch?.() ?? 0;
  const needProofOfMovement = startDist > BOTTOM_REACHED_PX;
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
      `done attempts=${attempts} reached=${reachedBottom} dist=${refs.getDistFromBottom?.()?.toFixed(0) ?? '?'} startDist=${startDist.toFixed(0)} needProof=${needProofOfMovement} epochΔ=${(refs.getScrollEpoch?.() ?? 0) - startEpoch}`,
    );
    retryOptions.onDone?.({ maxOffset, reachedBottom });
  };

  const canDeclareSuccess = (): boolean => {
    if (!isNearBottom(refs)) return false;
    if (!needProofOfMovement) return true;
    const epoch = refs.getScrollEpoch?.() ?? 0;
    const dist = refs.getDistFromBottom?.() ?? startDist;
    // הצלחה רק אחרי onScroll אמיתי שמראה קרבה לתחתית, או ירידה משמעותית במרחק
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
          const ok = canDeclareSuccess();
          logger.debug(
            'chatListScrollToBottom',
            `retry exhausted attempts=${attempts} dist=${refs.getDistFromBottom?.()?.toFixed(0) ?? '?'} ok=${ok}`,
          );
          // לא מניחים הצלחה בכוח כשהיינו רחוקים מהתחתית
          finish(ok);
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
