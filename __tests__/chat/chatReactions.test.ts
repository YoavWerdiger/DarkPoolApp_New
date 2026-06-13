import {
  applyReactionInsert,
  applyReactionRemove,
  totalReactionCount,
} from '../../utils/chatReactions';

const me = { id: 'u1', name: 'Me' };
const other = { id: 'u2', name: 'Other' };

describe('chatReactions', () => {
  it('adds and totals reactions without duplicate users', () => {
    let reactions = applyReactionInsert(undefined, '👍', me, { isActorMe: true });
    reactions = applyReactionInsert(reactions, '👍', me, { isActorMe: true });
    expect(totalReactionCount(reactions)).toBe(1);
  });

  it('removes my reaction cleanly', () => {
    const reactions = applyReactionInsert(undefined, '❤️', me, { isActorMe: true });
    const next = applyReactionRemove(reactions, '❤️', me.id, me.id);
    expect(next).toHaveLength(0);
  });

  it('merges other user reactions from realtime', () => {
    const base = applyReactionInsert(undefined, '🔥', me, { isActorMe: true });
    const merged = applyReactionInsert(base, '🔥', other, { isActorMe: false });
    expect(totalReactionCount(merged)).toBe(2);
    expect(merged[0].reacted_by_me).toBe(true);
  });
});
