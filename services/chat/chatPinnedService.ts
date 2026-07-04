// ============================================
// Chat Pinned Messages Service
// ============================================

import { supabase } from '../../lib/supabase';
import { ChatError } from '../../types/chat.types';
import { logger } from '../../utils/logger';

const PINNED_CACHE_TTL_MS = 45_000;
const pinnedCache = new Map<string, { data: ChatPinnedMessage[]; at: number }>();
let rpcMissingLogged = false;

export function invalidateChatPinnedCache(groupId: string): void {
  pinnedCache.delete(groupId);
}

export interface ChatPinnedMessage {
  id: string;
  message_id: string;
  message_content: string;
  message_type: string;
  message_created_at: string;
  pinned_by: string;
  pinned_by_name: string;
  pinned_at: string;
}

function previewForMessage(
  messageType: string,
  content: string | null | undefined
): string {
  if (messageType === 'media_group' && content) {
    try {
      const parsed = JSON.parse(content);
      return parsed.caption || 'מדיה';
    } catch {
      return 'מדיה';
    }
  }
  switch (messageType) {
    case 'image':
      return 'תמונה';
    case 'video':
      return 'סרטון';
    case 'audio':
      return 'הודעה קולית';
    case 'document':
      return 'מסמך';
    default:
      return content?.trim() || '';
  }
}

async function fetchPinnedFromTable(
  groupId: string
): Promise<{ data: ChatPinnedMessage[]; error: ChatError | null }> {
  const { data, error } = await supabase
    .from('chat_pinned_messages')
    .select(`
      id,
      message_id,
      pinned_by,
      created_at,
      message:chat_messages!inner (
        id,
        content,
        message_type,
        created_at,
        is_deleted
      )
    `)
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });

  if (error) {
    return { data: [], error: { code: 'FETCH_PINNED_ERROR', message: error.message } };
  }

  const rows = data ?? [];
  const pinnerIds = [...new Set(rows.map((r: any) => r.pinned_by).filter(Boolean))];
  const nameById = new Map<string, string>();

  if (pinnerIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, display_name, full_name')
      .in('id', pinnerIds);
    for (const u of users ?? []) {
      nameById.set(u.id, u.display_name || u.full_name || 'משתמש');
    }
  }

  const mapped: ChatPinnedMessage[] = rows
    .map((row: any) => {
      const msg = Array.isArray(row.message) ? row.message[0] : row.message;
      if (!msg || msg.is_deleted) return null;
      return {
        id: row.id,
        message_id: row.message_id,
        message_content: previewForMessage(msg?.message_type ?? 'text', msg?.content),
        message_type: msg?.message_type ?? 'text',
        message_created_at: msg?.created_at ?? row.created_at,
        pinned_by: row.pinned_by,
        pinned_by_name: nameById.get(row.pinned_by) ?? 'משתמש',
        pinned_at: row.created_at,
      };
    })
    .filter(Boolean) as ChatPinnedMessage[];

  return { data: mapped, error: null };
}

export async function getChatPinnedMessages(
  groupId: string,
  options?: { force?: boolean }
): Promise<{ data: ChatPinnedMessage[]; error: ChatError | null }> {
  const cached = pinnedCache.get(groupId);
  if (!options?.force && cached && Date.now() - cached.at < PINNED_CACHE_TTL_MS) {
    return { data: cached.data, error: null };
  }

  try {
    const { data, error } = await supabase.rpc('get_chat_pinned_messages', {
      p_group_id: groupId,
    });

    if (!error) {
      const rows = (data as ChatPinnedMessage[]) || [];
      pinnedCache.set(groupId, { data: rows, at: Date.now() });
      return { data: rows, error: null };
    }

    // RPC not deployed yet — fall back to direct table query
    if (error.code === 'PGRST202') {
      if (!rpcMissingLogged) {
        rpcMissingLogged = true;
        logger.debug('ChatPinned', 'RPC missing — using table fallback');
      }
      const tableResult = await fetchPinnedFromTable(groupId);
      if (!tableResult.error) {
        pinnedCache.set(groupId, { data: tableResult.data, at: Date.now() });
      }
      return tableResult;
    }

    logger.error('ChatPinned', 'Failed to load pinned messages', error);
    return { data: [], error: { code: 'FETCH_PINNED_ERROR', message: error.message } };
  } catch (error: any) {
    logger.error('ChatPinned', 'Unexpected error loading pinned messages', error);
    return { data: [], error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

export async function pinChatMessage(
  groupId: string,
  messageId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('chat_pinned_messages').upsert(
      {
        group_id: groupId,
        message_id: messageId,
        pinned_by: userId,
      },
      { onConflict: 'group_id,message_id' }
    );

    if (error) {
      logger.error('ChatPinned', 'Failed to pin message', error);
      return { success: false, error: error.message };
    }

    invalidateChatPinnedCache(groupId);
    return { success: true };
  } catch (error: any) {
    logger.error('ChatPinned', 'Unexpected error pinning message', error);
    return { success: false, error: error.message };
  }
}

export async function unpinChatMessage(
  groupId: string,
  messageId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('chat_pinned_messages')
      .delete()
      .eq('group_id', groupId)
      .eq('message_id', messageId);

    if (error) {
      logger.error('ChatPinned', 'Failed to unpin message', error);
      return { success: false, error: error.message };
    }

    invalidateChatPinnedCache(groupId);
    return { success: true };
  } catch (error: any) {
    logger.error('ChatPinned', 'Unexpected error unpinning message', error);
    return { success: false, error: error.message };
  }
}
