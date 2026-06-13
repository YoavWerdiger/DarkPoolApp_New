/**
 * useChatDraft – per-group draft autosave hook.
 *
 * Behaviour matches WhatsApp / Telegram:
 *   - When the user navigates into a group, restore whatever they had typed.
 *   - As they type, persist with a short debounce (300ms) so we don't write
 *     to AsyncStorage on every keystroke.
 *   - On unmount (screen exit, app background), flush any pending text.
 *   - On send, the caller must invoke `clear()` so the next visit to the
 *     group opens with an empty input.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { loadDraft, saveDraft, clearDraft } from '../services/chat/chatDrafts';

const SAVE_DEBOUNCE_MS = 300;

export function useChatDraft(groupId: string | undefined) {
  const [draft, setDraft] = useState<string>('');
  const [isHydrated, setIsHydrated] = useState<boolean>(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestTextRef = useRef<string>('');
  const lastFlushedRef = useRef<string>('');
  // Capture the group the latest debounce was scheduled for, so a group
  // switch in mid-flight doesn't write old text under a new key.
  const debouncedGroupRef = useRef<string | undefined>(groupId);

  // Restore draft when the group changes.
  useEffect(() => {
    let cancelled = false;

    // Before swapping groups, persist any pending unflushed text under the
    // PREVIOUS group's key. Without this, a user who types in group A and
    // taps over to group B within the debounce window (300ms) would either
    // lose the draft for A, or — worse — clobber A's stored draft with B's
    // text once the stale timer fires.
    const prevGroup = debouncedGroupRef.current;
    const prevText = latestTextRef.current;
    const prevFlushed = lastFlushedRef.current;
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    if (prevGroup && prevGroup !== groupId && prevText !== prevFlushed) {
      saveDraft(prevGroup, prevText).catch(e => {
        console.warn('[useChatDraft] Failed to save draft for previous group', prevGroup, e);
      });
    }

    setIsHydrated(false);
    debouncedGroupRef.current = groupId;
    if (!groupId) {
      setDraft('');
      latestTextRef.current = '';
      lastFlushedRef.current = '';
      setIsHydrated(true);
      return;
    }
    loadDraft(groupId).then((saved) => {
      if (cancelled) return;
      // אם המשתמש כבר התחיל להקליד לפני שהטיוטה נטענה — לא לדרוס
      const pending = latestTextRef.current;
      if (pending.length > 0 && pending !== lastFlushedRef.current) {
        setIsHydrated(true);
        return;
      }
      setDraft(saved);
      latestTextRef.current = saved;
      lastFlushedRef.current = saved;
      setIsHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  const flush = useCallback(async () => {
    const targetGroup = debouncedGroupRef.current;
    if (!targetGroup) return;
    const text = latestTextRef.current;
    if (text === lastFlushedRef.current) return;
    lastFlushedRef.current = text;
    await saveDraft(targetGroup, text);
  }, []);

  // Persist on background / inactive AppState – mirrors how iOS / Android
  // messaging apps survive sudden app-switching.
  useEffect(() => {
    const handler = (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') {
        if (debounceTimer.current) {
          clearTimeout(debounceTimer.current);
          debounceTimer.current = null;
        }
        flush();
      }
    };
    // Defensive: AppState's API changed across RN versions and is mocked
    // inconsistently across test environments. The modern signature returns
    // an `EventSubscription` with a `remove()` method; older / mocked ones
    // return a function or undefined.
    const sub = AppState.addEventListener('change', handler) as
      | { remove: () => void }
      | (() => void)
      | undefined;
    return () => {
      if (!sub) return;
      if (typeof sub === 'function') {
        sub();
      } else if (typeof (sub as { remove?: () => void }).remove === 'function') {
        (sub as { remove: () => void }).remove();
      }
    };
  }, [flush]);

  // Persist any pending draft on unmount.
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
      flush();
    };
  }, [flush]);

  const setDraftText = useCallback(
    (text: string) => {
      setDraft(text);
      latestTextRef.current = text;
      debouncedGroupRef.current = groupId;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        debounceTimer.current = null;
        flush();
      }, SAVE_DEBOUNCE_MS);
    },
    [groupId, flush]
  );

  const clear = useCallback(async () => {
    setDraft('');
    latestTextRef.current = '';
    lastFlushedRef.current = '';
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    if (groupId) await clearDraft(groupId);
  }, [groupId]);

  return {
    draft,
    setDraft: setDraftText,
    clearDraft: clear,
    isDraftHydrated: isHydrated,
  };
}
