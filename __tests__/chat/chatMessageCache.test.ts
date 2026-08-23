import { mergeChatMessages } from '../../lib/chatMessageCache';
import type { ChatMessage } from '../../types/chat.types';

const base = (over: Partial<ChatMessage>): ChatMessage =>
  ({
    id: 'm1',
    group_id: 'g1',
    sender_id: 'u1',
    message_type: 'text',
    content: 'orig',
    created_at: '2026-01-01T10:00:00.000Z',
    is_forwarded: false,
    mentioned_users: [],
    is_edited: false,
    is_deleted: false,
    deleted_for_everyone: false,
    is_silent: false,
    is_system_message: false,
    reactions_count: 0,
    read_by_count: 0,
    ...over,
  }) as ChatMessage;

describe('mergeChatMessages', () => {
  it('later batch wins when neither copy was edited', () => {
    const out = mergeChatMessages([base({ content: 'first' })], [base({ content: 'second' })]);
    expect(out).toHaveLength(1);
    expect(out[0].content).toBe('second');
  });

  it('real message replaces optimistic temp copy', () => {
    const out = mergeChatMessages(
      [base({ id: 'temp-1', is_sending: true })],
      [base({ id: 'temp-1', content: 'confirmed' })],
    );
    expect(out[0].content).toBe('confirmed');
  });

  it('edited copy is not clobbered by a stale unedited copy', () => {
    const edited = base({
      content: 'edited text',
      is_edited: true,
      edited_at: '2026-01-01T12:00:00.000Z',
    });
    const stale = base({ content: 'orig' });
    const out = mergeChatMessages([edited], [stale]);
    expect(out[0].content).toBe('edited text');
  });

  it('newer edit from server overrides older cached copy', () => {
    const cached = base({ content: 'orig' });
    const fresh = base({
      content: 'edited text',
      is_edited: true,
      edited_at: '2026-01-01T12:00:00.000Z',
    });
    const out = mergeChatMessages([cached], [fresh]);
    expect(out[0].content).toBe('edited text');
  });

  it('keeps newest-first ordering across batches', () => {
    const older = base({ id: 'a', created_at: '2026-01-01T09:00:00.000Z' });
    const newer = base({ id: 'b', created_at: '2026-01-01T11:00:00.000Z' });
    const out = mergeChatMessages([older], [newer]);
    expect(out.map((m) => m.id)).toEqual(['b', 'a']);
  });

  it('does not clobber sender when newer copy lacks profile', () => {
    const withSender = base({
      sender: {
        id: 'u1',
        display_name: 'שובל בסט',
        profile_picture: 'https://example.com/a.jpg',
      },
    });
    const lean = base({ content: 'orig', sender: undefined });
    const out = mergeChatMessages([withSender], [lean]);
    expect(out[0].sender?.display_name).toBe('שובל בסט');
    expect(out[0].sender?.profile_picture).toBe('https://example.com/a.jpg');
  });

  it('prefers usable sender from the newer copy', () => {
    const cached = base({
      sender: { id: 'u1', display_name: 'ישן' },
    });
    const fresh = base({
      sender: {
        id: 'u1',
        display_name: 'חדש',
        profile_picture: 'https://example.com/b.jpg',
      },
    });
    const out = mergeChatMessages([cached], [fresh]);
    expect(out[0].sender?.display_name).toBe('חדש');
    expect(out[0].sender?.profile_picture).toBe('https://example.com/b.jpg');
  });

  it('preserves reactions when lean copy has none', () => {
    const withReactions = base({
      reactions: [
        {
          emoji: '🔥',
          count: 1,
          reacted_by_me: true,
          users: [{ id: 'u1', name: 'Me' }],
        },
      ],
      reactions_count: 1,
    });
    const lean = base({ content: 'orig', reactions: [], reactions_count: 0 });
    const out = mergeChatMessages([withReactions], [lean]);
    expect(out[0].reactions?.[0]?.emoji).toBe('🔥');
    expect(out[0].reactions?.[0]?.reacted_by_me).toBe(true);
  });
});
