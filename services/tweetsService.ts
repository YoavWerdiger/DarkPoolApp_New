import { supabase } from './supabase';
import type {
  CommunityMention,
  CommunityPost,
  CommunityPostAuthor,
  CommunityPostReply,
  CommunityPostsPage,
  CreateCommunityPostInput,
  CreateCommunityPostReplyInput,
} from '../types/tweets.types';
import {
  isShareableAttachment,
  type ShareableAttachment,
} from '../types/shareableEntity';

const PAGE_SIZE = 30;

export type CommunityFeedMode = 'for_you' | 'following';
const REPLY_MAX_LEN = 1000;
const MAX_ATTACHMENTS = 5;
const MAX_MENTIONS = 10;

type UserEmbed = {
  id: string;
  display_name: string | null;
  full_name: string | null;
  profile_picture: string | null;
  avatar_url: string | null;
};

type LikeEmbed = { user_id: string };
type ReplyEmbed = { id: string };

type PostRow = {
  id: string;
  user_id: string;
  body: string;
  image_url: string | null;
  attachment: unknown | null;
  attachments?: unknown | null;
  mentions?: unknown | null;
  created_at: string;
  updated_at: string;
  author: UserEmbed | UserEmbed[] | null;
  likes: LikeEmbed[] | null;
  replies: ReplyEmbed[] | null;
};

type ReplyRow = {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
  author: UserEmbed | UserEmbed[] | null;
};

function mapAuthor(raw: UserEmbed | UserEmbed[] | null, fallbackId: string): CommunityPostAuthor {
  const u = Array.isArray(raw) ? raw[0] : raw;
  const displayName =
    (u?.display_name && u.display_name.trim()) ||
    (u?.full_name && u.full_name.trim()) ||
    'חבר קהילה';
  const avatarUrl = u?.profile_picture || u?.avatar_url || null;
  return {
    id: u?.id ?? fallbackId,
    displayName,
    avatarUrl,
  };
}

function mapAttachment(raw: unknown): ShareableAttachment | null {
  return isShareableAttachment(raw) ? raw : null;
}

function mapAttachments(
  attachmentsRaw: unknown,
  legacyAttachment: unknown
): ShareableAttachment[] {
  const fromArr = Array.isArray(attachmentsRaw)
    ? attachmentsRaw.filter(isShareableAttachment)
    : [];
  if (fromArr.length > 0) return fromArr.slice(0, MAX_ATTACHMENTS);
  const single = mapAttachment(legacyAttachment);
  return single ? [single] : [];
}

function mapMentions(raw: unknown): CommunityMention[] {
  if (!Array.isArray(raw)) return [];
  const out: CommunityMention[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const userId =
      (typeof rec.userId === 'string' && rec.userId) ||
      (typeof rec.user_id === 'string' && rec.user_id) ||
      '';
    const displayName =
      (typeof rec.displayName === 'string' && rec.displayName.trim()) ||
      (typeof rec.display_name === 'string' && rec.display_name.trim()) ||
      '';
    if (!userId || !displayName) continue;
    if (out.some((m) => m.userId === userId)) continue;
    out.push({ userId, displayName });
    if (out.length >= MAX_MENTIONS) break;
  }
  return out;
}

function normalizeMentionsInput(
  mentions: CommunityMention[] | null | undefined
): CommunityMention[] {
  return mapMentions(mentions ?? []);
}

function normalizeAttachmentsInput(input: CreateCommunityPostInput): ShareableAttachment[] {
  const fromList = Array.isArray(input.attachments)
    ? input.attachments.filter(isShareableAttachment)
    : [];
  if (fromList.length > 0) return fromList.slice(0, MAX_ATTACHMENTS);
  if (input.attachment && isShareableAttachment(input.attachment)) {
    return [input.attachment];
  }
  return [];
}

function mapRow(row: PostRow, currentUserId: string | null): CommunityPost {
  const likes = row.likes ?? [];
  const replies = row.replies ?? [];
  const attachments = mapAttachments(row.attachments, row.attachment);
  return {
    id: row.id,
    userId: row.user_id,
    body: row.body,
    imageUrl: row.image_url,
    attachment: attachments[0] ?? mapAttachment(row.attachment),
    attachments,
    mentions: mapMentions(row.mentions),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: mapAuthor(row.author, row.user_id),
    likeCount: likes.length,
    likedByMe: currentUserId
      ? likes.some((l) => l.user_id === currentUserId)
      : false,
    replyCount: replies.length,
  };
}

function mapReplyRow(row: ReplyRow): CommunityPostReply {
  return {
    id: row.id,
    postId: row.post_id,
    userId: row.user_id,
    body: row.body,
    createdAt: row.created_at,
    author: mapAuthor(row.author, row.user_id),
  };
}

const AUTHOR_SELECT = `
  id,
  display_name,
  full_name,
  profile_picture,
  avatar_url
`;

const POST_SELECT = `
  id,
  user_id,
  body,
  image_url,
  attachment,
  attachments,
  mentions,
  created_at,
  updated_at,
  author:users!community_posts_user_id_fkey (
    ${AUTHOR_SELECT}
  ),
  likes:community_post_likes ( user_id ),
  replies:community_post_replies ( id )
`;

