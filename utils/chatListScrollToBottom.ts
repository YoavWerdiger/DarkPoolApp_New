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
/** זמן לשקיעת אנימציית native לפני בדיקת הצלחה / fallback */
const ANIMATED_SETTLE_MS = 380;
/** ניסיונות קשיחים אחרי ש-animated נכשל */
const HARD_FALLBACK_ATTEMPTS = 6;

/** מבטל timers של גלילה קודמת (לחיצה כפולה / שליחה באמצע אנימציה) */
let scrollGeneration = 0;

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

function maxOffsetOf(refs: ScrollRefs): number {
  return Math.max(0, refs.contentHeightRef.current - refs.layoutHeightRef.current);
}

/**
 * גלילה לתחתית — animated נעים כברירת מחדל למשתמש; fallback ל-animated:false רק אם האנימציה לא הגיעה.
 * בלי jiggle / בלי לקטוע אנימציה ב-RAF הבא.
 */
export function scrollChatListToBottom(
  refs: ScrollRefs,
  messageCount: number,
  animated: boolean,
  _maxOffsetHint?: number,
  retryOptions?: ScrollToBottomRetryOptions,
): number {
  const gen = ++scrollGeneration;
  const list = refs.listRef.current;
  const startDist = retryOptions?.startDist ?? refs.getDistFromBottom?.() ?? -1;

  if (!list || messageCount <= 0) {
    retryOptions?.onDone?.({
      maxOffset: maxOffsetOf(refs),
      reachedBottom: false,
    });
    return 0;
  }

  if (!retryOptions) {
    forceInvertedListToBottom(list, animated);
    if (animated) {
      setTimeout(() => {
        if (gen !== scrollGeneration) return;
        if (isNearBottom(refs)) return;
        const again = refs.listRef.current;
        if (again) forceInvertedListToBottom(again, false);
      }, ANIMATED_SETTLE_MS);
    } else {
      requestAnimationFrame(() => {
        if (gen !== scrollGeneration) return;
        const again = refs.listRef.current;
        if (again) forceInvertedListToBottom(again, false);
      });
    }
    return 0;
  }

  const startEpoch = refs.getScrollEpoch?.() ?? 0;
  const needProof = startDist > BOTTOM_REACHED_PX;
  let attempts = 0;
  let finished = false;

  const finish = (reachedBottom: boolean) => {
    if (finished || gen !== scrollGeneration) return;
    finished = true;
    logger.debug(
      'chatListScrollToBottom',
      `done reached=${reachedBottom} attempts=${attempts} animated=${animated} distBefore=${Number(startDist).toFixed(0)} distAfter=${(refs.getDistFromBottom?.() ?? -1).toFixed(0)}`,
    );
    retryOptions.onDone?.({ maxOffset: maxOffsetOf(refs), reachedBottom });
  };

  const canDeclareSuccess = (): boolean => {
    if (!isNearBottom(refs)) return false;
    if (!needProof) return true;
    const epoch = refs.getScrollEpoch?.() ?? 0;
    const dist = refs.getDistFromBottom?.() ?? startDist;
    return epoch > startEpoch || dist < startDist - 40;
  };

  /** retries קשיחים — רק אחרי שנכשל animated (או מצב לא-מונפש) */
  const hardTick = () => {
    if (finished || gen !== scrollGeneration) return;
    const current = refs.listRef.current;
    if (!current) {
      finish(false);
      return;
    }

    attempts += 1;
    forceInvertedListToBottom(current, false);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (finished || gen !== scrollGeneration) return;
        if (canDeclareSuccess()) {
          finish(true);
          return;
        }
        if (attempts >= HARD_FALLBACK_ATTEMPTS) {
          forceInvertedListToBottom(current, false);
          setTimeout(() => finish(canDeclareSuccess()), 40);
          return;
        }
        setTimeout(hardTick, 40 + attempts * 20);
      });
    });
  };

  if (animated) {
    // ניסיון אחד חלק — מחכים שישקע לפני fallback (לא לקטוע בפריים הבא)
    forceInvertedListToBottom(list, true);
    attempts = 1;
    setTimeout(() => {
      if (finished || gen !== scrollGeneration) return;
      if (canDeclareSuccess()) {
        finish(true);
        return;
      }
      logger.debug('chatListScrollToBottom', 'animated miss → hard fallback');
      hardTick();
    }, ANIMATED_SETTLE_MS);
    return 0;
  }

  // לא-מונפש: אמין לפתיחה / שליחה / pin
  const maxAttempts = retryOptions.maxAttempts ?? 12;
  const tick = () => {
    if (finished || gen !== scrollGeneration) return;
    const current = refs.listRef.current;
    if (!current) {
      finish(false);
      return;
    }

    attempts += 1;
    forceInvertedListToBottom(current, false);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (finished || gen !== scrollGeneration) return;
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
