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
 * inverted FlatList: offset 0 = תחתית (ההודעה החדשה ביותר).
 * `scrollToOffset({offset:0})` הוא הפרימיטיב האמין לגלילה לתחתית.
 * (בעבר השתמשנו ב-scrollToIndex בגלל maintainVisibleContentPosition שהוסר —
 *  scrollToIndex עם viewPosition/viewOffset על inverted הוא באגי ולעיתים לא מזיז.)
 */
function scrollToOffsetZero(list: ChatListRef, animated: boolean): void {
  list.scrollToOffset({ offset: 0, animated });
  // קריאה נוספת בפריים הבא — מבטיחה נחיתה בתחתית גם אם המדידה התעדכנה.
  requestAnimationFrame(() => {
    list.scrollToOffset({ offset: 0, animated: false });
  });
}

function isNearBottom(refs: ScrollRefs): boolean {
  const dist = refs.getDistFromBottom?.();
  if (dist != null && Number.isFinite(dist)) {
    return dist <= BOTTOM_REACHED_PX;
  }
  return true;
}

/**
 * FlatList inverted: data[0]=הודעה חדשה, offset 0 = תחתית המסך.
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
    return 0;
  }

  if (!retryOptions) {
    scrollToOffsetZero(list, animated);
    return 0;
  }

  const maxAttempts = retryOptions.maxAttempts ?? 12;
  let attempts = 0;
  let finished = false;

  const finish = (reachedBottom: boolean) => {
    if (finished) return;
    finished = true;
    retryOptions.onDone?.({ maxOffset: 0, reachedBottom });
  };

  const tick = () => {
    if (finished) return;
    attempts += 1;
    scrollToOffsetZero(list, animated && attempts === 1);

    setTimeout(() => {
      if (isNearBottom(refs)) {
        finish(true);
        return;
      }
      if (attempts >= maxAttempts) {
        logger.debug(
          'chatListScrollToBottom',
          `retry exhausted attempts=${attempts} dist=${refs.getDistFromBottom?.()?.toFixed(0) ?? '?'}`,
        );
        finish(false);
        return;
      }
      setTimeout(tick, 40 + attempts * 30);
    }, 32);
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
