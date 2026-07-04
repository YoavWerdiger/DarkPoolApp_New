// ============================================
// Chat Group Service
// ============================================
// ניהול קבוצות - יצירה, עדכון, מחיקה, הוספת/הסרת חברים
// ============================================

import { supabase } from '../../lib/supabase';
import {
  ChatGroup,
  ChatGroupMember,
  ChatGroupWithDetails,
  CreateChatGroupInput,
  UpdateChatGroupInput,
  UpdateGroupMemberInput,
  ChatMemberRole,
  SystemMessageType,
  ChatMessageType,
  ChatError,
} from '../../types/chat.types';
import { logger } from '../../utils/logger';

// ============================================
// יצירת קבוצה חדשה
// ============================================

function sanitizeGroupInput(name?: string): string {
  if (!name || typeof name !== 'string') return '';
  return name.trim().replace(/<[^>]*>/g, '').substring(0, 100);
}

export async function createChatGroup(
  input: CreateChatGroupInput,
  currentUserId: string
): Promise<{ data: ChatGroup | null; error: ChatError | null }> {
  try {
    const safeName = sanitizeGroupInput(input.name);
    if (!safeName || safeName.length < 1) {
      return { data: null, error: { code: 'VALIDATION_ERROR', message: 'שם קבוצה חייב להכיל לפחות תו אחד' } };
    }
    if (!currentUserId) {
      return { data: null, error: { code: 'AUTH_ERROR', message: 'משתמש לא מאומת' } };
    }

    const safeDescription = input.description
      ? String(input.description).replace(/<[^>]*>/g, '').substring(0, 500)
      : undefined;

    // 1. יצירת הקבוצה
    const { data: group, error: groupError } = await supabase
      .from('chat_groups')
      .insert({
        name: safeName,
        description: safeDescription,
        avatar_url: input.avatar_url,
        created_by: currentUserId,
        settings: input.settings || {},
      })
      .select()
      .single();

    if (groupError) {
      logger.error('ChatGroup', 'Error creating group', groupError);
      return { data: null, error: { code: 'CREATE_GROUP_ERROR', message: groupError.message } };
    }

    // 2. הוספת היוצר כאדמין
    const { error: creatorError } = await supabase
      .from('chat_group_members')
      .insert({
        group_id: group.id,
        user_id: currentUserId,
        role: ChatMemberRole.ADMIN,
      });

    if (creatorError) {
      logger.error('ChatGroup', 'Error adding creator as admin', creatorError);
      const { error: rollbackError } = await supabase.from('chat_groups').delete().eq('id', group.id);
      if (rollbackError) logger.error('ChatGroup', 'Rollback failed - orphan group', { groupId: group.id, rollbackError });
      return { data: null, error: { code: 'ADD_CREATOR_ERROR', message: creatorError.message } };
    }

    // 3. הוספת חברים נוספים (אם יש)
    if (input.member_ids && input.member_ids.length > 0) {
      const membersToAdd = input.member_ids
        .filter(id => id !== currentUserId) // לא להוסיף את היוצר שוב
        .map(userId => ({
          group_id: group.id,
          user_id: userId,
          role: ChatMemberRole.MEMBER,
        }));

      if (membersToAdd.length > 0) {
        const { error: membersError } = await supabase
          .from('chat_group_members')
          .insert(membersToAdd);

        if (membersError) {
          logger.warn('ChatGroup', 'Error adding some members', membersError);
        }
      }

      const systemMessages = [
        createSystemMessage(group.id, currentUserId, SystemMessageType.GROUP_CREATED, { user_name: 'אתה' }),
        ...input.member_ids
          .filter(id => id !== currentUserId)
          .map(uid => createSystemMessage(group.id, uid, SystemMessageType.USER_JOINED, { user_id: uid })),
      ];
      await Promise.allSettled(systemMessages);
    }

    return { data: group, error: null };
  } catch (error: any) {
    logger.error('ChatGroup', 'Unexpected error creating group', error);
    return { data: null, error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// קבלת קבוצות של משתמש
// ============================================

export async function getChatGroups(
  userId: string
): Promise<{ data: ChatGroup[] | null; error: ChatError | null }> {
  try {
    const { data, error } = await supabase
      .from('chat_group_members')
      .select(`
        group_id,
        role,
        muted,
        unread_count,
        mentioned_count,
        last_read_message_id,
        chat_groups (
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
      .order('last_read_at', { ascending: false });

    if (error) {
      logger.error('ChatGroup', 'Error fetching groups', error);
      return { data: null, error: { code: 'FETCH_GROUPS_ERROR', message: error.message } };
    }

    const groups: ChatGroup[] = (data || []).map((item: any) => ({
      ...item.chat_groups,
      unread_count: item.unread_count || 0,
      mentioned_count: item.mentioned_count || 0,
      is_muted: item.muted,
      my_role: item.role,
      last_read_message_id: item.last_read_message_id,
    }));

    // מיון לפי הודעה אחרונה
    groups.sort((a, b) => {
      const timeA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const timeB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return timeB - timeA;
    });

    return { data: groups, error: null };
  } catch (error: any) {
    logger.error('ChatGroup', 'Unexpected error fetching groups', error);
    return { data: null, error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// קבלת קבוצה עם פרטים מלאים
// ============================================

export async function getChatGroupDetails(
  groupId: string,
  userId: string
): Promise<{ data: ChatGroupWithDetails | null; error: ChatError | null }> {
  try {
    // 1. קבלת פרטי הקבוצה
    const { data: group, error: groupError } = await supabase
      .from('chat_groups')
      .select('*')
      .eq('id', groupId)
      .single();

    if (groupError) {
      logger.error('ChatGroup', 'Error fetching group details', groupError);
      return { data: null, error: { code: 'FETCH_GROUP_ERROR', message: groupError.message } };
    }

    // 2. קבלת החברים
    const { data: members, error: membersError } = await supabase
      .from('chat_group_members')
      .select(`
        *,
        user:users (
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
      .order('role', { ascending: false }) // אדמינים קודם
      .order('joined_at', { ascending: true });

    if (membersError) {
      logger.error('ChatGroup', 'Error fetching members', membersError);
      return { data: null, error: { code: 'FETCH_MEMBERS_ERROR', message: membersError.message } };
    }

    // 3. מציאת החברות שלי
    const myMembership = members.find((m: any) => m.user_id === userId);
    const isAdmin = myMembership?.role === ChatMemberRole.ADMIN;

    const groupWithDetails: ChatGroupWithDetails = {
      ...group,
      members: members as any,
      my_membership: myMembership as any,
      is_admin: isAdmin,
      unread_count: myMembership?.unread_count || 0,
      mentioned_count: myMembership?.mentioned_count || 0,
      is_muted: myMembership?.muted || false,
      my_role: myMembership?.role as ChatMemberRole,
      last_read_message_id: myMembership?.last_read_message_id || null,
    };

    // Group details fetched successfully
    return { data: groupWithDetails, error: null };
  } catch (error: any) {
    logger.error('ChatGroup', 'Unexpected error fetching group details', error);
    return { data: null, error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// עדכון פרטי קבוצה
// ============================================

export async function updateChatGroup(
  groupId: string,
  input: UpdateChatGroupInput,
  userId: string
): Promise<{ data: ChatGroup | null; error: ChatError | null }> {
  try {
    const { data: membership, error: membershipError } = await supabase
      .from('chat_group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();

    if (membershipError) {
      logger.error('ChatGroup', 'updateChatGroup membership check failed', membershipError);
      return { data: null, error: { code: 'PERMISSION_CHECK_FAILED', message: 'שגיאה בבדיקת הרשאות' } };
    }
    if (membership?.role !== ChatMemberRole.ADMIN) {
      return { data: null, error: { code: 'PERMISSION_DENIED', message: 'רק אדמינים יכולים לערוך את הקבוצה' } };
    }

    const safeUpdate: Record<string, any> = { updated_at: new Date().toISOString() };
    if (input.name !== undefined) safeUpdate.name = sanitizeGroupInput(input.name);
    if (input.description !== undefined) safeUpdate.description = String(input.description).replace(/<[^>]*>/g, '').substring(0, 500);
    if (input.avatar_url !== undefined) safeUpdate.avatar_url = input.avatar_url;
    if (input.settings !== undefined) {
      // Fetch existing settings first to deep-merge (avoid wiping unrelated keys)
      const { data: existingGroup } = await supabase
        .from('chat_groups')
        .select('settings')
        .eq('id', groupId)
        .single();
      safeUpdate.settings = { ...(existingGroup?.settings || {}), ...input.settings };
    }

    const { data, error } = await supabase
      .from('chat_groups')
      .update(safeUpdate)
      .eq('id', groupId)
      .select()
      .single();

    if (error) {
      logger.error('ChatGroup', 'Error updating group', error);
      return { data: null, error: { code: 'UPDATE_GROUP_ERROR', message: error.message } };
    }

    // יצירת הודעת מערכת
    if (input.name) {
      await createSystemMessage(
        groupId,
        userId,
        SystemMessageType.GROUP_NAME_CHANGED,
        { new_value: input.name }
      );
    }
    if (input.avatar_url) {
      await createSystemMessage(
        groupId,
        userId,
        SystemMessageType.GROUP_AVATAR_CHANGED,
        {}
      );
    }
    if (input.description !== undefined) {
      await createSystemMessage(
        groupId,
        userId,
        SystemMessageType.GROUP_DESCRIPTION_CHANGED,
        {}
      );
    }

    return { data, error: null };
  } catch (error: any) {
    logger.error('ChatGroup', 'Unexpected error updating group', error);
    return { data: null, error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// מחיקת קבוצה
// ============================================

export async function deleteChatGroup(
  groupId: string,
  userId: string
): Promise<{ error: ChatError | null }> {
  try {
    const { data: group, error: groupError } = await supabase
      .from('chat_groups')
      .select('created_by')
      .eq('id', groupId)
      .single();

    if (groupError) {
      logger.error('ChatGroup', 'deleteChatGroup lookup failed', groupError);
      return { error: { code: 'GROUP_NOT_FOUND', message: 'הקבוצה לא נמצאה' } };
    }
    if (group?.created_by !== userId) {
      return { error: { code: 'PERMISSION_DENIED', message: 'רק יוצר הקבוצה יכול למחוק אותה' } };
    }

    // מחיקה (CASCADE ימחק את כל הנתונים הקשורים)
    const { error } = await supabase
      .from('chat_groups')
      .delete()
      .eq('id', groupId);

    if (error) {
      logger.error('ChatGroup', 'Error deleting group', error);
      return { error: { code: 'DELETE_GROUP_ERROR', message: error.message } };
    }

    return { error: null };
  } catch (error: any) {
    logger.error('ChatGroup', 'Unexpected error deleting group', error);
    return { error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// הוספת חבר לקבוצה
// ============================================

export async function addGroupMember(
  groupId: string,
  userIdToAdd: string,
  addedBy: string,
  role: ChatMemberRole = ChatMemberRole.MEMBER
): Promise<{ data: ChatGroupMember | null; error: ChatError | null }> {
  try {
    const { data: membership, error: membershipError } = await supabase
      .from('chat_group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', addedBy)
      .single();

    if (membershipError) {
      logger.error('ChatGroup', 'addGroupMember permission check failed', membershipError);
      return { data: null, error: { code: 'PERMISSION_CHECK_FAILED', message: 'שגיאה בבדיקת הרשאות' } };
    }
    if (membership?.role !== ChatMemberRole.ADMIN) {
      return { data: null, error: { code: 'PERMISSION_DENIED', message: 'רק אדמינים יכולים להוסיף חברים' } };
    }

    // הוספה
    const { data, error } = await supabase
      .from('chat_group_members')
      .insert({
        group_id: groupId,
        user_id: userIdToAdd,
        role,
      })
      .select()
      .single();

    if (error) {
      logger.error('ChatGroup', 'Error adding member', error);
      return { data: null, error: { code: 'ADD_MEMBER_ERROR', message: error.message } };
    }

    // הודעת מערכת
    await createSystemMessage(
      groupId,
      userIdToAdd,
      SystemMessageType.USER_JOINED,
      { user_id: userIdToAdd, admin_id: addedBy }
    );

    return { data, error: null };
  } catch (error: any) {
    logger.error('ChatGroup', 'Unexpected error adding member', error);
    return { data: null, error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// הסרת חבר מקבוצה
// ============================================

export async function removeGroupMember(
  groupId: string,
  userIdToRemove: string,
  removedBy: string
): Promise<{ error: ChatError | null }> {
  try {
    const isSelf = userIdToRemove === removedBy;

    // Fetch permission + group settings in parallel
    const [membershipResult, groupResult] = await Promise.all([
      isSelf ? Promise.resolve(null) : supabase
        .from('chat_group_members')
        .select('role')
        .eq('group_id', groupId)
        .eq('user_id', removedBy)
        .single(),
      supabase
        .from('chat_groups')
        .select('settings')
        .eq('id', groupId)
        .single(),
    ]);

    if (!isSelf) {
      if (membershipResult?.error) {
        logger.error('ChatGroup', 'removeGroupMember permission check failed', membershipResult.error);
        return { error: { code: 'PERMISSION_CHECK_FAILED', message: 'שגיאה בבדיקת הרשאות' } };
      }
      if (membershipResult?.data?.role !== ChatMemberRole.ADMIN) {
        return { error: { code: 'PERMISSION_DENIED', message: 'רק אדמינים יכולים להסיר חברים' } };
      }
    }

    const { error } = await supabase
      .from('chat_group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userIdToRemove);

    if (error) {
      logger.error('ChatGroup', 'Error removing member', error);
      return { error: { code: 'REMOVE_MEMBER_ERROR', message: error.message } };
    }

    // System messages for user_left / member_removed are disabled by design.
    // The group settings showJoinMessages flag is intentionally ignored for leave events.

    return { error: null };
  } catch (error: any) {
    logger.error('ChatGroup', 'Unexpected error removing member', error);
    return { error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// עדכון תפקיד חבר (קידום/הורדה מאדמין)
// ============================================

export async function updateGroupMemberRole(
  groupId: string,
  userIdToUpdate: string,
  newRole: ChatMemberRole,
  updatedBy: string
): Promise<{ error: ChatError | null }> {
  try {
    const { data: membership, error: membershipError } = await supabase
      .from('chat_group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', updatedBy)
      .single();

    if (membershipError) {
      logger.error('ChatGroup', 'updateGroupMemberRole permission check failed', membershipError);
      return { error: { code: 'PERMISSION_CHECK_FAILED', message: 'שגיאה בבדיקת הרשאות' } };
    }
    if (membership?.role !== ChatMemberRole.ADMIN) {
      return { error: { code: 'PERMISSION_DENIED', message: 'רק אדמינים יכולים לשנות תפקידים' } };
    }

    // עדכון
    const { error } = await supabase
      .from('chat_group_members')
      .update({ role: newRole })
      .eq('group_id', groupId)
      .eq('user_id', userIdToUpdate);

    if (error) {
      logger.error('ChatGroup', 'Error updating member role', error);
      return { error: { code: 'UPDATE_ROLE_ERROR', message: error.message } };
    }

    // הודעת מערכת
    await createSystemMessage(
      groupId,
      userIdToUpdate,
      newRole === ChatMemberRole.ADMIN ? SystemMessageType.MEMBER_PROMOTED : SystemMessageType.MEMBER_DEMOTED,
      { user_id: userIdToUpdate, admin_id: updatedBy }
    );

    return { error: null };
  } catch (error: any) {
    logger.error('ChatGroup', 'Unexpected error updating member role', error);
    return { error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// עדכון הגדרות אישיות של חבר (השתקה, התראות)
// ============================================

export async function updateGroupMemberSettings(
  groupId: string,
  userId: string,
  input: Partial<Pick<ChatGroupMember, 'muted' | 'notifications_enabled'>>
): Promise<{ error: ChatError | null }> {
  try {
    const { error } = await supabase
      .from('chat_group_members')
      .update(input)
      .eq('group_id', groupId)
      .eq('user_id', userId);

    if (error) {
      logger.error('ChatGroup', 'Error updating member settings', error);
      return { error: { code: 'UPDATE_SETTINGS_ERROR', message: error.message } };
    }

    return { error: null };
  } catch (error: any) {
    logger.error('ChatGroup', 'Unexpected error updating member settings', error);
    return { error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// קבלת חברי קבוצה
// ============================================

export async function getGroupMembers(
  groupId: string
): Promise<{ data: ChatGroupMember[] | null; error: ChatError | null }> {
  try {
    const { data, error } = await supabase
      .from('chat_group_members')
      .select(`
        *,
        user:users (
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
      .order('role', { ascending: false })
      .order('joined_at', { ascending: true });

    if (error) {
      logger.error('ChatGroup', 'Error fetching members', error);
      return { data: null, error: { code: 'FETCH_MEMBERS_ERROR', message: error.message } };
    }

    return { data: data as any, error: null };
  } catch (error: any) {
    logger.error('ChatGroup', 'Unexpected error fetching members', error);
    return { data: null, error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// בדיקה אם משתמש הוא חבר בקבוצה
// ============================================

export async function isGroupMember(
  groupId: string,
  userId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('chat_group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') logger.error('ChatGroup', 'isGroupMember query failed', error);
      return false;
    }
    return !!data;
  } catch (e) {
    logger.error('ChatGroup', 'isGroupMember unexpected error', e);
    return false;
  }
}

// ============================================
// בדיקה אם משתמש הוא אדמין בקבוצה
// ============================================

export async function isGroupAdmin(
  groupId: string,
  userId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('chat_group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') logger.error('ChatGroup', 'isGroupAdmin query failed', error);
      return false;
    }
    return data?.role === ChatMemberRole.ADMIN;
  } catch (e) {
    logger.error('ChatGroup', 'isGroupAdmin unexpected error', e);
    return false;
  }
}

// ============================================
// פונקציית עזר - יצירת הודעת מערכת
// ============================================

async function createSystemMessage(
  groupId: string,
  userId: string,
  systemMessageType: SystemMessageType,
  data: any
): Promise<void> {
  try {
    const { error } = await supabase
      .from('chat_messages')
      .insert({
        group_id: groupId,
        sender_id: userId,
        message_type: ChatMessageType.SYSTEM,
        is_system_message: true,
        system_message_type: systemMessageType,
        system_message_data: data,
        is_silent: true,
      });
    if (error) {
      logger.error('ChatGroup', 'createSystemMessage insert failed', error);
    }
  } catch (e) {
    logger.error('ChatGroup', 'createSystemMessage unexpected error', e);
  }
}

// ============================================
// השתקת/ביטול השתקת קבוצה
// ============================================

export async function toggleGroupMute(
  groupId: string,
  userId: string,
  muted: boolean
): Promise<{ success: boolean; error: ChatError | null }> {
  try {
    // קריאה ל-RPC function
    const { data, error } = await supabase.rpc('toggle_group_mute', {
      p_group_id: groupId,
      p_user_id: userId,
      p_muted: muted,
    });

    if (error) {
      logger.error('ChatGroup', 'Error toggling group mute', error);
      return { 
        success: false, 
        error: { code: 'TOGGLE_MUTE_ERROR', message: error.message } 
      };
    }

    return { success: true, error: null };
  } catch (error) {
    logger.error('ChatGroup', 'Exception toggling group mute', error);
    return { 
      success: false, 
      error: { code: 'TOGGLE_MUTE_EXCEPTION', message: String(error) } 
    };
  }
}

// ============================================
// בדיקה האם קבוצה מושתקת
// ============================================

export async function isGroupMuted(
  groupId: string,
  userId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('chat_group_members')
      .select('muted')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return false;
    }

    return data.muted === true;
  } catch (error) {
    logger.error('ChatGroup', 'Error checking group mute status', error);
    return false;
  }
}

// ============================================
// Export
// ============================================

export const chatGroupService = {
  createChatGroup,
  getChatGroups,
  getChatGroupDetails,
  updateChatGroup,
  deleteChatGroup,
  addGroupMember,
  removeGroupMember,
  updateGroupMemberRole,
  updateGroupMemberSettings,
  getGroupMembers,
  isGroupMember,
  isGroupAdmin,
  toggleGroupMute,
  isGroupMuted,
};





