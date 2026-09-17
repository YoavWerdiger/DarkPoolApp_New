import {
  chatMessageListKey,
  dedupeOwnOutboundCopies,
  findMatchingOptimisticIndex,
  morphOptimisticIntoServer,
  seedReplyFromThread,
  seedSenderFromThread,
  isUsableChatDisplayName,
} from '../../lib/chatMessageIdentity';
import type { ChatMessage } from '../../types/chat.types';

const base = (over: Partial<ChatMessage>): ChatMessage =>
  ({
    id: 'm1',
    group_id: 'g1',
    sender_id: 'me',
    message_type: 'text',
    content: 'hello',
    created_at: '2026-08-30T10:00:00.000Z',
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

describe('chatMessageListKey', () => {
  it('prefers client_message_id over temp id', () => {
    expect(
      chatMessageListKey({
        id: 'temp-1',
        client_message_id: 'cid-1',
        local_id: 'temp-1',
      }),
    ).toBe('cid-1');
  });

  it('falls back to local_id then id', () => {
    expect(chatMessageListKey({ id: 'temp-1', local_id: 'temp-1' })).toBe('temp-1');
    expect(chatMessageListKey({ id: 'srv-1' })).toBe('srv-1');
  });

  it('stays stable across optimistic → server morph', () => {
    const optimistic = base({
      id: 'temp-1',
      local_id: 'temp-1',
      client_message_id: 'cid-1',
      is_sending: true,
    });
    const server = base({
      id: '11111111-1111-4111-8111-111111111111',
      client_message_id: 'cid-1',
    });
    const morphed = morphOptimisticIntoServer(optimistic, server);
    expect(chatMessageListKey(optimistic)).toBe(chatMessageListKey(morphed));
    expect(morphed.id).toBe(server.id);
    expect(morphed.is_sending).toBe(false);
  });
});

describe('findMatchingOptimisticIndex', () => {
  it('matches by client_message_id even when ids differ', () => {
    const prev = [
      base({ id: 'temp-1', local_id: 'temp-1', client_message_id: 'cid-1', is_sending: true }),
    ];
    const incoming = base({
      id: '11111111-1111-4111-8111-111111111111',
      client_message_id: 'cid-1',
    });
    expect(findMatchingOptimisticIndex(prev, incoming, 'me')).toBe(0);
  });

  it('matches by local_id / temp id', () => {
    const prev = [base({ id: 'temp-9', local_id: 'temp-9', is_sending: true })];
    const incoming = base({
      id: '11111111-1111-4111-8111-111111111111',
      local_id: 'temp-9',
    });
    expect(findMatchingOptimisticIndex(prev, incoming, 'me')).toBe(0);
  });

  it('fuzzy-matches pending own text in the send window', () => {
    const prev = [
      base({
        id: 'temp-2',
        content: 'hello',
        is_sending: true,
        created_at: '2026-08-30T10:00:01.000Z',
      }),
    ];
    const incoming = base({
      id: '11111111-1111-4111-8111-111111111111',
      content: 'hello',
      created_at: '2026-08-30T10:00:02.000Z',
    });
    expect(findMatchingOptimisticIndex(prev, incoming, 'me')).toBe(0);
  });

  it('does not match a confirmed own message from another device', () => {
    const prev = [
      base({
        id: '22222222-2222-4222-8222-222222222222',
        content: 'hello',
        client_message_id: 'other-device',
      }),
    ];
    const incoming = base({
      id: '11111111-1111-4111-8111-111111111111',
      content: 'hello',
      client_message_id: 'this-device',
    });
    expect(findMatchingOptimisticIndex(prev, incoming, 'me')).toBe(-1);
  });
});

describe('dedupeOwnOutboundCopies', () => {
  it('collapses optimistic + server copies of the same send', () => {
    const optimistic = base({
      id: 'temp-1',
      local_id: 'temp-1',
      client_message_id: 'cid-1',
      is_sending: true,
      sender: { id: 'me', display_name: 'אני' },
    });
    const server = base({
      id: '11111111-1111-4111-8111-111111111111',
      client_message_id: 'cid-1',
      content: 'hello',
    });
    const out = dedupeOwnOutboundCopies([optimistic, server]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(server.id);
    expect(out[0].client_message_id).toBe('cid-1');
    expect(out[0].local_id).toBe('temp-1');
    expect(chatMessageListKey(out[0])).toBe('cid-1');
  });

  it('keeps two different messages', () => {
    const a = base({ id: 'a', content: 'one' });
    const b = base({ id: 'b', content: 'two' });
    expect(dedupeOwnOutboundCopies([a, b])).toHaveLength(2);
  });
});

describe('isUsableChatDisplayName', () => {
  it('rejects empty and the משתמש placeholder', () => {
    expect(isUsableChatDisplayName(undefined)).toBe(false);
    expect(isUsableChatDisplayName('')).toBe(false);
    expect(isUsableChatDisplayName('משתמש')).toBe(false);
    expect(isUsableChatDisplayName('  משתמש  ')).toBe(false);
    expect(isUsableChatDisplayName('דנה')).toBe(true);
  });
});

describe('seedSenderFromThread', () => {
  it('copies a known sender from an earlier message without inventing one', () => {
    const known = base({
      id: 'old',
      sender_id: 'u2',
      sender: { id: 'u2', display_name: 'דנה', profile_picture: 'https://x/a.jpg' },
    });
    const incoming = base({ id: 'new', sender_id: 'u2', sender: undefined, content: 'hi' });
    const out = seedSenderFromThread(incoming, [known]);
    expect(out.sender?.display_name).toBe('דנה');
    expect(out.content).toBe('hi');
  });

  it('does not invent a sender when the thread has no match', () => {
    const incoming = base({ id: 'new', sender_id: 'u9', sender: undefined });
    expect(seedSenderFromThread(incoming, [base({ sender_id: 'u2' })]).sender).toBeUndefined();
  });
});

describe('seedReplyFromThread', () => {
  it('fills reply_to from the local original message', () => {
    const original = base({
      id: 'orig',
      content: 'שאלה',
      sender: { id: 'u2', display_name: 'דנה' },
    });
    const reply = base({
      id: 'r1',
      reply_to_message_id: 'orig',
      content: 'תשובה',
    });
    const out = seedReplyFromThread(reply, [original]);
    expect(out.reply_to?.content).toBe('שאלה');
    expect(out.reply_to?.sender_name).toBe('דנה');
  });
});
