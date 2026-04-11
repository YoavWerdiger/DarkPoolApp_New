import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.94.1';

const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';

// 🔑 Expo Access Token נדרש לשליחת התראות ל-production builds
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN') || '';

async function ensureNotificationImageUrl(
  supabase: ReturnType<typeof createClient>,
  rawUrl: string | null | undefined
): Promise<string | null> {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
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

    // קבלת פרמטרים אופציונליים מהבקשה (רק אם נשלחו במפורש)
    let specificToken: string | null = null;
    let specificDeviceId: string | null = null;
    try {
      const text = await req.text();
      if (text && text.trim() !== '' && text !== '{}') {
        const body = JSON.parse(text);
        specificToken = body.specificToken || null;
        specificDeviceId = body.specificDeviceId || null;
        if (specificToken || specificDeviceId) {
          console.log(`🎯 Specific targeting enabled - token: ${specificToken ? specificToken.substring(0, 30) + '...' : 'none'}, device: ${specificDeviceId || 'none'}`);
        }
      }
    } catch (error) {
      // אם אין body או שגיאה, נמשיך בלי פרמטרים - נשלח לכל הטוקנים
    }

    // יצירת Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // קבלת כל ההתראות הממתינות
    console.log('🔍 Fetching pending notifications...');
    const { data: pendingNotifications, error: notificationsError } = await supabase
      .from('pending_notifications')
      .select('*')
      .eq('is_sent', false)
      .order('created_at', { ascending: true })
      .limit(100); // הגבלה ל-100 התראות בכל פעם

    if (notificationsError) {
      console.error('❌ Error fetching pending notifications:', notificationsError);
      return new Response(
        JSON.stringify({
          error: 'Failed to fetch pending notifications',
          details: notificationsError.message,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Found ${pendingNotifications?.length || 0} pending notifications`);

    if (!pendingNotifications || pendingNotifications.length === 0) {
      console.log('ℹ️ No pending notifications to process');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No pending notifications',
          processed: 0,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // קיבוץ התראות לפי user_id
    const notificationsByUser = new Map<string, any[]>();
    for (const notification of pendingNotifications) {
      if (!notification.user_id) continue;

      if (!notificationsByUser.has(notification.user_id)) {
        notificationsByUser.set(notification.user_id, []);
      }
      notificationsByUser.get(notification.user_id)!.push(notification);
    }

    let totalSent = 0;
    let totalFailed = 0;

    // שליחת התראות לכל משתמש
    for (const [userId, notifications] of notificationsByUser) {
      try {
        // קבלת device tokens של המשתמש
        // אם יש טוקן ספציפי או device_id ספציפי, נשלח רק אליו
        // אחרת, נשלח לכל הטוקנים הפעילים (התנהגות ברירת מחדל)
        let query = supabase
          .from('device_tokens')
          .select('expo_push_token')
          .eq('user_id', userId)
          .eq('is_active', true);
        
        if (specificToken) {
          query = query.eq('expo_push_token', specificToken);
          console.log(`🎯 Filtering to specific token only`);
        }
        
        if (specificDeviceId) {
          // אם יש device_id, נצטרך לשאול גם את device_id
          query = supabase
            .from('device_tokens')
            .select('expo_push_token')
            .eq('user_id', userId)
            .eq('is_active', true)
            .eq('device_id', specificDeviceId);
          console.log(`🎯 Filtering to specific device only: ${specificDeviceId}`);
        }
        
        const { data: deviceTokens, error: tokensError } = await query;

        if (tokensError) {
          console.error(`❌ Error fetching device tokens for user ${userId}:`, tokensError);
          totalFailed += notifications.length;
          continue;
        }

        if (!deviceTokens || deviceTokens.length === 0) {
          console.log(`⚠️ No active device tokens for user ${userId}`);
          // סמן את ההתראות כנשלחו (אפילו אם לא נשלחו - אין מכשירים)
          const notificationIds = notifications.map((n) => n.id);
          await supabase
            .from('pending_notifications')
            .update({
              is_sent: true,
              sent_at: new Date().toISOString(),
            })
            .in('id', notificationIds);
          continue;
        }

        console.log(`✅ Found ${deviceTokens.length} active device token(s) for user ${userId}`);

        // יצירת הודעות push לכל התראה (תמונת ההתראה – signed URL כדי שלא יוצג ריבוע אפור)
        const messages = [];
        for (const notification of notifications) {
          const notificationData = notification.data || {};
          const rawImageUrl = notificationData.imageUrl || null;
          const imageUrl = rawImageUrl ? await ensureNotificationImageUrl(supabase, rawImageUrl) : null;

          for (const token of deviceTokens) {
            messages.push({
              to: token.expo_push_token,
              sound: 'default',
              title: notification.title,
              body: notification.body,
              subtitle: 'DarkPool',
              data: {
                ...notificationData,
                appName: 'DarkPool',
                ...(imageUrl ? { image: imageUrl } : {}),
              },
              priority: 'high',
              channelId: 'default',
              icon: 'ic_notification',
              ...(imageUrl ? { richContent: { image: imageUrl } } : {}),
              android: {
                channelId: 'default',
                priority: 'high',
                ...(imageUrl ? { imageUrl: imageUrl } : {}),
              },
              ios: {
                sound: 'default',
                badge: 1,
                ...(imageUrl ? { attachments: [{ url: imageUrl }] } : {}),
              },
            });
          }
        }

        // שליחת התראות דרך Expo Push API
        console.log(`📤 Sending ${messages.length} messages to Expo Push API for user ${userId}`);
        console.log(`📤 Messages preview:`, messages.map(m => ({ to: m.to.substring(0, 30) + '...', title: m.title, subtitle: m.subtitle })));
        
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
          console.error('❌ EXPO_ACCESS_TOKEN is not set! Pending notifications will not be delivered.');
          console.error('💡 Set in: Supabase Dashboard > Edge Functions > Secrets');
          totalFailed += notifications.length;
          continue; // לא מסמנים כנשלח – יישלחו כשנוסיף את הטוקן
        }
        
        const response = await fetch(EXPO_PUSH_API_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify(messages),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Failed to send notifications for user ${userId}:`, errorText);
          console.error(`❌ Response status:`, response.status);
          console.error(`❌ Response statusText:`, response.statusText);
          totalFailed += notifications.length;
          continue;
        }

        const result = await response.json();
        console.log(`📥 Expo Push API response:`, JSON.stringify(result, null, 2));
        const successCount = result.data?.filter((r: any) => r.status === 'ok').length || 0;
        const failedCount = result.data?.filter((r: any) => r.status !== 'ok').length || 0;
        
        if (failedCount > 0) {
          console.log(`⚠️ ${failedCount} notifications failed:`, result.data?.filter((r: any) => r.status !== 'ok'));
          console.log(`⚠️ Failed notifications details:`, result.data?.filter((r: any) => r.status !== 'ok'));
        }

        // סמן את ההתראות כנשלחו
        const notificationIds = notifications.map((n) => n.id);
        await supabase
          .from('pending_notifications')
          .update({
            is_sent: true,
            sent_at: new Date().toISOString(),
          })
          .in('id', notificationIds);

        totalSent += notifications.length;
        console.log(`✅ Sent ${successCount}/${messages.length} notifications for user ${userId}`);
        console.log(`📊 Success rate: ${Math.round((successCount / messages.length) * 100)}%`);
      } catch (error) {
        console.error(`❌ Error processing notifications for user ${userId}:`, error);
        totalFailed += notifications.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: pendingNotifications.length,
        sent: totalSent,
        failed: totalFailed,
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
    console.error('Error in process-pending-notifications:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error.message,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
