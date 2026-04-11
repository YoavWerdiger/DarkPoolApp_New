import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.94.1';

const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';

// 🔑 Expo Access Token נדרש לשליחת התראות ל-production builds
// יש להוסיף את הטוקן ב-Supabase Dashboard > Edge Functions > Secrets
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN') || '';

/** מחזיר URL תמונה שמובטח שיטען בהתראה (HTTPS). עבור Supabase storage – signed URL. */
async function ensureNotificationImageUrl(
  supabase: ReturnType<typeof createClient>,
  rawUrl: string | null | undefined
): Promise<string | null> {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  // נתיב יחסי ב-chat-media (אחרי מעבר ל-bucket פרטי)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/.+/i.test(trimmed)) {
    const { data: signed } = await supabase.storage.from('chat-media').createSignedUrl(trimmed, 3600);
    return signed?.signedUrl ?? null;
  }
  if (!trimmed.startsWith('https://')) return null;
  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)/);
    if (match && url.hostname.includes('supabase')) {
      const [, bucket, path] = match;
      const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(decodeURIComponent(path), 3600);
      if (signed?.signedUrl) return signed.signedUrl;
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}

interface ChatNotificationPayload {
  message_id: string;
  group_id: string;
  sender_id: string;
  content: string;
  message_type: string;
  media_url?: string;
}

