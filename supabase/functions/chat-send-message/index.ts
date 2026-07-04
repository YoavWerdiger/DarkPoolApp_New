import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.94.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_MESSAGE_LENGTH = 10_000;
const RATE_LIMIT_MESSAGES = 30;       // per minute
const RATE_LIMIT_MEDIA = 10;          // per minute
const RATE_LIMIT_WINDOW_SECONDS = 60;

const XSS_PATTERNS = [
  /<script[\s>]/i,
  /javascript:/i,
  /on\w+\s*=/i,
  /<iframe/i,
  /<object/i,
  /<embed/i,
];

function sanitize(text: string): string {
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function containsXSS(text: string): boolean {
  return XSS_PATTERNS.some(pattern => pattern.test(text));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const respond = (body: object, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return respond({ error: 'Missing authorization' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Authenticate user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return respond({ error: 'Unauthorized' }, 401);

    const body = await req.json();
    const { group_id, content, message_type, media_url, media_type, reply_to_message_id, mentioned_users, is_silent, metadata } = body;

    // --- Validation ---
    if (!group_id) return respond({ error: 'Missing group_id' }, 400);
    if (!message_type) return respond({ error: 'Missing message_type' }, 400);

    /** חייב להתאים ל־valid_message_type בטבלה (לא reply/forward — אלה לא עמודות message_type) */
    const ALLOWED_MESSAGE_TYPES = [
      'text',
      'image',
      'video',
      'audio',
      'document',
      'poll',
      'system',
      'media_group',
      'trade',
    ];
    if (!ALLOWED_MESSAGE_TYPES.includes(message_type)) {
      return respond({ error: 'Invalid message_type' }, 400);
    }

    if (media_url && typeof media_url === 'string') {
      if (media_url.startsWith('javascript:') || media_url.startsWith('data:text/html')) {
        return respond({ error: 'Invalid media URL' }, 400);
      }
    }

    if (content && content.length > MAX_MESSAGE_LENGTH) {
      return respond({ error: `Message too long (max ${MAX_MESSAGE_LENGTH} chars)` }, 400);
    }

    if (content && containsXSS(content)) {
      return respond({ error: 'Message contains disallowed content' }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    // --- Membership check ---
    const { data: membership } = await adminClient
      .from('chat_group_members')
      .select('id')
      .eq('group_id', group_id)
      .eq('user_id', user.id)
      .single();

    if (!membership) return respond({ error: 'Not a group member' }, 403);

    // --- Atomic rate limiting (prevents TOCTOU race condition) ---
    const isMedia = ['image', 'video', 'audio', 'document'].includes(message_type);
    const action = isMedia ? 'media_send' : 'message_send';
    const limit = isMedia ? RATE_LIMIT_MEDIA : RATE_LIMIT_MESSAGES;

    const windowStart = new Date(
      Math.floor(Date.now() / (RATE_LIMIT_WINDOW_SECONDS * 1000)) * (RATE_LIMIT_WINDOW_SECONDS * 1000)
    ).toISOString();

    // Atomic increment-and-check via upsert + returning
    const { data: rateResult, error: rateError } = await adminClient
      .from('rate_limits')
      .upsert(
        { user_id: user.id, action, window_start: windowStart, request_count: 1 },
        { onConflict: 'user_id,action,window_start', ignoreDuplicates: false }
      )
      .select('request_count')
      .single();

    // If upsert created a new row, count=1. If existed, we need to increment.
    // Since Supabase upsert replaces, use RPC for true atomic increment:
    const { data: countData } = await adminClient.rpc('atomic_rate_check', {
      p_user_id: user.id,
      p_action: action,
      p_window_start: windowStart,
      p_limit: limit,
    });

    // Fallback: if RPC doesn't exist, use the upsert result
    if (countData !== undefined && countData !== null) {
      if (countData === -1) {
        return respond({ error: 'Rate limit exceeded. Please slow down.' }, 429);
      }
    } else if (rateResult && rateResult.request_count > limit) {
      return respond({ error: 'Rate limit exceeded. Please slow down.' }, 429);
    }

    // --- Insert message ---
    const messageRow: Record<string, any> = {
      group_id,
      sender_id: user.id,
      content: content ? sanitize(content) : null,
      message_type,
      media_url: media_url || null,
      media_type: media_type || null,
      reply_to_message_id: reply_to_message_id || null,
      mentioned_users: mentioned_users || [],
      is_silent: is_silent || false,
      is_system_message: false,
      is_deleted: false,
      deleted_for_everyone: false,
      is_forwarded: false,
      is_edited: false,
    };

    if (metadata) {
      if (metadata.media_thumbnail_url) messageRow.media_thumbnail_url = metadata.media_thumbnail_url;
      if (metadata.media_file_name) messageRow.media_file_name = metadata.media_file_name;
      if (metadata.media_size) messageRow.media_size = metadata.media_size;
      if (metadata.media_duration) messageRow.media_duration = metadata.media_duration;
      if (metadata.media_urls) messageRow.media_urls = metadata.media_urls;
    }

    const { data: message, error: insertError } = await adminClient
      .from('chat_messages')
      .insert(messageRow)
      .select(`
        *,
        sender:users!chat_messages_sender_id_fkey (
          id, display_name, profile_picture, is_online
        )
      `)
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return respond({ error: 'Failed to send message' }, 500);
    }

    // Update group last_message_at
    await adminClient
      .from('chat_groups')
      .update({ last_message_at: message.created_at })
      .eq('id', group_id);

    // Increment unread for other members
    await adminClient.rpc('increment_unread_count', {
      p_group_id: group_id,
      p_sender_id: user.id,
      p_mentioned_users: mentioned_users || [],
    });

    return respond({ data: message });
  } catch (error: any) {
    console.error('chat-send-message error:', error);
    return respond({ error: 'Internal server error' }, 500);
  }
})
