// ============================================
// Chat Search Service
// ============================================
// חיפוש הודעות, קבוצות וחברים
// ============================================

import { supabase } from '../../lib/supabase';
import {
  ChatMessage,
  ChatGroup,
  ChatGroupMember,
  ChatSearchResult,
  ChatError,
} from '../../types/chat.types';

// ============================================
// חיפוש הודעות בקבוצה
// ============================================

export async function searchMessagesInGroup(
  groupId: string,
  searchTerm: string,
  limit: number = 50
): Promise<{ data: ChatMessage[] | null; error: ChatError | null }> {
  try {
    console.log(`🔍 Searching messages in group ${groupId}:`, searchTerm);

    // חיפוש טקסט
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
      .ilike('content', `%${searchTerm}%`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('❌ Error searching messages:', error);
      return { data: null, error: { code: 'SEARCH_ERROR', message: error.message } };
    }

    console.log(`✅ Found ${data.length} messages`);
    return { data: data as any, error: null };
  } catch (error: any) {
    console.error('❌ Unexpected error searching messages:', error);
    return { data: null, error: { code: 'UNEXPECTED_ERROR', message: error.message } };
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
    console.log(`🔍 Searching messages for user ${userId}:`, searchTerm);

    // קבלת כל הקבוצות של המשתמש
    const { data: groups, error: groupsError } = await supabase
      .from('chat_group_members')
      .select('group_id')
      .eq('user_id', userId);

    if (groupsError) {
      console.error('❌ Error fetching groups:', groupsError);
      return { data: null, error: { code: 'FETCH_GROUPS_ERROR', message: groupsError.message } };
    }

    const groupIds = groups.map(g => g.group_id);

    if (groupIds.length === 0) {
      return { data: [], error: null };
    }

    // חיפוש בכל הקבוצות
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select(`
        *,
        sender:users!chat_messages_sender_id_fkey (
          id,
          display_name,
          profile_picture
        ),
        chat_groups!inner (
          id,
          name,
          avatar_url
        )
      `)
      .in('group_id', groupIds)
      .eq('is_deleted', false)
      .ilike('content', `%${searchTerm}%`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (messagesError) {
      console.error('❌ Error searching messages:', messagesError);
      return { data: null, error: { code: 'SEARCH_ERROR', message: messagesError.message } };
    }

    // המרה לפורמט ChatSearchResult
    const results: ChatSearchResult[] = (messages as any[]).map(msg => {
      // חילוץ highlight
      const content = msg.content || '';
      const index = content.toLowerCase().indexOf(searchTerm.toLowerCase());
      const start = Math.max(0, index - 50);
      const end = Math.min(content.length, index + searchTerm.length + 50);
      const highlight = content.substring(start, end);

      return {
        message: msg,
        group: msg.chat_groups,
        highlights: [highlight],
      };
    });

    console.log(`✅ Found ${results.length} messages across all groups`);
    return { data: results, error: null };
  } catch (error: any) {
    console.error('❌ Unexpected error searching messages:', error);
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
    console.log(`🔍 Searching groups:`, searchTerm);

    // חיפוש רק בקבוצות שהמשתמש חבר בהן
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
      .ilike('chat_groups.name', `%${searchTerm}%`)
      .order('chat_groups.name')
      .limit(limit);

    if (error) {
      console.error('❌ Error searching groups:', error);
      return { data: null, error: { code: 'SEARCH_ERROR', message: error.message } };
    }

    const groups = (data as any[]).map(item => item.chat_groups);

    console.log(`✅ Found ${groups.length} groups`);
    return { data: groups, error: null };
  } catch (error: any) {
    console.error('❌ Unexpected error searching groups:', error);
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
    console.log(`🔍 Searching users:`, searchTerm);

    let query = supabase
      .from('users')
      .select('id, display_name, full_name, email, profile_picture, is_online, last_active')
      .or(`display_name.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
      .order('display_name')
      .limit(limit);

    if (excludeUserIds && excludeUserIds.length > 0) {
      query = query.not('id', 'in', `(${excludeUserIds.join(',')})`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Error searching users:', error);
      return { data: null, error: { code: 'SEARCH_ERROR', message: error.message } };
    }

    console.log(`✅ Found ${data.length} users`);
    return { data, error: null };
  } catch (error: any) {
    console.error('❌ Unexpected error searching users:', error);
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
    console.log(`🔍 Searching members in group ${groupId}:`, searchTerm);

    const { data, error } = await supabase
      .from('chat_group_members')
      .select(`
        *,
        user:users!inner (
          id,
          display_name,
          full_name,
          profile_picture,
          email,
          is_online,
          last_active
        )
      `)
      .eq('group_id', groupId)
      .or(`user.display_name.ilike.%${searchTerm}%,user.full_name.ilike.%${searchTerm}%`)
      .limit(limit);

    if (error) {
      console.error('❌ Error searching group members:', error);
      return { data: null, error: { code: 'SEARCH_ERROR', message: error.message } };
    }

    console.log(`✅ Found ${data.length} members`);
    return { data: data as any, error: null };
  } catch (error: any) {
    console.error('❌ Unexpected error searching group members:', error);
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
    console.log(`🔍 Searching messages by sender ${senderId} in group ${groupId}`);

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
      .limit(limit);

    if (error) {
      console.error('❌ Error searching messages by sender:', error);
      return { data: null, error: { code: 'SEARCH_ERROR', message: error.message } };
    }

    console.log(`✅ Found ${data.length} messages`);
    return { data: data as any, error: null };
  } catch (error: any) {
    console.error('❌ Unexpected error searching messages by sender:', error);
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
    console.log(`🔍 Searching media messages in group ${groupId}`);

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
      .limit(limit);

    if (error) {
      console.error('❌ Error searching media messages:', error);
      return { data: null, error: { code: 'SEARCH_ERROR', message: error.message } };
    }

    console.log(`✅ Found ${data.length} media messages`);
    return { data: data as any, error: null };
  } catch (error: any) {
    console.error('❌ Unexpected error searching media messages:', error);
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
    console.log(`🔍 Searching mentions for user ${userId} in group ${groupId}`);

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
      .limit(limit);

    if (error) {
      console.error('❌ Error searching mentions:', error);
      return { data: null, error: { code: 'SEARCH_ERROR', message: error.message } };
    }

    console.log(`✅ Found ${data.length} mentions`);
    return { data: data as any, error: null };
  } catch (error: any) {
    console.error('❌ Unexpected error searching mentions:', error);
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
    console.log(`🔍 Searching messages by date in group ${groupId}`);

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
      .limit(limit);

    if (error) {
      console.error('❌ Error searching messages by date:', error);
      return { data: null, error: { code: 'SEARCH_ERROR', message: error.message } };
    }

    console.log(`✅ Found ${data.length} messages`);
    return { data: data as any, error: null };
  } catch (error: any) {
    console.error('❌ Unexpected error searching messages by date:', error);
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