serve(async (req) => {
  try {
    // CORS headers
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      });
    }

    const payload: ChatNotificationPayload = await req.json();
    const { message_id, group_id, sender_id, content, message_type, media_url } = payload;

    console.log('📨 Chat notification request:', { message_id, group_id, sender_id, message_type });

    if (!group_id || !sender_id) {
      return new Response(
        JSON.stringify({ error: 'group_id and sender_id are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // יצירת Supabase client עם Service Role Key
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. קבלת פרטי הקבוצה
    const { data: groupData, error: groupError } = await supabase
      .from('chat_groups')
      .select('id, name, avatar_url')
      .eq('id', group_id)
      .single();

    if (groupError || !groupData) {
      console.error('❌ Error fetching group:', groupError);
      return new Response(
        JSON.stringify({ error: 'Group not found', details: groupError?.message }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. קבלת פרטי השולח
    const { data: senderData, error: senderError } = await supabase
      .from('users')
      .select('id, display_name, full_name, profile_picture')
      .eq('id', sender_id)
      .single();

    if (senderError || !senderData) {
      console.error('❌ Error fetching sender:', senderError);
      return new Response(
        JSON.stringify({ error: 'Sender not found', details: senderError?.message }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const senderName = senderData.display_name || senderData.full_name || 'משתמש';

    // 3. קבלת כל חברי הקבוצה שלא השתיקו ושהם לא השולח
    const { data: membersData, error: membersError } = await supabase
      .from('chat_group_members')
      .select('user_id, muted, notifications_enabled')
      .eq('group_id', group_id)
      .neq('user_id', sender_id);

    if (membersError) {
      console.error('❌ Error fetching group members:', membersError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch group members', details: membersError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!membersData || membersData.length === 0) {
      console.log('ℹ️ No other members in group');
      return new Response(
        JSON.stringify({ success: true, message: 'No other members to notify', sent: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // סינון משתמשים שהשתיקו את הקבוצה או כיבו התראות
    const eligibleUserIds = membersData
      .filter(member => !member.muted && member.notifications_enabled !== false)
      .map(member => member.user_id);

    if (eligibleUserIds.length === 0) {
      console.log('ℹ️ All members have muted or disabled notifications');
      return new Response(
        JSON.stringify({ success: true, message: 'All members muted', sent: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📱 Eligible users for notification: ${eligibleUserIds.length}`);

    // 4. קבלת device tokens של המשתמשים הזכאים
    const { data: deviceTokens, error: tokensError } = await supabase
      .from('device_tokens')
      .select('expo_push_token, user_id')
      .in('user_id', eligibleUserIds)
      .eq('is_active', true);

    if (tokensError) {
      console.error('❌ Error fetching device tokens:', tokensError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch device tokens', details: tokensError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!deviceTokens || deviceTokens.length === 0) {
      console.log('ℹ️ No active device tokens found');
      return new Response(
        JSON.stringify({ success: true, message: 'No active device tokens', sent: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📱 Found ${deviceTokens.length} active device tokens`);

    // 5. הכנת תוכן ההתראה כמו וואטסאפ
    const notificationTitle = groupData.name;
    
    // תוכן ההודעה לפי סוג
    let messagePreview: string;
    switch (message_type) {
      case 'image':
        messagePreview = '📷 תמונה';
        break;
      case 'video':
        messagePreview = '🎥 סרטון';
        break;
      case 'audio':
        messagePreview = '🎤 הודעה קולית';
        break;
      case 'document':
        messagePreview = '📎 מסמך';
        break;
      case 'poll':
        messagePreview = '📊 סקר';
        break;
      default:
        // קיצור התוכן ל-100 תווים
        messagePreview = content && content.length > 100 
          ? content.substring(0, 100) + '...' 
          : content || '';
    }

    const notificationBody = `${senderName}: ${messagePreview}`;

    // תמונת ההתראה: תמונת המשתמש ששלח (מוצגת בצד בהתראה). Fallback לתמונת הקבוצה
    const senderAvatarUrl = await ensureNotificationImageUrl(supabase, senderData.profile_picture);
    const groupAvatarUrl = await ensureNotificationImageUrl(supabase, groupData.avatar_url);
    const notificationImageUrl = senderAvatarUrl || groupAvatarUrl;

    // 6. יצירת הודעות push לכל הטוקנים - בסגנון וואטסאפ (תמונת שולח בצד)
    const messages = deviceTokens.map((token) => ({
      to: token.expo_push_token,
      sound: 'default',
      title: groupData.name,
      body: `${senderName}: ${messagePreview}`,
      data: {
        type: 'chat_message',
        group_id: group_id,
        group_name: groupData.name,
        group_avatar: groupData.avatar_url,
        message_id: message_id,
        sender_id: sender_id,
        sender_name: senderName,
        sender_avatar: senderData.profile_picture,
        message_type: message_type,
        content_preview: messagePreview,
      },
      priority: 'high',
      channelId: 'chat-messages',
      categoryId: 'chat_message',
      icon: 'ic_notification',
      ...(notificationImageUrl ? { richContent: { image: notificationImageUrl } } : {}),
      _displayInForeground: true,
      badge: 1,
      subtitle: senderName,
    }));

    // 7. שליחת התראות דרך Expo Push API
    console.log(`📤 Sending ${messages.length} push notifications...`);

    // 🔑 Access Token נדרש עבור production builds
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    };
    
    if (EXPO_ACCESS_TOKEN) {
      headers['Authorization'] = `Bearer ${EXPO_ACCESS_TOKEN}`;
      console.log('🔑 Using Expo Access Token for authentication');
    } else {
      console.error('❌ EXPO_ACCESS_TOKEN is not set! Chat push will not work for production builds.');
      console.error('💡 Set in: Supabase Dashboard > Edge Functions > Secrets');
      return new Response(
        JSON.stringify({
          error: 'EXPO_ACCESS_TOKEN not configured',
          message: 'Add EXPO_ACCESS_TOKEN to Edge Function secrets for production push.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const response = await fetch(EXPO_PUSH_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Expo Push API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to send push notifications', details: errorText }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await response.json();
    const successCount = result.data?.filter((r: any) => r.status === 'ok').length || 0;
    const failedCount = result.data?.filter((r: any) => r.status !== 'ok').length || 0;

    // 8. טיפול בטוקנים לא תקינים (לעדכון is_active = false)
    const invalidTokens = result.data
      ?.filter((r: any, index: number) => 
        r.status === 'error' && 
        (r.details?.error === 'DeviceNotRegistered' || r.details?.error === 'InvalidCredentials')
      )
      .map((_: any, index: number) => deviceTokens[index]?.expo_push_token)
      .filter(Boolean);

    if (invalidTokens && invalidTokens.length > 0) {
      console.log(`🗑️ Marking ${invalidTokens.length} invalid tokens as inactive`);
      await supabase
        .from('device_tokens')
        .update({ is_active: false })
        .in('expo_push_token', invalidTokens);
    }

    console.log(`✅ Chat notification sent: ${successCount}/${messages.length} successful`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        failed: failedCount,
        total: messages.length,
        group_name: groupData.name,
        sender_name: senderName,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );

  } catch (error) {
    console.error('❌ Error in send-chat-notification:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

