/**
 * useChatDraft – tests the per-group draft auto-save hook, including the
 * trickiest case: switching groups mid-debounce. A naive implementation
 * persists the new group's text under the previous group's key.
 */

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useChatDraft } from '../../hooks/useChatDraft';
import { loadDraft, saveDraft, clearAllDrafts } from '../../services/chat/chatDrafts';

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
      getAllKeys: jest.fn(async () => Array.from(store.keys())),
      multiRemove: jest.fn(async (keys: string[]) => {
        keys.forEach((k) => store.delete(k));
      }),
    },
  };
});

const A = '123e4567-e89b-12d3-a456-426614174000';
const B = '223e4567-e89b-12d3-a456-426614174000';

interface HarnessProps {
  groupId: string | undefined;
  apiRef: (api: ReturnType<typeof useChatDraft>) => void;
}
function Harness({ groupId, apiRef }: HarnessProps) {
  const api = useChatDraft(groupId);
  apiRef(api);
  return null;
}

function mount(groupId: string | undefined) {
  let api!: ReturnType<typeof useChatDraft>;
  let root!: TestRenderer.ReactTestRenderer;
  act(() => {
    root = TestRenderer.create(
      React.createElement(Harness, {
        groupId,
        apiRef: (a) => {
          api = a;
        },
      })
    );
  });
  return {
    api: () => api,
    rerender: (gid: string | undefined) => {
      act(() => {
        root.update(
          React.createElement(Harness, {
            groupId: gid,
            apiRef: (a) => {
              api = a;
            },
          })
        );
      });
    },
    unmount: () => act(() => root.unmount()),
  };
}

afterEach(async () => {
  await clearAllDrafts();
});

describe('useChatDraft', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('restores an empty draft for a never-typed-in group', async () => {
    const h = mount(A);
    // Allow async hydration.
    await act(async () => {
      await Promise.resolve();
    });
    expect(h.api().draft).toBe('');
    expect(h.api().isDraftHydrated).toBe(true);
    h.unmount();
  });

  it('persists keystrokes after the debounce window', async () => {
    const h = mount(A);
    await act(async () => {
      await Promise.resolve();
    });

    act(() => h.api().setDraft('hello'));
    expect(h.api().draft).toBe('hello');

    // Before debounce elapses, storage has not been written yet.
    expect(await loadDraft(A)).toBe('');

    await act(async () => {
      jest.advanceTimersByTime(350);
      await Promise.resolve();
    });

    expect(await loadDraft(A)).toBe('hello');
    h.unmount();
  });

  it('restores a previously saved draft when the group is re-opened', async () => {
    await saveDraft(A, 'pre-existing draft');
    const h = mount(A);
    await act(async () => {
      await Promise.resolve();
    });
    expect(h.api().draft).toBe('pre-existing draft');
    h.unmount();
  });

  it('flushes pending text on unmount without waiting for debounce', async () => {
    const h = mount(A);
    await act(async () => {
      await Promise.resolve();
    });

    act(() => h.api().setDraft('quick exit'));
    h.unmount();

    // The unmount-flush is fire-and-forget; let microtasks drain.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(await loadDraft(A)).toBe('quick exit');
  });

  it('clearDraft removes the persisted entry', async () => {
    const h = mount(A);
    await act(async () => {
      await Promise.resolve();
    });

    act(() => h.api().setDraft('to be cleared'));
    await act(async () => {
      jest.advanceTimersByTime(350);
      await Promise.resolve();
    });
    expect(await loadDraft(A)).toBe('to be cleared');

    await act(async () => {
      await h.api().clearDraft();
    });
    expect(await loadDraft(A)).toBe('');
    h.unmount();
  });

  it('group switch mid-debounce persists OLD text under OLD key, NEW under NEW key', async () => {
    const h = mount(A);
    await act(async () => {
      await Promise.resolve();
    });

    // Type in group A but don't let the debounce fire.
    act(() => h.api().setDraft('text-for-A'));
    expect(h.api().draft).toBe('text-for-A');

    // Switch to group B before the debounce window elapses.
    h.rerender(B);
    await act(async () => {
      // Let the synchronous fire-and-forget save under A complete.
      await Promise.resolve();
      // Then the async loadDraft(B) resolves.
      await Promise.resolve();
    });

    // The hook should have flushed A under A's key, NOT under B's key.
    expect(await loadDraft(A)).toBe('text-for-A');
    expect(await loadDraft(B)).toBe('');

    // Now type in B; verify it persists under B alone.
    act(() => h.api().setDraft('text-for-B'));
    await act(async () => {
      jest.advanceTimersByTime(350);
      await Promise.resolve();
    });
    expect(await loadDraft(A)).toBe('text-for-A');
    expect(await loadDraft(B)).toBe('text-for-B');

    h.unmount();
  });
});