const REPLY_SELECT = `
  id,
  post_id,
  user_id,
  body,
  created_at,
  author:users!community_post_replies_user_id_fkey (
    ${AUTHOR_SELECT}
  )
`;

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function fetchCommunityPostsByUser(
  userId: string,
  limit = 20
): Promise<CommunityPost[]> {
  const uid = await currentUserId();
  const { data, error } = await supabase
    .from('community_posts')
    .select(POST_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return ((data ?? []) as unknown as PostRow[]).map((row) => mapRow(row, uid));
}

export async function fetchFollowedUserIds(): Promise<string[]> {
  const uid = await currentUserId();
  if (!uid) return [];

  const { data, error } = await supabase
    .from('user_follows')
    .select('following_id')
    .eq('follower_id', uid);

  if (error) {
    console.warn('fetchFollowedUserIds', error.message);
    return [];
  }

  return (data ?? [])
    .map((row) => String(row.following_id ?? ''))
    .filter(Boolean);
}

export async function fetchCommunityPosts(opts: {
  offset?: number;
  limit?: number;
  mode?: CommunityFeedMode;
} = {}): Promise<CommunityPostsPage> {
  const limit = opts.limit ?? PAGE_SIZE;
  const offset = opts.offset ?? 0;
  const mode = opts.mode ?? 'for_you';
  const uid = await currentUserId();

  if (mode === 'following' && !uid) {
    return { posts: [], hasMore: false };
  }

  let followedIds: string[] | null = null;
  if (mode === 'following') {
    followedIds = await fetchFollowedUserIds();
    if (followedIds.length === 0) {
      return { posts: [], hasMore: false };
    }
  }

  let query = supabase
    .from('community_posts')
    .select(POST_SELECT)
    .order('created_at', { ascending: false });

  if (followedIds?.length) {
    query = query.in('user_id', followedIds);
  }

  const { data, error } = await query.range(offset, offset + limit - 1);

  if (error) throw error;

  const posts = ((data ?? []) as unknown as PostRow[]).map((row) =>
    mapRow(row, uid)
  );
  return { posts, hasMore: posts.length >= limit };
}

export async function createCommunityPost(
  input: CreateCommunityPostInput
): Promise<CommunityPost> {
  const uid = await currentUserId();
  if (!uid) throw new Error('יש להתחבר כדי לפרסם');

  const body = input.body.trim();
  if (body.length < 1) throw new Error('הציוץ ריק');
  if (body.length > 2000) throw new Error('הציוץ ארוך מדי (עד 2000 תווים)');

  const attachments = normalizeAttachmentsInput(input);
  const mentions = normalizeMentionsInput(input.mentions);

  const { data, error } = await supabase
    .from('community_posts')
    .insert({
      user_id: uid,
      body,
      image_url: input.imageUrl?.trim() || null,
      attachment: attachments[0] ?? null,
      attachments,
      mentions,
    })
    .select(POST_SELECT)
    .single();

  if (error) throw error;
  return mapRow(data as unknown as PostRow, uid);
}

export async function deleteCommunityPost(postId: string): Promise<void> {
  const { error } = await supabase
    .from('community_posts')
    .delete()
    .eq('id', postId);
  if (error) throw error;
}

export async function likeCommunityPost(postId: string): Promise<void> {
  const uid = await currentUserId();
  if (!uid) throw new Error('יש להתחבר');
  const { error } = await supabase
    .from('community_post_likes')
    .insert({ post_id: postId, user_id: uid });
  if (error && error.code !== '23505') throw error;
}

export async function unlikeCommunityPost(postId: string): Promise<void> {
  const uid = await currentUserId();
  if (!uid) throw new Error('יש להתחבר');
  const { error } = await supabase
    .from('community_post_likes')
    .delete()
    .eq('post_id', postId)
    .eq('user_id', uid);
  if (error) throw error;
}

export async function fetchCommunityPostReplies(
  postId: string
): Promise<CommunityPostReply[]> {
  const { data, error } = await supabase
    .from('community_post_replies')
    .select(REPLY_SELECT)
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return ((data ?? []) as unknown as ReplyRow[]).map(mapReplyRow);
}

export async function createCommunityPostReply(
  input: CreateCommunityPostReplyInput
): Promise<CommunityPostReply> {
  const uid = await currentUserId();
  if (!uid) throw new Error('יש להתחבר כדי להגיב');

  const body = input.body.trim();
  if (body.length < 1) throw new Error('התגובה ריקה');
  if (body.length > REPLY_MAX_LEN) {
    throw new Error(`התגובה ארוכה מדי (עד ${REPLY_MAX_LEN} תווים)`);
  }

  const { data, error } = await supabase
    .from('community_post_replies')
    .insert({
      post_id: input.postId,
      user_id: uid,
      body,
    })
    .select(REPLY_SELECT)
    .single();

  if (error) throw error;
  return mapReplyRow(data as unknown as ReplyRow);
}

export async function deleteCommunityPostReply(replyId: string): Promise<void> {
  const { error } = await supabase
    .from('community_post_replies')
    .delete()
    .eq('id', replyId);
  if (error) throw error;
}

export type CommunityPostRealtimeHandler = (post: CommunityPost) => void;

export function subscribeToCommunityPosts(
  onInsert: CommunityPostRealtimeHandler
): () => void {
  const channelName = `community_posts_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'community_posts',
      },
      async (payload) => {
        const id = (payload.new as { id?: string })?.id;
        if (!id) return;
        try {
          const uid = await currentUserId();
          const { data, error } = await supabase
            .from('community_posts')
            .select(POST_SELECT)
            .eq('id', id)
            .maybeSingle();
          if (error || !data) return;
          onInsert(mapRow(data as unknown as PostRow, uid));
        } catch {
          /* ignore */
        }
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export function formatPostTime(iso: string): string {
  if (!iso) return '';
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const now = Date.now();
    const diffSec = Math.max(0, Math.floor((now - date.getTime()) / 1000));
    if (diffSec < 60) return 'עכשיו';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} דק׳`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} שע׳`;
    if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)} ימים`;
    return date.toLocaleDateString('he-IL', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return '';
  }
}
