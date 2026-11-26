import { supabase } from './supabase';
import { queryClient } from '../lib/queryClient';
import { logger } from '../utils/logger';

export type ReportTargetType = 'message' | 'post' | 'post_reply' | 'message_comment' | 'story' | 'user';
export type ReportReason = 'spam' | 'harassment' | 'hate' | 'sexual' | 'violence' | 'scam' | 'other';

export const REPORT_REASONS: { key: ReportReason; label: string }[] = [
  { key: 'spam', label: 'ספאם או פרסום' },
  { key: 'scam', label: 'הונאה או התחזות' },
  { key: 'harassment', label: 'הטרדה או בריונות' },
  { key: 'hate', label: 'דברי שנאה' },
  { key: 'sexual', label: 'תוכן מיני' },
  { key: 'violence', label: 'אלימות או תוכן לא חוקי' },
  { key: 'other', label: 'אחר' },
];

export const blockedUsersKey = (userId: string) => ['moderation', 'blocked', userId] as const;

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function reportContent(input: {
  targetType: ReportTargetType;
  targetId: string;
  targetUserId?: string | null;
  reason: ReportReason;
  snapshot?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const uid = await currentUserId();
  if (!uid) return { ok: false, error: 'not_authenticated' };
  const { error } = await supabase.from('content_reports').insert({
    reporter_id: uid,
    target_type: input.targetType,
    target_id: input.targetId,
    target_user_id: input.targetUserId ?? null,
    reason: input.reason,
    content_snapshot: input.snapshot ? input.snapshot.slice(0, 4000) : null,
  });
  // 23505 — כבר דיווחת על זה; מבחינת המשתמש זה הצליח
  if (error && error.code !== '23505') {
    logger.error('moderationService', 'report failed', error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function fetchBlockedUserIds(): Promise<string[]> {
  const uid = await currentUserId();
  if (!uid) return [];
  const { data, error } = await supabase.from('user_blocks').select('blocked_id').eq('blocker_id', uid);
  if (error) {
    logger.warn('moderationService', 'fetch blocks failed', error);
    return [];
  }
  return (data ?? []).map((r: { blocked_id: string }) => r.blocked_id);
}

export async function blockUser(blockedId: string): Promise<boolean> {
  const uid = await currentUserId();
  if (!uid || uid === blockedId) return false;
  const { error } = await supabase
    .from('user_blocks')
    .upsert({ blocker_id: uid, blocked_id: blockedId }, { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true });
  if (error) {
    logger.error('moderationService', 'block failed', error);
    return false;
  }
  queryClient.setQueryData<string[]>(blockedUsersKey(uid), (prev) =>
    prev?.includes(blockedId) ? prev : [...(prev ?? []), blockedId],
  );
  return true;
}

export async function unblockUser(blockedId: string): Promise<boolean> {
  const uid = await currentUserId();
  if (!uid) return false;
  const { error } = await supabase.from('user_blocks').delete().eq('blocker_id', uid).eq('blocked_id', blockedId);
  if (error) {
    logger.error('moderationService', 'unblock failed', error);
    return false;
  }
  queryClient.setQueryData<string[]>(blockedUsersKey(uid), (prev) => (prev ?? []).filter((id) => id !== blockedId));
  return true;
}

/** האם המשתמש אישר את תנאי התוכן («אפס סובלנות»). */
export async function hasAcceptedUgcTerms(): Promise<boolean> {
  const uid = await currentUserId();
  if (!uid) return false;
  const { data } = await supabase.from('users').select('ugc_terms_accepted_at').eq('id', uid).maybeSingle();
  return !!(data as { ugc_terms_accepted_at?: string | null } | null)?.ugc_terms_accepted_at;
}

export async function acceptUgcTerms(): Promise<boolean> {
  const { error } = await supabase.rpc('accept_ugc_terms');
  if (error) logger.error('moderationService', 'accept terms failed', error);
  return !error;
}
