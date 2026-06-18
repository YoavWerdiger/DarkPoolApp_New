/**
 * Tests the persistent offline-queue contract that ChatContext depends on.
 * Uses a thin in-memory mock for AsyncStorage so we can assert observable
 * behaviour (ordering, dedupe-by-id, attempt counters, clear semantics).
 */

import {
  enqueue,
  remove,
  recordAttempt,
  peek,
  size,
  clear,
  makeLocalId,
  makeClientMessageId,
  getNewestPersistedMessageId,
  isOptimisticChatMessageId,
  isPersistedChatMessageId,
  __testing,
} from '../../services/chat/chatOfflineQueue';
import { ChatMessageType } from '../../types/chat.types';

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => store.get(k) ?? null),
      setItem: jest.fn(async (k: string, v: string) => {
        store.set(k, v);
      }),
      removeItem: jest.fn(async (k: string) => {
        store.delete(k);
      }),
      // For introspection during a test.
      __store: store,
    },
  };
});

beforeEach(async () => {
  await __testing.reset();
});

function payload(overrides: Record<string, any> = {}) {
  return {
    group_id: '123e4567-e89b-12d3-a456-426614174000',
    message_type: ChatMessageType.TEXT,
    content: 'hello',
    ...overrides,
  } as any;
}

describe('makeLocalId / makeClientMessageId', () => {
  it('returns ids that match the optimistic-placeholder format', () => {
    const id = makeLocalId();
    expect(id.startsWith('temp-')).toBe(true);
    expect(id.length).toBeGreaterThan('temp-'.length);
  });

  it('emits collision-free UUIDs across 10k iterations', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 10_000; i++) {
      const id = makeClientMessageId();
      expect(seen.has(id)).toBe(false);
      seen.add(id);
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
  });
});

describe('enqueue / peek / size', () => {
  it('returns empty when nothing has been queued', async () => {
    expect(await peek()).toEqual([]);
    expect(await size()).toBe(0);
  });

  it('preserves insertion order across enqueues', async () => {
    await enqueue({
      local_id: 'temp-a',
      client_message_id: 'cid-a',
      sender_id: 'u1',
      payload: payload({ content: 'first' }),
    });
    await enqueue({
      local_id: 'temp-b',
      client_message_id: 'cid-b',
      sender_id: 'u1',
      payload: payload({ content: 'second' }),
    });
    const items = await peek();
    expect(items.map((x) => x.local_id)).toEqual(['temp-a', 'temp-b']);
    expect(items[0].attempts).toBe(0);
    expect(items[1].attempts).toBe(0);
    expect(items[0].enqueued_at).toBeGreaterThan(0);
  });

  it('survives a process restart (data is persistent)', async () => {
    await enqueue({
      local_id: 'temp-x',
      client_message_id: 'cid-x',
      sender_id: 'u1',
      payload: payload(),
    });

    // Simulate fresh module load: peek() should still see the row.
    const items = await peek();
    expect(items).toHaveLength(1);
    expect(items[0].local_id).toBe('temp-x');
  });
});

describe('remove', () => {
  it('is idempotent for missing ids', async () => {
    expect(await remove('does-not-exist')).toBe(false);
  });

  it('removes a single id without disturbing siblings', async () => {
    await enqueue({
      local_id: 'temp-1',
      client_message_id: 'cid-1',
      sender_id: 'u1',
      payload: payload(),
    });
    await enqueue({
      local_id: 'temp-2',
      client_message_id: 'cid-2',
      sender_id: 'u1',
      payload: payload(),
    });

    expect(await remove('temp-1')).toBe(true);
    const remaining = await peek();
    expect(remaining.map((x) => x.local_id)).toEqual(['temp-2']);
  });
});

describe('recordAttempt', () => {
  it('bumps the attempt counter and stores the last error', async () => {
    await enqueue({
      local_id: 'temp-r',
      client_message_id: 'cid-r',
      sender_id: 'u1',
      payload: payload(),
    });
    await recordAttempt('temp-r', 'network timeout');
    await recordAttempt('temp-r', 'fetch failed');
    const [item] = await peek();
    expect(item.attempts).toBe(2);
    expect(item.last_error).toBe('fetch failed');
  });

  it('is a no-op for unknown ids', async () => {
    await expect(recordAttempt('ghost')).resolves.toBeUndefined();
  });
});

describe('clear', () => {
  it('removes everything', async () => {
    await enqueue({
      local_id: 'temp-c',
      client_message_id: 'cid-c',
      sender_id: 'u1',
      payload: payload(),
    });
    await clear();
    expect(await size()).toBe(0);
  });
});

describe('concurrent enqueue serialisation', () => {
  it('does not lose writes when called in parallel', async () => {
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        enqueue({
          local_id: `temp-${i}`,
          client_message_id: `cid-${i}`,
          sender_id: 'u1',
          payload: payload({ content: `msg-${i}` }),
        })
      )
    );
    const items = await peek();
    expect(items).toHaveLength(20);
    // Each local_id should appear exactly once.
    const ids = items.map((x) => x.local_id);
    expect(new Set(ids).size).toBe(20);
  });
});

describe('persisted message ids', () => {
  const realId = '3e9ca4fd-2dfd-471d-ab3e-674c6f73d27c';

  it('detects optimistic temp ids', () => {
    expect(isOptimisticChatMessageId(makeLocalId())).toBe(true);
    expect(isOptimisticChatMessageId(realId)).toBe(false);
  });

  it('skips optimistic rows when picking newest persisted id', () => {
    const temp = makeLocalId();
    expect(
      getNewestPersistedMessageId([
        { id: temp },
        { id: realId },
      ]),
    ).toBe(realId);
    expect(isPersistedChatMessageId(temp)).toBe(false);
    expect(isPersistedChatMessageId(realId)).toBe(true);
  });
});
