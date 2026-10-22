import { supabase } from '../../lib/supabase';

/** תגובה להודעה (שרשור בקבוצות הכרזות) */
export type MessageComment = {
  id: string;
  messageId: string;
  groupId: string;
  userId: string;
  body: string;
  createdAt: string;
  author: { id: string; displayName: string; avatarUrl: string | null };
};

const SELECT = `
  id, message_id, group_id, user_id, body, created_at,
  author:users!chat_message_comments_user_id_fkey ( id, display_name, full_name, profile_picture )
`;

type Row = {
  id: string;
  message_id: string;
  group_id: string;
  user_id: string;
  body: string;
  created_at: string;
  author?: { id?: string; display_name?: string | null; full_name?: string | null; profile_picture?: string | null } | null;
};

function mapRow(r: Row): MessageComment {
  const a = r.author ?? {};
  return {
    id: r.id,
    messageId: r.message_id,
    groupId: r.group_id,
    userId: r.user_id,
    body: r.body,
    createdAt: r.created_at,
    author: {
      id: r.user_id,
      displayName: (a.display_name || a.full_name || 'חבר קהילה').trim(),
      avatarUrl: a.profile_picture || null,
    },
  };
}

export const MESSAGE_COMMENT_MAX_LEN = 1000;

export async function fetchMessageComments(messageId: string): Promise<MessageComment[]> {
  const { data, error } = await supabase
    .from('chat_message_comments')
    .select(SELECT)
    .eq('message_id', messageId)
    .order('created_at', { ascending: true })
    .limit(500);
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map(mapRow);
}

export async function fetchMessageCommentById(id: string): Promise<MessageComment | null> {
  const { data, error } = await supabase.from('chat_message_comments').select(SELECT).eq('id', id).maybeSingle();
  if (error || !data) return null;
  return mapRow(data as unknown as Row);
}

export async function addMessageComment(input: { messageId: string; groupId: string; body: string }): Promise<MessageComment> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error('יש להתחבר כדי להגיב');
  const body = input.body.trim();
  if (!body) throw new Error('התגובה ריקה');
  if (body.length > MESSAGE_COMMENT_MAX_LEN) throw new Error(`התגובה ארוכה מדי (עד ${MESSAGE_COMMENT_MAX_LEN} תווים)`);
  const { data, error } = await supabase
    .from('chat_message_comments')
    .insert({ message_id: input.messageId, group_id: input.groupId, user_id: uid, body })
    .select(SELECT)
    .single();
  if (error) throw error;
  return mapRow(data as unknown as Row);
}

export async function deleteMessageComment(id: string): Promise<void> {
  const { error } = await supabase.from('chat_message_comments').delete().eq('id', id);
  if (error) throw error;
}
