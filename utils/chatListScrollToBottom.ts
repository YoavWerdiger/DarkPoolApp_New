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
/** מתחת לזה native animated מספיק קצר ונעים */
const NATIVE_ANIM_MAX_DIST_PX = 220;
const CONTROLLED_MIN_MS = 480;
const CONTROLLED_MAX_MS = 900;
/** כמה זמן בלי התקדמות לפני hard fallback (לא קוטעים אנימציה חיה) */
const STUCK_IDLE_MS = 280;
const PROGRESS_POLL_MS = 70;
/** תקרת המתנה אחרי התחלת animated לפני שמוותרים */
const ANIMATED_MAX_WAIT_MS = 1400;
/** ניסיונות קשיחים אחרי ש-animated נכשל */
const HARD_FALLBACK_ATTEMPTS = 6;
const STUCK_EPS_PX = 3;

/** מבטל timers / RAF של גלילה קודמת (לחיצה כפולה / שליחה באמצע אנימציה) */
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

function setInvertedOffset(list: ChatListRef, offset: number, animated: boolean): void {
  try {
    list.scrollToOffset({ offset: Math.max(0, offset), animated });
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

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function durationForDistance(dist: number): number {
  return Math.round(
    Math.min(CONTROLLED_MAX_MS, Math.max(CONTROLLED_MIN_MS, 420 + dist * 0.09)),
  );
}

/**
 * גלילה מבוקרת: interpolate offset עם duration קבוע לפי מרחק.
 * iOS native animated:true על מרחק גדול נגמר ב-~250ms ונראה כקפיצה בטלפון;
 * סימולטור מרגיש איטי יותר — לכן RAF נותן אותה תחושה בשניהם.
 */
function runControlledScroll(
  refs: ScrollRefs,
  gen: number,
  fromOffset: number,
  toOffset: number,
  onFrameDone: () => void,
): void {
  const list = refs.listRef.current;
  const start = Math.max(0, fromOffset);
  const end = Math.max(0, toOffset);
  const dist = Math.abs(end - start);

  if (!list || dist < 2) {
    if (list) setInvertedOffset(list, end, false);
    onFrameDone();
    return;
  }

  const duration = durationForDistance(dist);
  const t0 = Date.now();

  const frame = () => {
    if (gen !== scrollGeneration) return;
    const current = refs.listRef.current;
    if (!current) {
      onFrameDone();
      return;
    }

    const t = Math.min(1, (Date.now() - t0) / duration);
    const offset = start + (end - start) * easeOutCubic(t);
    setInvertedOffset(current, offset, false);

    if (t < 1) {
      requestAnimationFrame(frame);
      return;
    }

    setInvertedOffset(current, end, false);
    onFrameDone();
  };

  requestAnimationFrame(frame);
}

function runControlledScrollToZero(
  refs: ScrollRefs,
  gen: number,
  startDist: number,
  onFrameDone: () => void,
): void {
  runControlledScroll(refs, gen, startDist, 0, () => {
    const current = refs.listRef.current;
    if (current) forceInvertedListToBottom(current, false);
    onFrameDone();
  });
}

/**
 * גלילה מבוקרת ל-offset כלשהו (jump-to-reply) — אותה תחושה כמו FAB בטלפון.
 * תמיד מבוקרת (לא native animated) כדי שלא תקפוץ בטלפון.
 * מבטל גלילה קודמת (generation++) כדי שלחיצה כפולה לא תתנגש.
 */
export function scrollChatListToOffset(
  refs: ScrollRefs,
  targetOffset: number,
  animated: boolean,
  onDone?: () => void,
): void {
  const gen = ++scrollGeneration;
  const list = refs.listRef.current;
  if (!list) {
    onDone?.();
    return;
  }

  const end = Math.max(0, targetOffset);
  const start = Math.max(0, refs.getDistFromBottom?.() ?? end);

  if (!animated) {
    setInvertedOffset(list, end, false);
    requestAnimationFrame(() => {
      if (gen !== scrollGeneration) return;
      const again = refs.listRef.current;
      if (again) setInvertedOffset(again, end, false);
      onDone?.();
    });
    return;
  }

  // תמיד controlled — גם למרחק קצר — כדי שריפליי ירגיש כמו FAB בטלפון
  runControlledScroll(refs, gen, start, end, () => {
    if (gen !== scrollGeneration) return;
    const again = refs.listRef.current;
    if (again) setInvertedOffset(again, end, false);
    onDone?.();
  });
}

/**
 * ממתין עד ליד התחתית, או עד שאין התקדמות (stuck) — בלי לקטוע אנימציה חיה מוקדם מדי.
 */
function watchUntilSettledOrStuck(
  refs: ScrollRefs,
  gen: number,
  onSettled: (reached: boolean) => void,
): void {
  const startedAt = Date.now();
  let lastDist = refs.getDistFromBottom?.() ?? Number.POSITIVE_INFINITY;
  let lastProgressAt = startedAt;

  const poll = () => {
    if (gen !== scrollGeneration) return;

    if (isNearBottom(refs)) {
      onSettled(true);
      return;
    }

    const now = Date.now();
    const dist = refs.getDistFromBottom?.() ?? lastDist;
    if (dist < lastDist - STUCK_EPS_PX) {
      lastDist = dist;
      lastProgressAt = now;
    }

    const idle = now - lastProgressAt >= STUCK_IDLE_MS;
    const timedOut = now - startedAt >= ANIMATED_MAX_WAIT_MS;

    if (idle || timedOut) {
      onSettled(false);
      return;
    }

    setTimeout(poll, PROGRESS_POLL_MS);
  };

  setTimeout(poll, PROGRESS_POLL_MS);
}

/**
 * גלילה לתחתית — animated: גלילה מבוקרת (או native למרחק קצר);
 * fallback ל-animated:false רק כשהאנימציה נתקעה / לא הגיעה.
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
    if (!animated) {
      forceInvertedListToBottom(list, false);
      requestAnimationFrame(() => {
        if (gen !== scrollGeneration) return;
        const again = refs.listRef.current;
        if (again) forceInvertedListToBottom(again, false);
      });
      return 0;
    }

    const dist = startDist > 0 ? startDist : refs.getDistFromBottom?.() ?? 0;
    const afterAnim = () => {
      if (gen !== scrollGeneration) return;
      watchUntilSettledOrStuck(refs, gen, (reached) => {
        if (gen !== scrollGeneration || reached) return;
        const again = refs.listRef.current;
        if (again) forceInvertedListToBottom(again, false);
      });
    };

    if (dist <= NATIVE_ANIM_MAX_DIST_PX) {
      forceInvertedListToBottom(list, true);
      afterAnim();
    } else {
      runControlledScrollToZero(refs, gen, dist, afterAnim);
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
    const dist = Math.max(0, startDist);
    const beginWatch = () => {
      if (finished || gen !== scrollGeneration) return;
      watchUntilSettledOrStuck(refs, gen, (reached) => {
        if (finished || gen !== scrollGeneration) return;
        if (reached && canDeclareSuccess()) {
          finish(true);
          return;
        }
        if (reached) {
          finish(true);
          return;
        }
        logger.debug('chatListScrollToBottom', 'animated stuck/miss → hard fallback');
        hardTick();
      });
    };

    if (dist <= NATIVE_ANIM_MAX_DIST_PX) {
      forceInvertedListToBottom(list, true);
      attempts = 1;
      beginWatch();
    } else {
      attempts = 1;
      runControlledScrollToZero(refs, gen, dist, beginWatch);
    }
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
