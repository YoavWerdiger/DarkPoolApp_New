import {
  loadDraft,
  saveDraft,
  clearDraft,
  clearAllDrafts,
} from '../../services/chat/chatDrafts';

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

afterEach(async () => {
  await clearAllDrafts();
});

describe('chat drafts (per-group persistence)', () => {
  it('returns "" when nothing was ever saved', async () => {
    expect(await loadDraft(A)).toBe('');
  });

  it('round-trips text through AsyncStorage', async () => {
    await saveDraft(A, 'half-written message');
    expect(await loadDraft(A)).toBe('half-written message');
  });

  it('keeps drafts isolated per group', async () => {
    await saveDraft(A, 'draft for A');
    await saveDraft(B, 'draft for B');
    expect(await loadDraft(A)).toBe('draft for A');
    expect(await loadDraft(B)).toBe('draft for B');
  });

  it('treats an empty string the same as clear (no key persisted)', async () => {
    await saveDraft(A, 'temp');
    expect(await loadDraft(A)).toBe('temp');
    await saveDraft(A, '');
    expect(await loadDraft(A)).toBe('');
  });

  it('clearDraft only affects the requested group', async () => {
    await saveDraft(A, 'A');
    await saveDraft(B, 'B');
    await clearDraft(A);
    expect(await loadDraft(A)).toBe('');
    expect(await loadDraft(B)).toBe('B');
  });

  it('handles empty groupId without throwing', async () => {
    await expect(saveDraft('', 'anything')).resolves.toBeUndefined();
    expect(await loadDraft('')).toBe('');
    await expect(clearDraft('')).resolves.toBeUndefined();
  });

  it('clearAllDrafts removes only keys under our prefix', async () => {
    await saveDraft(A, 'a');
    await saveDraft(B, 'b');
    const AsyncStorage =
      require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.setItem('@some-other-feature', 'keep-me');

    await clearAllDrafts();

    expect(await loadDraft(A)).toBe('');
    expect(await loadDraft(B)).toBe('');
    expect(await AsyncStorage.getItem('@some-other-feature')).toBe('keep-me');
  });
});
