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
  getScrollEpoch?: () => number;
};

export type ScrollToBottomRetryOptions = {
  maxAttempts?: number;
  startDist?: number;
  onDone?: (result: { maxOffset: number; reachedBottom: boolean }) => void;
};

const BOTTOM_REACHED_PX = 80;

/**
 * inverted FlatList: data[0]=חדש, offset 0 = תחתית ויזואלית.
 *
 * שים לב: ב-RN 0.81 + NativeWind 4.1.x, scrollTo* נשברים ע"י css-interop.
 * לכן ה-FlatList בצ'אט חייב cssInterop={false} (או NativeWind >= 4.2.1).
 */
export function forceInvertedListToBottom(list: ChatListRef, animated: boolean): void {
  try {
    list.scrollToOffset({ offset: 0, animated });
  } catch (e) {
    logger.debug('chatListScrollToBottom', `scrollToOffset threw: ${String(e)}`);
  }
}

function isNearBottom(refs: ScrollRefs): boolean {
  const dist = refs.getDistFromBottom?.();
  if (dist != null && Number.isFinite(dist)) {
    return dist <= BOTTOM_REACHED_PX;
  }
  return false;
}

/**
 * גלילה לתחתית עם ניסיונות — בלי jiggle/scrollToIndex (נלחמים זה בזה).
 * אל תאפסו distFromBottom / אל תעשו setState לפני הקריאה.
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

  const maxAttempts = retryOptions.maxAttempts ?? 12;
  const startEpoch = refs.getScrollEpoch?.() ?? 0;
  const needProof = startDist > BOTTOM_REACHED_PX;
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
      `done reached=${reachedBottom} attempts=${attempts} distBefore=${Number(startDist).toFixed(0)} distAfter=${(refs.getDistFromBottom?.() ?? -1).toFixed(0)}`,
    );
    retryOptions.onDone?.({ maxOffset, reachedBottom });
  };

  const canDeclareSuccess = (): boolean => {
    if (!isNearBottom(refs)) return false;
    if (!needProof) return true;
    const epoch = refs.getScrollEpoch?.() ?? 0;
    const dist = refs.getDistFromBottom?.() ?? startDist;
    return epoch > startEpoch || dist < startDist - 40;
  };

  const tick = () => {
    if (finished) return;
    const current = refs.listRef.current;
    if (!current) {
      finish(false);
      return;
    }

    attempts += 1;
    forceInvertedListToBottom(current, animated && attempts === 1);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (finished) return;
        if (canDeclareSuccess()) {
          finish(true);
          return;
        }
        if (attempts >= maxAttempts) {
          forceInvertedListToBottom(current, false);
          setTimeout(() => finish(canDeclareSuccess()), 40);
          return;
        }
        setTimeout(tick, 40 + attempts * 20);
      });
    });
  };

  requestAnimationFrame(tick);
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
