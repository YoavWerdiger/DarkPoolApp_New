// ============================================
// Chat Search Service
// ============================================

import { supabase } from '../../lib/supabase';
import {
  ChatMessage,
  ChatGroup,
  ChatGroupMember,
  ChatSearchResult,
  ChatError,
} from '../../types/chat.types';

function sanitizeSearchTerm(term: string): string {
  if (!term || typeof term !== 'string') return '';
  const trimmed = term.trim();
  if (trimmed.length < 2 || trimmed.length > 200) return '';
  return trimmed.replace(/[%_\\]/g, '\\$&').replace(/[,()]/g, '');
}

function clampLimit(limit: number, max: number = 100): number {
  return Math.max(1, Math.min(limit, max));
}

function validateUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

// ============================================
// חיפוש הודעות בקבוצה
// ============================================

export async function searchMessagesInGroup(
  groupId: string,
  searchTerm: string,
  limit: number = 50,
  userId?: string
): Promise<{ data: ChatMessage[] | null; error: ChatError | null }> {
  try {
    if (!groupId || !validateUUID(groupId)) {
      return { data: null, error: { code: 'INVALID_INPUT', message: 'Invalid group ID' } };
    }
    const safe = sanitizeSearchTerm(searchTerm);
    if (!safe) return { data: [], error: null };
    const safeLimit = clampLimit(limit);

    // Verify membership if userId provided
    if (userId) {
      const { data: membership } = await supabase
        .from('chat_group_members')
        .select('id')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .single();
      if (!membership) return { data: null, error: { code: 'UNAUTHORIZED', message: 'Not a group member' } };
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .select(`
        *,
        sender:users!chat_messages_sender_id_fkey (
          id,
          display_name,
          profile_picture
        )
      `)
      .eq('group_id', groupId)
      .eq('is_deleted', false)
      .ilike('content', `%${safe}%`)
      .order('created_at', { ascending: false })
      .limit(safeLimit);

    if (error) return { data: null, error: { code: 'SEARCH_ERROR', message: 'Search failed' } };
    return { data: data as any, error: null };
  } catch (error: any) {
    return { data: null, error: { code: 'UNEXPECTED_ERROR', message: 'Search failed' } };
  }
}

// ============================================
// חיפוש הודעות בכל הקבוצות של משתמש
// ============================================

export async function searchMessagesInAllGroups(
  userId: string,
  searchTerm: string,
  limit: number = 50
): Promise<{ data: ChatSearchResult[] | null; error: ChatError | null }> {
  try {
    if (!userId || !validateUUID(userId)) {
      return { data: null, error: { code: 'INVALID_INPUT', message: 'Invalid user ID' } };
    }
    const safe = sanitizeSearchTerm(searchTerm);
    if (!safe) return { data: [], error: null };
    const safeLimit = clampLimit(limit);

    const { data: memberRows, error: memberError } = await supabase
      .from('chat_group_members')
      .select('group_id')
      .eq('user_id', userId);

    if (memberError || !memberRows?.length) {
      return { data: [], error: null };
    }

    const groupIds = memberRows.map(r => r.group_id);

    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select(`
        *,
        sender:users!chat_messages_sender_id_fkey (
          id,
          display_name,
          profile_picture
        ),
        chat_groups!chat_messages_group_id_fkey (
          id,
          name,
          avatar_url
        )
      `)
      .in('group_id', groupIds)
      .eq('is_deleted', false)
      .ilike('content', `%${safe}%`)
      .order('created_at', { ascending: false })
      .limit(safeLimit);

    if (messagesError) {
      return { data: null, error: { code: 'SEARCH_ERROR', message: 'Search failed' } };
    }

    const results: ChatSearchResult[] = ((messages || []) as any[]).map(msg => {
      const content = msg.content || '';
      const index = content.toLowerCase().indexOf(safe.toLowerCase());
      const start = Math.max(0, index - 50);
      const end = Math.min(content.length, index + safe.length + 50);
      const highlight = content.substring(start, end);

      return {
        message: msg,
        group: msg.chat_groups,
        highlights: [highlight],
      };
    });

    return { data: results, error: null };
  } catch (error: any) {
    return { data: null, error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// חיפוש קבוצות
// ============================================

export async function searchGroups(
  userId: string,
  searchTerm: string,
  limit: number = 20
): Promise<{ data: ChatGroup[] | null; error: ChatError | null }> {
  try {
    const safe = sanitizeSearchTerm(searchTerm);
    if (!safe) return { data: [], error: null };

    const { data, error } = await supabase
      .from('chat_group_members')
      .select(`
        chat_groups!inner (
          id,
          name,
          description,
          avatar_url,
          created_by,
          created_at,
          updated_at,
          members_count,
          messages_count,
          last_message_at,
          last_message_preview,
          settings
        )
      `)
      .eq('user_id', userId)
      .ilike('chat_groups.name', `%${safe}%`)
      .order('chat_groups.name')
      .limit(clampLimit(limit));

    if (error) {
      return { data: null, error: { code: 'SEARCH_ERROR', message: error.message } };
    }

    const groups = ((data || []) as any[]).map(item => item.chat_groups);
    return { data: groups, error: null };
  } catch (error: any) {
    return { data: null, error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// חיפוש משתמשים (לשם הוספה לקבוצה)
// ============================================

export async function searchUsers(
  searchTerm: string,
  excludeUserIds?: string[],
  limit: number = 20
): Promise<{ data: any[] | null; error: ChatError | null }> {
  try {
    const safe = sanitizeSearchTerm(searchTerm);
    if (!safe) return { data: [], error: null };

    let query = supabase
      .from('users')
      .select('id, display_name, full_name, profile_picture, is_online, last_active')
      .or(`display_name.ilike.%${safe}%,full_name.ilike.%${safe}%`)
      .order('display_name')
      .limit(clampLimit(limit));

    const validExcludeIds = excludeUserIds?.filter(id => validateUUID(id)) ?? [];
    if (validExcludeIds.length > 0) {
      query = query.not('id', 'in', `(${validExcludeIds.join(',')})`);
    }

    const { data, error } = await query;

    if (error) {
      return { data: null, error: { code: 'SEARCH_ERROR', message: error.message } };
    }
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// חיפוש משתמשים בקבוצה
// ============================================

export async function searchGroupMembers(
  groupId: string,
  searchTerm: string,
  limit: number = 50
): Promise<{ data: ChatGroupMember[] | null; error: ChatError | null }> {
  try {
    if (!groupId || !validateUUID(groupId)) {
      return { data: null, error: { code: 'INVALID_INPUT', message: 'Invalid group ID' } };
    }
    const safe = sanitizeSearchTerm(searchTerm);
    if (!safe) return { data: [], error: null };

    const { data, error } = await supabase
      .from('chat_group_members')
      .select(`
        *,
        user:users!inner (
          id,
          display_name,
          full_name,
          profile_picture,
          is_online,
          last_active
        )
      `)
      .eq('group_id', groupId)
      .or(`user.display_name.ilike.%${safe}%,user.full_name.ilike.%${safe}%`)
      .limit(clampLimit(limit));

    if (error) {
      return { data: null, error: { code: 'SEARCH_ERROR', message: error.message } };
    }

    return { data: data as any, error: null };
  } catch (error: any) {
    return { data: null, error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// חיפוש הודעות לפי שולח
// ============================================

export async function searchMessagesBySender(
  groupId: string,
  senderId: string,
  limit: number = 50
): Promise<{ data: ChatMessage[] | null; error: ChatError | null }> {
  try {
    if (!groupId || !validateUUID(groupId) || !senderId || !validateUUID(senderId)) {
      return { data: null, error: { code: 'INVALID_INPUT', message: 'Invalid group or sender ID' } };
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .select(`
        *,
        sender:users!chat_messages_sender_id_fkey (
          id,
          display_name,
          profile_picture
        )
      `)
      .eq('group_id', groupId)
      .eq('sender_id', senderId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(clampLimit(limit));

    if (error) {
      return { data: null, error: { code: 'SEARCH_ERROR', message: error.message } };
    }

    return { data: data as any, error: null };
  } catch (error: any) {
    return { data: null, error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// חיפוש הודעות עם מדיה
// ============================================

export async function searchMediaMessages(
  groupId: string,
  mediaType?: 'image' | 'video' | 'audio' | 'document',
  limit: number = 50
): Promise<{ data: ChatMessage[] | null; error: ChatError | null }> {
  try {
    if (!groupId || !validateUUID(groupId)) {
      return { data: null, error: { code: 'INVALID_INPUT', message: 'Invalid group ID' } };
    }

    let query = supabase
      .from('chat_messages')
      .select(`
        *,
        sender:users!chat_messages_sender_id_fkey (
          id,
          display_name,
          profile_picture
        )
      `)
      .eq('group_id', groupId)
      .eq('is_deleted', false)
      .not('media_url', 'is', null);

    if (mediaType) {
      query = query.eq('message_type', mediaType);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(clampLimit(limit));

    if (error) {
      return { data: null, error: { code: 'SEARCH_ERROR', message: error.message } };
    }

    return { data: data as any, error: null };
  } catch (error: any) {
    return { data: null, error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// חיפוש הודעות עם תיוגים (@mentions)
// ============================================

export async function searchMentions(
  groupId: string,
  userId: string,
  limit: number = 50
): Promise<{ data: ChatMessage[] | null; error: ChatError | null }> {
  try {
    if (!groupId || !validateUUID(groupId) || !userId || !validateUUID(userId)) {
      return { data: null, error: { code: 'INVALID_INPUT', message: 'Invalid group or user ID' } };
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .select(`
        *,
        sender:users!chat_messages_sender_id_fkey (
          id,
          display_name,
          profile_picture
        )
      `)
      .eq('group_id', groupId)
      .eq('is_deleted', false)
      .contains('mentioned_users', [userId])
      .order('created_at', { ascending: false })
      .limit(clampLimit(limit));

    if (error) {
      return { data: null, error: { code: 'SEARCH_ERROR', message: error.message } };
    }

    return { data: data as any, error: null };
  } catch (error: any) {
    return { data: null, error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// חיפוש הודעות לפי תאריך
// ============================================

export async function searchMessagesByDate(
  groupId: string,
  fromDate: string,
  toDate: string,
  limit: number = 100
): Promise<{ data: ChatMessage[] | null; error: ChatError | null }> {
  try {
    if (!groupId || !validateUUID(groupId)) {
      return { data: null, error: { code: 'INVALID_INPUT', message: 'Invalid group ID' } };
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .select(`
        *,
        sender:users!chat_messages_sender_id_fkey (
          id,
          display_name,
          profile_picture
        )
      `)
      .eq('group_id', groupId)
      .eq('is_deleted', false)
      .gte('created_at', fromDate)
      .lte('created_at', toDate)
      .order('created_at', { ascending: false })
      .limit(clampLimit(limit));

    if (error) {
      return { data: null, error: { code: 'SEARCH_ERROR', message: error.message } };
    }

    return { data: data as any, error: null };
  } catch (error: any) {
    return { data: null, error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// Export
// ============================================

export const chatSearchService = {
  searchMessagesInGroup,
  searchMessagesInAllGroups,
  searchGroups,
  searchUsers,
  searchGroupMembers,
  searchMessagesBySender,
  searchMediaMessages,
  searchMentions,
  searchMessagesByDate,
};









