import type { ChatReactionGroup } from '../types/chat.types';

export type ReactionUser = {
  id: string;
  name: string;
  profile_picture?: string | null;
};

export function totalReactionCount(reactions: ChatReactionGroup[] | undefined): number {
  if (!reactions?.length) return 0;
  return reactions.reduce((sum, r) => sum + (r.count || 0), 0);
}

export function userHasReacted(
  reactions: ChatReactionGroup[] | undefined,
  userId: string,
  emoji?: string,
): boolean {
  if (!reactions?.length) return false;
  return reactions.some(
    (r) =>
      (!emoji || r.emoji === emoji) &&
      (r.reacted_by_me || r.users?.some((u) => u.id === userId)),
  );
}

export function applyReactionInsert(
  reactions: ChatReactionGroup[] | undefined,
  emoji: string,
  actor: ReactionUser,
  options?: { isActorMe?: boolean },
): ChatReactionGroup[] {
  const current = reactions ?? [];
  const group = current.find((r) => r.emoji === emoji);
  const isActorMe = !!options?.isActorMe;

  if (group?.users?.some((u) => u.id === actor.id)) {
    return current;
  }

  if (group) {
    return current.map((r) =>
      r.emoji === emoji
        ? {
            ...r,
            count: r.count + 1,
            reacted_by_me: r.reacted_by_me || isActorMe,
            users: [...r.users, actor],
          }
        : r,
    );
  }

  return [
    ...current,
    {
      emoji,
      count: 1,
      reacted_by_me: isActorMe,
      users: [actor],
    },
  ];
}

export function applyReactionRemove(
  reactions: ChatReactionGroup[] | undefined,
  emoji: string,
  userId: string,
  meId?: string,
): ChatReactionGroup[] {
  const current = reactions ?? [];
  const group = current.find((r) => r.emoji === emoji);
  if (!group?.users?.some((u) => u.id === userId)) {
    return current;
  }

  if (group.count > 1) {
    return current
      .map((r) => {
        if (r.emoji !== emoji) return r;
        const users = r.users.filter((u) => u.id !== userId);
        return {
          ...r,
          count: r.count - 1,
          users,
          reacted_by_me: meId ? users.some((u) => u.id === meId) : false,
        };
      })
      .filter((r) => r.count > 0);
  }

  return current.filter((r) => r.emoji !== emoji);
}
