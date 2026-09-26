import { queryClient } from '../../lib/queryClient';
import { appQueryKeys } from '../../lib/appQueryKeys';
import { writeGroupMessagesCache } from '../../lib/chatMessageCache';
import {
  buildPrimedGroup,
  chatGroupOpenParams,
  chatMessagesCacheTip,
  chatOpenHintFromParams,
  filterThreadForOpenGroup,
  hasWarmChatMessages,
  readCachedChatGroup,
  seedMessagesForOpen,
} from '../../lib/chatOpenPrime';
import type { ChatGroup, ChatMessage } from '../../types/chat.types';

const group = (over: Partial<ChatGroup> = {}): ChatGroup =>
  ({
    id: 'g1',
    name: 'קבוצת בדיקה',
    created_by: 'u1',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    members_count: 3,
    messages_count: 10,
    settings: {},
    unread_count: 2,
    last_read_message_id: 'm-read',
    my_role: 'member',
    ...over,
  }) as ChatGroup;

const msg = (over: Partial<ChatMessage>): ChatMessage =>
  ({
    id: 'm1',
    group_id: 'g1',
    sender_id: 'u1',
    message_type: 'text',
    content: 'שלום',
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

describe('chatOpenPrime', () => {
  afterEach(() => {
    queryClient.removeQueries({ queryKey: appQueryKeys.chatMessages('g1') });
    queryClient.removeQueries({ queryKey: appQueryKeys.chatGroups('user-1') });
  });

  it('builds a usable header from list-row hint without waiting for details', () => {
    const primed = buildPrimedGroup('g1', null, {
      name: 'הכרזות',
      avatar_url: 'https://example.com/a.jpg',
      unread_count: 4,
      last_read_message_id: 'lr1',
      my_role: 'admin',
    });
    expect(primed.id).toBe('g1');
    expect(primed.name).toBe('הכרזות');
    expect(primed.avatar_url).toBe('https://example.com/a.jpg');
    expect(primed.is_admin).toBe(true);
    expect(primed.members).toEqual([]);
    expect(primed.unread_count).toBe(4);
    expect(primed.last_read_message_id).toBe('lr1');
  });

  it('prefers cached group fields over the list hint', () => {
    const primed = buildPrimedGroup(
      'g1',
      group({ name: 'מהקאש', unread_count: 1 }),
      { name: 'מהרשימה', unread_count: 9 },
    );
    expect(primed.name).toBe('מהקאש');
    expect(primed.unread_count).toBe(1);
  });

  it('reads the list-row group from queryClient', () => {
    queryClient.setQueryData(appQueryKeys.chatGroups('user-1'), [group()]);
    expect(readCachedChatGroup('user-1', 'g1')?.name).toBe('קבוצת בדיקה');
    expect(readCachedChatGroup('user-1', 'missing')).toBeNull();
  });

  it('seeds open messages from memory cache without wiping another thread', () => {
    writeGroupMessagesCache('g1', [
      msg({ id: 'new', created_at: '2026-01-01T12:00:00.000Z' }),
      msg({ id: 'old', created_at: '2026-01-01T09:00:00.000Z' }),
    ]);
    const seeded = seedMessagesForOpen('g1');
    expect(seeded.map((m) => m.id)).toEqual(['new', 'old']);
    expect(hasWarmChatMessages('g1')).toBe(true);
    expect(hasWarmChatMessages('g-missing')).toBe(false);
  });

  it('keeps pending outbound when seeding the open path', () => {
    writeGroupMessagesCache('g1', [msg({ id: 'server' })]);
    const seeded = seedMessagesForOpen('g1', [
      msg({
        id: 'temp-1',
        client_message_id: 'cid',
        is_sending: true,
        created_at: '2026-01-01T13:00:00.000Z',
      }),
    ]);
    expect(seeded[0].id).toBe('temp-1');
    expect(seeded.some((m) => m.id === 'server')).toBe(true);
  });

  it('builds navigate params so the header paints during the slide', () => {
    expect(chatGroupOpenParams(group({ name: 'צוות' }))).toEqual({
      groupId: 'g1',
      groupName: 'צוות',
      avatarUrl: undefined,
      unreadCount: 2,
      lastReadMessageId: 'm-read',
    });
    expect(
      chatOpenHintFromParams({
        groupName: 'צוות',
        unreadCount: 2,
        lastReadMessageId: 'm-read',
      }).name,
    ).toBe('צוות');
  });

  it('does not paint another group thread after the header was primed', () => {
    const other = [msg({ id: 'x', group_id: 'g-other' })];
    expect(filterThreadForOpenGroup(other, 'g1')).toBeNull();
    expect(filterThreadForOpenGroup([msg({ id: 'mine', group_id: 'g1' })], 'g1')?.[0].id).toBe(
      'mine',
    );
  });

  it('cache tip changes only when the thread window changes', () => {
    const a = [msg({ id: 'a' }), msg({ id: 'b' })];
    const b = [msg({ id: 'a' }), msg({ id: 'b' })];
    const c = [msg({ id: 'c' }), msg({ id: 'b' })];
    expect(chatMessagesCacheTip(a)).toBe(chatMessagesCacheTip(b));
    expect(chatMessagesCacheTip(a)).not.toBe(chatMessagesCacheTip(c));
    expect(chatMessagesCacheTip([])).toBe('0');
  });
});
