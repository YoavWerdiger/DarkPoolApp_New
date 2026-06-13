/**
 * chatOfflineQueue.ts
 * --------------------------------------------------------------------------
 * AsyncStorage-backed queue for outbound chat messages that could not be
 * delivered because the device was offline / the server returned a network
 * error.
 *
 * Design goals (WhatsApp/Telegram-grade behaviour):
 *   - Messages must NEVER be lost when the app is force-quit, the device
 *     reboots, or the OS evicts the process. → persistent storage.
 *   - The send-flow must remain fully optimistic: the queue tracks the
 *     temp/optimistic id (`local_id`) so that on reconnect we can swap the
 *     placeholder bubble for the real one without flicker.
 *   - Each queued item carries a `client_message_id` (UUID generated on the
 *     client) so the server can deduplicate retries idempotently once the
 *     server-side unique-constraint migration ships.
 *   - This module knows nothing about Supabase / React. It is pure storage
 *     plus a small mutex so concurrent flushes can't corrupt the file.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SendChatMessageInput } from '../../types/chat.types';
import { logger } from '../../utils/logger';

const STORAGE_KEY = '@darkpool:chat:offlineQueue:v1';
const TAG = 'ChatOfflineQueue';

export interface QueuedChatMessage {
  /** Optimistic / placeholder message id rendered in the UI (`temp-...`). */
  local_id: string;
  /** Stable client-generated identifier. Server uses this for deduplication. */
  client_message_id: string;
  /** Owning user. Persisted because the queue may flush after auth state cycles. */
  sender_id: string;
  /** Wall-clock timestamp the user pressed send. */
  enqueued_at: number;
  /** Number of times we've attempted to deliver this. */
  attempts: number;
  /** Last error string, for diagnostics only. */
  last_error?: string;
  payload: SendChatMessageInput;
}

// ============================================
// Mutex – serialises file reads/writes so concurrent enqueue / flush calls
// can't race and clobber each other's snapshots.
// ============================================

let chainTail: Promise<unknown> = Promise.resolve();
function withMutex<T>(fn: () => Promise<T>): Promise<T> {
  const next = chainTail.then(fn, fn);
  chainTail = next.catch(() => undefined);
  return next;
}

// ============================================
// Storage primitives
// ============================================

async function readAll(): Promise<QueuedChatMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Defensive – drop entries that have lost required fields after a schema change.
    return parsed.filter(
      (x): x is QueuedChatMessage =>
        x &&
        typeof x.local_id === 'string' &&
        typeof x.client_message_id === 'string' &&
        typeof x.sender_id === 'string' &&
        x.payload &&
        typeof (x.payload as SendChatMessageInput).group_id === 'string'
    );
  } catch (err) {
    logger.error(TAG, 'readAll failed', err);
    return [];
  }
}

async function writeAll(items: QueuedChatMessage[]): Promise<void> {
  try {
    if (items.length === 0) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return;
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    logger.error(TAG, 'writeAll failed', err);
    // Re-throw so callers can decide whether to roll back the in-memory state.
    throw err;
  }
}

// ============================================
// Public API
// ============================================

/** Returns a snapshot of the queue, ordered by insertion time. */
export function peek(): Promise<QueuedChatMessage[]> {
  return withMutex(readAll);
}

/** Number of items currently queued. */
export async function size(): Promise<number> {
  return (await peek()).length;
}

/** Append a new outbound message to the queue. */
export async function enqueue(item: Omit<QueuedChatMessage, 'attempts' | 'enqueued_at'> & {
  attempts?: number;
  enqueued_at?: number;
}): Promise<void> {
  await withMutex(async () => {
    const items = await readAll();
    items.push({
      attempts: 0,
      enqueued_at: Date.now(),
      ...item,
    });
    await writeAll(items);
  });
}

/**
 * Remove a queued item by its `local_id`. Returns true if anything was removed.
 * Idempotent — calling it twice for the same id is safe.
 */
export async function remove(localId: string): Promise<boolean> {
  return withMutex(async () => {
    const items = await readAll();
    const next = items.filter((x) => x.local_id !== localId);
    if (next.length === items.length) return false;
    await writeAll(next);
    return true;
  });
}

/** Record a failed attempt for a specific message; keeps the message queued. */
export async function recordAttempt(localId: string, error?: string): Promise<void> {
  await withMutex(async () => {
    const items = await readAll();
    let dirty = false;
    for (const it of items) {
      if (it.local_id === localId) {
        it.attempts += 1;
        if (error) it.last_error = error;
        dirty = true;
      }
    }
    if (dirty) await writeAll(items);
  });
}

/** Wipe the entire queue. Used on logout / account switch. */
export async function clear(): Promise<void> {
  await withMutex(async () => writeAll([]));
}

/**
 * Generate a fresh local id for an outbound message. Format mirrors what
 * ChatContext already uses for optimistic placeholders so any existing
 * comparison code (e.g. `id.startsWith('temp-')`) keeps working.
 */
export function makeLocalId(): string {
  // Two separate Math.random() calls + Date.now() to prevent collisions on
  // rapid sends where Date.now() can return the same ms value.
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 11)}-${Math.random().toString(36).slice(2, 7)}`;
}

const PERSISTED_MESSAGE_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Optimistic placeholder ids must never be sent to Postgres uuid columns. */
export function isOptimisticChatMessageId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith('temp-');
}

export function isPersistedChatMessageId(id: string | null | undefined): boolean {
  return typeof id === 'string' && !isOptimisticChatMessageId(id) && PERSISTED_MESSAGE_ID_RE.test(id);
}

/** messages[0] = newest; skips in-flight optimistic rows. */
export function getNewestPersistedMessageId(
  messages: ReadonlyArray<{ id: string }>,
): string | undefined {
  for (const m of messages) {
    if (isPersistedChatMessageId(m.id)) return m.id;
  }
  return undefined;
}

/**
 * RFC4122-ish v4 UUID using Math.random. We use this for `client_message_id`
 * because react-native-uuid is already pulled in transitively for other
 * features and we want zero new native dependencies.
 *
 * NOTE: not cryptographically random. That's fine — its only job is to be
 * unique enough to dedupe server-side. The probability of collision across
 * a single user's lifetime queue is < 1 in 2^61.
 */
export function makeClientMessageId(): string {
  const bytes = new Array<number>(16);
  for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xxxxxx
  const hex = bytes.map((b) => b.toString(16).padStart(2, '0'));
  return (
    hex.slice(0, 4).join('') +
    '-' +
    hex.slice(4, 6).join('') +
    '-' +
    hex.slice(6, 8).join('') +
    '-' +
    hex.slice(8, 10).join('') +
    '-' +
    hex.slice(10, 16).join('')
  );
}

// ============================================
// Test hooks (not for production callers)
// ============================================

/** @internal — testing only. Replaces the underlying storage layer. */
export const __testing = {
  reset: async () => {
    await withMutex(async () => writeAll([]));
  },
};
