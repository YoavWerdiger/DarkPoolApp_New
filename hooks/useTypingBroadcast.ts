/**
 * useTypingBroadcast – throttled "typing…" indicator publisher.
 *
 * Problem with the naive approach: calling `onTyping(true)` from `onChangeText`
 * spams the realtime channel — every keystroke triggers a server-side write
 * even though downstream consumers debounce. With 30 concurrent users in a
 * group all typing at once, this saturates the channel quickly.
 *
 * Behaviour:
 *   - The first call after idle fires `onTyping(true)` immediately so the
 *     receiver sees the indicator with no perceived delay.
 *   - Subsequent calls within the throttle window (default 1.5s) are coalesced.
 *   - When the input goes empty, or `idleAfterMs` (default 2s) elapses without
 *     a keystroke, we send `onTyping(false)` exactly once.
 *   - All timers are cleared on unmount and on a `flushStop()` call.
 */

import { useCallback, useEffect, useRef } from 'react';

interface Options {
  /** Minimum interval between two `onTyping(true)` broadcasts. */
  throttleMs?: number;
  /** Inactivity period after which we publish `onTyping(false)`. */
  idleAfterMs?: number;
}

export function useTypingBroadcast(
  onTyping: ((isTyping: boolean) => void) | undefined,
  { throttleMs = 1500, idleAfterMs = 2000 }: Options = {}
) {
  const isTypingRef = useRef(false);
  const lastSentTrueAtRef = useRef(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTypingRef = useRef(onTyping);

  // Keep the callback ref fresh without re-creating the public functions.
  useEffect(() => {
    onTypingRef.current = onTyping;
  }, [onTyping]);

  const clearIdleTimer = () => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  };

  /** Call this on every keystroke / handleTextChange. */
  const reportKeystroke = useCallback(
    (text: string) => {
      const cb = onTypingRef.current;
      if (!cb) return;

      // Empty input → immediate stop, no further timers needed.
      if (text.trim().length === 0) {
        clearIdleTimer();
        if (isTypingRef.current) {
          isTypingRef.current = false;
          cb(false);
        }
        return;
      }

      const now = Date.now();
      if (!isTypingRef.current || now - lastSentTrueAtRef.current >= throttleMs) {
        isTypingRef.current = true;
        lastSentTrueAtRef.current = now;
        cb(true);
      }

      clearIdleTimer();
      idleTimerRef.current = setTimeout(() => {
        idleTimerRef.current = null;
        if (isTypingRef.current) {
          isTypingRef.current = false;
          onTypingRef.current?.(false);
        }
      }, idleAfterMs);
    },
    [throttleMs, idleAfterMs]
  );

  /** Force-publish "stopped typing". Use on send / blur / unmount. */
  const flushStop = useCallback(() => {
    clearIdleTimer();
    if (isTypingRef.current) {
      isTypingRef.current = false;
      onTypingRef.current?.(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      clearIdleTimer();
      // Best-effort: tell the channel we stopped typing on unmount.
      if (isTypingRef.current) {
        isTypingRef.current = false;
        onTypingRef.current?.(false);
      }
    };
  }, []);

  return { reportKeystroke, flushStop };
}
